#!/usr/bin/env sh
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VALIDATION_DIR=$(mktemp -d "${TMPDIR:-/tmp}/borza-academy-validation.XXXXXX")
trap 'rm -rf -- "$VALIDATION_DIR"' EXIT HUP INT TERM
VALIDATION_DATABASE_URL="sqlite:///$VALIDATION_DIR/borza-academy.db"

cd "$REPO_ROOT"
python "$REPO_ROOT/scripts/validate_academy_content.py"
python -m unittest scripts.test_validate_academy_content

cd "$REPO_ROOT/backend"
python -m ruff format --check .
python -m ruff check .
python -m mypy app
POSTGRES_TEST_DATABASE_URL= \
  ENVIRONMENT=test \
  ACADEMY_ALLOW_DEMO_AUTH=true \
  DATABASE_URL="$VALIDATION_DATABASE_URL" \
  MIGRATION_DATABASE_URL="$VALIDATION_DATABASE_URL" \
  python -m pytest --cov=app --cov-report=term-missing
python -m pytest "$REPO_ROOT/premium/ai-trading-bot/tests" -q
ENVIRONMENT=test \
  ACADEMY_ALLOW_DEMO_AUTH=true \
  DATABASE_URL="$VALIDATION_DATABASE_URL" \
  MIGRATION_DATABASE_URL="$VALIDATION_DATABASE_URL" \
  python -m alembic upgrade head
ENVIRONMENT=test \
  ACADEMY_ALLOW_DEMO_AUTH=true \
  DATABASE_URL="$VALIDATION_DATABASE_URL" \
  MIGRATION_DATABASE_URL="$VALIDATION_DATABASE_URL" \
  python -m alembic current
ENVIRONMENT=test \
  ACADEMY_ALLOW_DEMO_AUTH=true \
  DATABASE_URL="$VALIDATION_DATABASE_URL" \
  MIGRATION_DATABASE_URL="$VALIDATION_DATABASE_URL" \
  python -m alembic check

cd "$REPO_ROOT/frontend"
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
BORZA_STRICT_PUBLIC_ENV=true \
  NEXT_PUBLIC_API_URL=https://api.example.invalid \
  NEXT_PUBLIC_SUPABASE_URL= \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= \
  npm run build
npm run test:e2e
npm audit --omit=dev

cd "$REPO_ROOT"
: "${POSTGRES_PASSWORD:=compose-config-validation-only}"
export POSTGRES_PASSWORD
docker compose config --quiet
git diff --check
