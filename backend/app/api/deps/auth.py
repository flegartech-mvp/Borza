from datetime import UTC, datetime
from uuid import UUID

import httpx
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.database import get_db
from app.models.academy import User


def _authenticate_with_supabase(token: str, settings: Settings) -> tuple[UUID, str | None]:
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication is not configured.",
        )
    try:
        response = httpx.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": settings.supabase_publishable_key,
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
            timeout=settings.supabase_auth_timeout_seconds,
            follow_redirects=False,
        )
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable.",
        ) from exc
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = response.json()
        user_id = UUID(str(payload.get("id") or payload.get("sub")))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Authentication service returned an invalid user record.",
        ) from exc
    email = payload.get("email")
    return user_id, str(email)[:320] if email else None


def get_current_user(
    authorization: str | None = Header(default=None),
    x_demo_user: str | None = Header(default=None, alias="X-Demo-User"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    """Authenticate one learner and materialize the local user record.

    Production identity is always confirmed by Supabase Auth. Development and
    tests may opt into an explicit UUID-valued demo header.
    """

    if x_demo_user:
        if settings.is_deployed or not settings.academy_allow_demo_auth:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Demo authentication is disabled.",
            )
        try:
            user_id = UUID(x_demo_user)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="X-Demo-User must be a UUID.",
            ) from exc
        email = None
        is_demo = True
    else:
        scheme, _, token = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id, email = _authenticate_with_supabase(token.strip(), settings)
        is_demo = False

    user = db.get(User, user_id)
    now = datetime.now(UTC)
    if user is None:
        user = User(id=user_id, email=email, is_demo=is_demo, last_seen_at=now)
        db.add(user)
    else:
        user.last_seen_at = now
        if email:
            user.email = email
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        user = db.get(User, user_id)
        if user is None:
            raise
    db.refresh(user)
    return user
