# Borza Production Deployment Runbook

This guide covers operational setup, local environment startup, database migrations, service lifecycle management, and monitoring for the Borza platform.

---

## Architecture Overview

Borza consists of 6 primary services:
1. **Frontend**: Next.js 16 (React 19) application (`frontend/`).
2. **Backend API**: FastAPI application (`backend/app/main.py`).
3. **Database**: PostgreSQL 16 relational store with Alembic schema management.
4. **Cache & Event Bus**: Valkey (Redis-compatible) event bus and distributed rate limiter.
5. **Ingestion Worker**: Background Python worker (`backend/app/workers/ingestion_worker.py`).
6. **Ingestion Scheduler**: Background cron scheduler (`backend/app/scheduler.py`).

---

## 1. Environment Configuration

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

### Essential Environment Variables

```env
# Database Configuration
DATABASE_URL=postgresql+psycopg://postgres:secretpassword@localhost:5432/marketpulse
MIGRATION_DATABASE_URL=postgresql+psycopg://postgres:secretpassword@localhost:5432/marketpulse
POSTGRES_PASSWORD=secretpassword

# Cache & Event Bus
EVENT_BUS_URL=redis://localhost:6379/0

# Runtime Environment
ENVIRONMENT=production
DEMO_MODE=false
NEWS_PROVIDER=gdelt

# Security & CORS
ALLOWED_HOSTS=localhost,127.0.0.1,backend
CORS_ORIGINS=http://localhost:3000

# Public Frontend URLs
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/news
```

---

## 2. Docker Compose Deployment (Recommended)

### Start Services

```bash
docker compose up -d
```

### Check Service Status & Logs

```bash
# Check running containers
docker compose ps

# Inspect API logs
docker compose logs -f backend

# Inspect Worker logs
docker compose logs -f worker
```

---

## 3. Database Schema Migrations

Schema migrations are managed by Alembic.

### Running Migrations Manually

```bash
cd backend
python -m alembic upgrade head
```

### Checking Migration Status

```bash
python -m alembic current
python -m alembic check
```

---

## 4. Operational Health & Diagnostics

### Healthcheck Endpoints

- **Process Liveness**: `GET /live` -> Returns `{"status": "alive"}`
- **Dependency Readiness**: `GET /ready` -> Checks database connectivity and WebSocket state. Returns `200 OK` or `503 Service Unavailable`.
- **Operational Health (SLAs)**: `GET /api/health/operational` -> Validates worker freshness, scheduler freshness, and job queue staleness.

### Example Health Check Query

```bash
curl -s http://localhost:8000/api/health/operational | jq .
```

Expected Response:
```json
{
  "status": "healthy",
  "worker_fresh": true,
  "scheduler_fresh": true,
  "last_ingestion_age_seconds": 120.4,
  "oldest_queued_job_age_seconds": null,
  "failed_jobs_count": 0,
  "worker_status": "ready",
  "scheduler_status": "ready",
  "timestamp": "2026-08-01T11:45:00Z"
}
```

---

## 5. Troubleshooting & Maintenance

### Clearing Worker Leases & Stale Heartbeats

If a worker crashes unexpectedly, stale heartbeats are automatically pruned by the retention policy (`cleanup_stale_heartbeats`). To trigger cleanup manually:

```bash
cd backend
python -c "from app.database import SessionLocal; from app.services.ingestion_queue import cleanup_stale_heartbeats; db = SessionLocal(); print(cleanup_stale_heartbeats(db)); db.close()"
```

### Resetting News Ingestion Queue

```bash
python -m app.cli.healthcheck
```
