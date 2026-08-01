import secrets
import threading
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.ingestion import IngestionLock


class LeaseLostError(RuntimeError):
    """Raised when a worker no longer owns the generation that fences its writes."""


class LeaseLock:
    """Database-backed owner lease.

    A unique insert wins an empty lock. If it already exists, one conditional
    update can replace it only after expiry. PostgreSQL and SQLite both make
    those individual writes atomic; SQLite still serializes writers and is not
    intended for high-throughput multi-process production scheduling.
    """

    def __init__(
        self,
        name: str,
        ttl_seconds: int,
        *,
        owner_token: str | None = None,
        session_factory: Callable[[], Session] = SessionLocal,
        now: Callable[[], datetime] | None = None,
    ):
        self.name = name
        self.ttl = ttl_seconds
        self.owner = owner_token or secrets.token_urlsafe(32)
        self.session_factory = session_factory
        self.now = now or (lambda: datetime.now(UTC))
        self.generation: int | None = None
        self._lost = threading.Event()

    @property
    def lost(self) -> bool:
        return self._lost.is_set()

    def mark_lost(self) -> None:
        self._lost.set()

    def _require_generation(self) -> int:
        if self.generation is None:
            raise LeaseLostError(f"Lease {self.name!r} has not been acquired")
        return self.generation

    def acquire(self) -> bool:
        current = self.now()
        expires = current + timedelta(seconds=self.ttl)
        with self.session_factory() as db:
            db.add(
                IngestionLock(
                    lock_name=self.name,
                    owner_token=self.owner,
                    acquired_at=current,
                    heartbeat_at=current,
                    expires_at=expires,
                    released_at=None,
                )
            )
            try:
                db.commit()
                self.generation = 1
                self._lost.clear()
                return True
            except IntegrityError:
                db.rollback()

            result = db.execute(
                update(IngestionLock)
                .where(
                    IngestionLock.lock_name == self.name,
                    IngestionLock.expires_at <= current,
                )
                .values(
                    owner_token=self.owner,
                    acquired_at=current,
                    heartbeat_at=current,
                    expires_at=expires,
                    released_at=None,
                    generation=IngestionLock.generation + 1,
                )
                .returning(IngestionLock.generation)
            )
            generation = result.scalar_one_or_none()
            db.commit()
            if generation is None:
                return False
            self.generation = int(generation)
            self._lost.clear()
            return True

    def renew(self) -> bool:
        current = self.now()
        generation = self._require_generation()
        with self.session_factory() as db:
            result = db.execute(
                update(IngestionLock)
                .where(
                    IngestionLock.lock_name == self.name,
                    IngestionLock.owner_token == self.owner,
                    IngestionLock.generation == generation,
                    IngestionLock.expires_at > current,
                )
                .values(
                    heartbeat_at=current,
                    expires_at=current + timedelta(seconds=self.ttl),
                )
            )
            db.commit()
            renewed = result.rowcount == 1
        if not renewed:
            self.mark_lost()
        return renewed

    def checkpoint(self) -> None:
        """Verify ownership at a provider/batch boundary."""

        if self.lost:
            raise LeaseLostError(f"Lease ownership was lost for {self.name!r}")
        generation = self._require_generation()
        current = self.now()
        with self.session_factory() as db:
            owned = db.scalar(
                select(IngestionLock.id).where(
                    IngestionLock.lock_name == self.name,
                    IngestionLock.owner_token == self.owner,
                    IngestionLock.generation == generation,
                    IngestionLock.expires_at > current,
                )
            )
        if owned is None:
            self.mark_lost()
            raise LeaseLostError(f"Lease ownership was lost for {self.name!r}")

    def fence(self, db: Session) -> None:
        """Fence a pending transaction against takeover before it commits.

        The conditional no-op update takes the database write/row lock inside
        the caller's transaction. A takeover cannot pass its expiry predicate
        between this check and the caller's commit.
        """

        if self.lost:
            raise LeaseLostError(f"Lease ownership was lost for {self.name!r}")
        generation = self._require_generation()
        current = self.now()
        result = db.execute(
            update(IngestionLock)
            .where(
                IngestionLock.lock_name == self.name,
                IngestionLock.owner_token == self.owner,
                IngestionLock.generation == generation,
                IngestionLock.expires_at > current,
            )
            .values(owner_token=self.owner)
        )
        if result.rowcount != 1:
            self.mark_lost()
            raise LeaseLostError(f"Lease ownership was lost for {self.name!r}")

    def release(self) -> bool:
        if self.generation is None:
            return False
        current = self.now()
        with self.session_factory() as db:
            result = db.execute(
                update(IngestionLock)
                .where(
                    IngestionLock.lock_name == self.name,
                    IngestionLock.owner_token == self.owner,
                    IngestionLock.generation == self.generation,
                )
                .values(heartbeat_at=current, expires_at=current, released_at=current)
            )
            db.commit()
            released = result.rowcount == 1
        if not released:
            self.mark_lost()
        return released
