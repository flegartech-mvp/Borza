from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.api.routes.catalog import registry_or_503
from app.database import get_db
from app.models.academy import (
    Enrollment,
    OnboardingProfile,
    Profile,
    User,
    UserPreference,
)
from app.schemas.academy import (
    OnboardingIn,
    OnboardingRead,
    PreferenceRead,
    PreferenceUpdate,
    ProfileRead,
    ProfileUpdate,
)

router = APIRouter(prefix="/api/v1", tags=["profile"])


def _default_profile(db: Session, user: User) -> Profile:
    profile = db.get(Profile, user.id)
    if profile is None:
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _default_preferences(db: Session, user: User) -> UserPreference:
    preferences = db.get(UserPreference, user.id)
    if preferences is None:
        preferences = UserPreference(user_id=user.id)
        db.add(preferences)
        db.commit()
        db.refresh(preferences)
    return preferences


@router.get("/profile", response_model=ProfileRead)
def read_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Profile:
    return _default_profile(db, user)


@router.put("/profile", response_model=ProfileRead)
def update_profile(
    request: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Profile:
    profile = _default_profile(db, user)
    for field, value in request.model_dump().items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/preferences", response_model=PreferenceRead)
def read_preferences(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserPreference:
    return _default_preferences(db, user)


@router.put("/preferences", response_model=PreferenceRead)
def update_preferences(
    request: PreferenceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPreference:
    preferences = _default_preferences(db, user)
    for field, value in request.model_dump().items():
        setattr(preferences, field, value)
    db.commit()
    db.refresh(preferences)
    return preferences


def _recommend_path(request: OnboardingIn) -> str:
    registry = registry_or_503()
    path_ids = {str(item.get("id")) for item in registry.paths}
    text = f"{request.learning_goal} {request.primary_interest}".lower()
    candidates = []
    if "risk" in text:
        candidates.append("path-risk-management")
    if "technical" in text or "chart" in text:
        candidates.append("path-technical-analysis")
    if "trad" in text:
        candidates.append("path-trading-foundations")
    candidates.append("path-finance-foundations")
    return next((item for item in candidates if item in path_ids), next(iter(path_ids)))


@router.post("/onboarding", response_model=OnboardingRead)
def complete_onboarding(
    request: OnboardingIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OnboardingProfile:
    recommended_path_id = _recommend_path(request)
    record = db.get(OnboardingProfile, user.id)
    values = request.model_dump()
    values["recommended_path_id"] = recommended_path_id
    if record is None:
        record = OnboardingProfile(user_id=user.id, **values)
        db.add(record)
    else:
        for field, value in values.items():
            setattr(record, field, value)
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == user.id, Enrollment.path_id == recommended_path_id
        )
    )
    if enrollment is None:
        db.add(Enrollment(user_id=user.id, path_id=recommended_path_id))
    db.commit()
    db.refresh(record)
    return record
