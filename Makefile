.PHONY: dev backend frontend install test test-integration lint format-check typecheck build validate migrate content-check

dev:
	docker compose up --build
backend:
	cd backend && uvicorn app.main:app --reload
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
typecheck:
	cd backend && python -m mypy app
	cd frontend && npm run typecheck
build:
	cd frontend && npm run build
content-check:
	python scripts/validate_academy_content.py
	python -m unittest scripts.test_validate_academy_content
validate:
	powershell -ExecutionPolicy Bypass -File scripts/validate.ps1
migrate:
	cd backend && python -m alembic upgrade head
