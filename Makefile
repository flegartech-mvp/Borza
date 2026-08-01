.PHONY: dev backend worker scheduler frontend install test test-integration lint format-check build validate migrate seed
dev:
	docker compose up --build
backend:
	cd backend && uvicorn app.main:app --reload
worker:
	cd backend && python -m app.workers.ingestion_worker
scheduler:
	cd backend && python -m app.scheduler
frontend:
	cd frontend && npm run dev
install:
	cd backend && python -m pip install -r requirements-dev.txt
	cd frontend && npm ci
test:
	cd backend && python -m pytest --cov=app --cov-report=term-missing
	cd frontend && npm run test:coverage
test-integration:
	docker compose -f docker-compose.test.yml --profile integration up --build --abort-on-container-exit --exit-code-from backend-postgres-test backend-postgres-test
lint:
	cd backend && python -m ruff check .
	cd frontend && npm run lint
format-check:
	cd backend && python -m ruff format --check .
	cd frontend && npm run format:check
build:
	cd frontend && npm run typecheck
	cd frontend && npm run build
validate:
	powershell -ExecutionPolicy Bypass -File scripts/validate.ps1
migrate:
	cd backend && python -m alembic upgrade head
seed:
	cd backend && python -m app.seed
