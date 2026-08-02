from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.database import get_db
from app.models.academy import (
    JournalTag,
    SimulationSession,
    TradingJournal,
    TradingJournalTag,
    User,
)
from app.schemas.academy import (
    JournalPage,
    JournalPeriodSummary,
    JournalRead,
    JournalSummary,
    JournalWrite,
    NamedCount,
    SetupPerformance,
)
from app.services.learning_state import record_learning_activity

router = APIRouter(prefix="/api/v1/journal", tags=["journal"])


def _owned_journal(db: Session, user: User, journal_id: UUID) -> TradingJournal:
    journal = db.scalar(
        select(TradingJournal).where(
            TradingJournal.id == journal_id, TradingJournal.user_id == user.id
        )
    )
    if journal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journal entry not found.")
    return journal


def _validate_session(db: Session, user: User, session_id: UUID | None) -> None:
    if session_id is None:
        return
    exists = db.scalar(
        select(SimulationSession.id).where(
            SimulationSession.id == session_id, SimulationSession.user_id == user.id
        )
    )
    if exists is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Simulation session not found.")


def _set_tags(db: Session, journal: TradingJournal, user: User, names: list[str]) -> None:
    db.execute(
        delete(TradingJournalTag).where(
            TradingJournalTag.journal_id == journal.id,
            TradingJournalTag.user_id == user.id,
        )
    )
    for name in sorted({item.strip().lower() for item in names if item.strip()}):
        tag = db.scalar(
            select(JournalTag).where(JournalTag.user_id == user.id, JournalTag.name == name)
        )
        if tag is None:
            tag = JournalTag(user_id=user.id, name=name)
            db.add(tag)
            db.flush()
        db.add(TradingJournalTag(journal_id=journal.id, tag_id=tag.id, user_id=user.id))


def _read(db: Session, journal: TradingJournal) -> JournalRead:
    tags = list(
        db.scalars(
            select(JournalTag.name)
            .join(
                TradingJournalTag,
                (TradingJournalTag.tag_id == JournalTag.id)
                & (TradingJournalTag.user_id == JournalTag.user_id),
            )
            .where(
                TradingJournalTag.journal_id == journal.id,
                TradingJournalTag.user_id == journal.user_id,
            )
            .order_by(JournalTag.name)
        )
    )
    payload = JournalRead.model_validate(journal).model_dump()
    payload["tags"] = tags
    return JournalRead(**payload)


def _apply(journal: TradingJournal, request: JournalWrite) -> None:
    values = request.model_dump(exclude={"tags"})
    for field, value in values.items():
        setattr(journal, field, value)


@router.post("", response_model=JournalRead, status_code=status.HTTP_201_CREATED)
def create_entry(
    request: JournalWrite,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JournalRead:
    _validate_session(db, user, request.simulation_session_id)
    journal = TradingJournal(user_id=user.id, setup=request.setup, thesis=request.thesis)
    _apply(journal, request)
    db.add(journal)
    db.flush()
    _set_tags(db, journal, user, request.tags)
    record_learning_activity(
        db,
        user.id,
        event_type="journal_created",
        entity_id=str(journal.id),
        idempotency_key=f"journal_created:{journal.id}",
    )
    db.commit()
    db.refresh(journal)
    return _read(db, journal)


@router.get("", response_model=JournalPage)
def list_entries(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JournalPage:
    total = (
        db.scalar(select(func.count(TradingJournal.id)).where(TradingJournal.user_id == user.id))
        or 0
    )
    items = list(
        db.scalars(
            select(TradingJournal)
            .where(TradingJournal.user_id == user.id)
            .order_by(TradingJournal.created_at.desc(), TradingJournal.id.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return JournalPage(
        items=[_read(db, item) for item in items], total=total, limit=limit, offset=offset
    )


def _decimal_or_none(value) -> Decimal | None:
    return Decimal(str(value)).quantize(Decimal("0.01")) if value is not None else None


def _period_summary(db: Session, user_id: UUID, since: datetime) -> JournalPeriodSummary:
    count, result, average_r, adherence = db.execute(
        select(
            func.count(TradingJournal.id),
            func.coalesce(func.sum(TradingJournal.result_amount), 0),
            func.avg(TradingJournal.r_multiple),
            func.avg(TradingJournal.rule_adherence),
        ).where(
            TradingJournal.user_id == user_id,
            TradingJournal.created_at >= since,
        )
    ).one()
    return JournalPeriodSummary(
        entry_count=int(count),
        total_result=Decimal(str(result)),
        average_r=_decimal_or_none(average_r),
        average_rule_adherence=_decimal_or_none(adherence),
    )


@router.get("/summary", response_model=JournalSummary)
def journal_summary(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> JournalSummary:
    entry_count = (
        db.scalar(select(func.count(TradingJournal.id)).where(TradingJournal.user_id == user.id))
        or 0
    )
    setup_rows = db.execute(
        select(
            TradingJournal.setup,
            func.count(TradingJournal.id),
            func.avg(TradingJournal.r_multiple),
            func.avg(TradingJournal.result_amount),
            func.avg(TradingJournal.rule_adherence),
        )
        .where(TradingJournal.user_id == user.id)
        .group_by(TradingJournal.setup)
        .order_by(func.count(TradingJournal.id).desc())
        .limit(100)
    ).all()
    performance = [
        SetupPerformance(
            setup=setup,
            trades=int(count),
            average_r=_decimal_or_none(average_r),
            average_result=_decimal_or_none(average_result),
            average_rule_adherence=_decimal_or_none(adherence),
        )
        for setup, count, average_r, average_result, adherence in setup_rows
    ]
    emotion_counts: dict[str, int] = {}
    for field in (
        TradingJournal.emotions_before,
        TradingJournal.emotions_during,
        TradingJournal.emotions_after,
    ):
        rows = db.execute(
            select(field, func.count(TradingJournal.id))
            .where(TradingJournal.user_id == user.id, field.is_not(None))
            .group_by(field)
            .order_by(func.count(TradingJournal.id).desc())
            .limit(10)
        ).all()
        for name, count in rows:
            emotion_counts[str(name)] = emotion_counts.get(str(name), 0) + int(count)
    tag_rows = db.execute(
        select(JournalTag.name, func.count(TradingJournalTag.journal_id))
        .join(
            TradingJournalTag,
            (TradingJournalTag.tag_id == JournalTag.id)
            & (TradingJournalTag.user_id == JournalTag.user_id),
        )
        .where(JournalTag.user_id == user.id)
        .group_by(JournalTag.name)
        .order_by(func.count(TradingJournalTag.journal_id).desc())
        .limit(10)
    ).all()
    average_adherence = db.scalar(
        select(func.avg(TradingJournal.rule_adherence)).where(
            TradingJournal.user_id == user.id,
            TradingJournal.rule_adherence.is_not(None),
        )
    )
    strongest = sorted(
        performance,
        key=lambda item: (
            item.average_r is not None,
            item.average_r or item.average_result or Decimal(0),
        ),
        reverse=True,
    )[:5]
    weakest = sorted(
        performance,
        key=lambda item: (
            item.average_r is None and item.average_result is None,
            item.average_r or item.average_result or Decimal(0),
        ),
    )
    now = datetime.now(UTC)
    return JournalSummary(
        entry_count=int(entry_count),
        top_setups=[NamedCount(name=item.setup, count=item.trades) for item in performance[:5]],
        common_emotions=[
            NamedCount(name=name, count=count)
            for name, count in sorted(
                emotion_counts.items(), key=lambda item: item[1], reverse=True
            )[:5]
        ],
        repeated_mistakes=[
            NamedCount(name=str(name), count=int(count)) for name, count in tag_rows
        ],
        average_rule_adherence=_decimal_or_none(average_adherence),
        strongest_setups=strongest,
        weakest_setups=weakest[:5],
        last_7_days=_period_summary(db, user.id, now - timedelta(days=7)),
        last_30_days=_period_summary(db, user.id, now - timedelta(days=30)),
    )


@router.get("/{journal_id}", response_model=JournalRead)
def get_entry(
    journal_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JournalRead:
    return _read(db, _owned_journal(db, user, journal_id))


@router.put("/{journal_id}", response_model=JournalRead)
def update_entry(
    journal_id: UUID,
    request: JournalWrite,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JournalRead:
    journal = _owned_journal(db, user, journal_id)
    _validate_session(db, user, request.simulation_session_id)
    _apply(journal, request)
    _set_tags(db, journal, user, request.tags)
    db.commit()
    db.refresh(journal)
    return _read(db, journal)


@router.delete("/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    journal_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    journal = _owned_journal(db, user, journal_id)
    db.delete(journal)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
