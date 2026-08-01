#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VALIDATION_DATABASE_DIRECTORY=$(mktemp -d "${TMPDIR:-/tmp}/borza-validation.XXXXXX")
trap 'rm -rf -- "$VALIDATION_DATABASE_DIRECTORY"' EXIT HUP INT TERM
VALIDATION_DATABASE_URL="sqlite:///$VALIDATION_DATABASE_DIRECTORY/borza-validation.db"

cd "$ROOT/backend"
python -m ruff format --check .
python -m ruff check .
POSTGRES_TEST_DATABASE_URL= \
  VALKEY_TEST_URL= \
  ENVIRONMENT=development \
  DATABASE_URL="$VALIDATION_DATABASE_URL" \
  MIGRATION_DATABASE_URL="$VALIDATION_DATABASE_URL" \
  python -m pytest --cov=app --cov-report=term-missing
POSTGRES_TEST_DATABASE_URL= \
  VALKEY_TEST_URL= \
  ENVIRONMENT=development \
  DATABASE_URL="$VALIDATION_DATABASE_URL" \
  MIGRATION_DATABASE_URL="$VALIDATION_DATABASE_URL" \
  python -m pytest "$ROOT/premium/ai-trading-bot/tests" -q
ENVIRONMENT=development \
  DATABASE_URL="$VALIDATION_DATABASE_URL" \
  MIGRATION_DATABASE_URL="$VALIDATION_DATABASE_URL" \
  python -m alembic upgrade head

cd "$ROOT/frontend"
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
BORZA_STRICT_PUBLIC_ENV=true \
  NEXT_PUBLIC_API_URL=https://api.example.invalid \
  NEXT_PUBLIC_WS_URL=wss://api.example.invalid/ws/news \
  npm run build
npm audit --omit=dev

cd "$ROOT"
: "${POSTGRES_PASSWORD:=compose-config-validation-only}"
export POSTGRES_PASSWORD
docker compose config --quiet
