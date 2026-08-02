from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.cli.data_retention import retention_report
from app.core.rate_limiter import RateLimiter, RateLimitMiddleware
from app.database import SessionLocal
from app.models.academy import ClassroomSession, PartnershipInterest


def test_request_models_reject_unexpected_mass_assignment_fields(client, auth_headers) -> None:
    response = client.put(
        "/api/v1/profile",
        headers=auth_headers,
        json={
            "display_name": "Learner",
            "locale": "en",
            "timezone": "Europe/Ljubljana",
            "role": "admin",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "extra_forbidden"


def test_host_cors_body_limit_and_security_headers(client, auth_headers) -> None:
    hostile_host = client.get("/live", headers={"Host": "attacker.example"})
    untrusted_cors = client.options(
        "/api/v1/catalog",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    oversized = client.put(
        "/api/v1/profile",
        headers={**auth_headers, "Content-Type": "application/json"},
        content=b'{"bio":"' + (b"a" * 270_000) + b'"}',
    )

    assert hostile_host.status_code == 400
    assert "access-control-allow-origin" not in untrusted_cors.headers
    assert oversized.status_code == 413
    assert oversized.json() == {"detail": "Request body is too large."}
    assert oversized.headers["x-content-type-options"] == "nosniff"


def test_sensitive_rate_limit_ignores_spoofed_forwarded_headers() -> None:
    app = FastAPI()
    app.add_middleware(
        RateLimitMiddleware,
        limiter=RateLimiter(100, max_clients=10),
        sensitive_limiter=RateLimiter(2, max_clients=10),
    )

    @app.post("/api/v1/partnership-interests")
    def endpoint() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app) as test_client:
        assert test_client.post("/api/v1/partnership-interests").status_code == 200
        assert test_client.post("/api/v1/partnership-interests").status_code == 200
        blocked = test_client.post(
            "/api/v1/partnership-interests",
            headers={"X-Forwarded-For": "203.0.113.99"},
        )

    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1


def test_classroom_join_has_a_separate_bounded_capacity_bucket() -> None:
    app = FastAPI()
    app.add_middleware(
        RateLimitMiddleware,
        limiter=RateLimiter(10, max_clients=10),
        sensitive_limiter=RateLimiter(2, max_clients=10),
        classroom_join_limiter=RateLimiter(3, max_clients=10),
    )

    @app.post("/api/v1/classrooms/join")
    def join() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app) as test_client:
        statuses = [test_client.post("/api/v1/classrooms/join").status_code for _ in range(4)]

    assert statuses == [200, 200, 200, 429]


def test_rate_limiter_bounds_client_memory() -> None:
    limiter = RateLimiter(requests_per_minute=10, max_clients=3)
    for index in range(10):
        assert limiter.is_allowed(f"192.0.2.{index}", now=100.0)[0]

    assert limiter.client_count == 3


def test_retention_command_is_dry_run_first_and_cascades_on_confirmation(
    client, teacher_auth_headers
) -> None:
    classroom = client.post(
        "/api/v1/teacher/classrooms",
        headers=teacher_auth_headers,
        json={
            "activity_type": "credit_comparison",
            "activity_id": "credit-total-cost",
            "content_version": "1.0",
            "duration_minutes": 45,
        },
    )
    interest = client.post(
        "/api/v1/partnership-interests",
        json={
            "kind": "teacher_pilot",
            "organisation": "Example School",
            "contact_role": "Teacher",
            "contact_email": "teacher@example.org",
            "message": "We want to evaluate the classroom workflow with a clear deletion policy.",
            "consent": True,
        },
    )
    assert classroom.status_code == 201
    assert interest.status_code == 202

    now = datetime.now(UTC)
    with SessionLocal() as db:
        classroom_record = db.get(ClassroomSession, UUID(classroom.json()["id"]))
        interest_record = db.get(PartnershipInterest, UUID(interest.json()["id"]))
        assert classroom_record is not None and interest_record is not None
        classroom_record.created_at = now - timedelta(days=40)
        classroom_record.expires_at = now - timedelta(days=39)
        interest_record.expires_at = now - timedelta(days=1)
        db.commit()

        dry_run = retention_report(db, now=now, classroom_retention_days=30, confirm=False)
        assert dry_run["mode"] == "dry-run"
        assert dry_run["classroom_sessions"] == 1
        assert dry_run["partnership_interests"] == 1
        assert db.scalar(select(func.count()).select_from(ClassroomSession)) == 1

        deleted = retention_report(db, now=now, classroom_retention_days=30, confirm=True)
        assert deleted["mode"] == "deleted"
        assert db.scalar(select(func.count()).select_from(ClassroomSession)) == 0
        assert db.scalar(select(func.count()).select_from(PartnershipInterest)) == 0
