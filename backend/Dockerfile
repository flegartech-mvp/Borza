FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv

RUN python -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /build
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

FROM builder AS test

WORKDIR /app
COPY backend/requirements.txt backend/requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY backend/pyproject.toml backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY backend/app ./app
COPY backend/tests ./tests
COPY content /content

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

CMD ["python", "-m", "pytest"]

FROM python:3.12-slim AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production

RUN groupadd --system --gid 10001 borza \
    && useradd --system --uid 10001 --gid borza --home-dir /app borza

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=borza:borza backend/alembic ./alembic
COPY --chown=borza:borza backend/alembic.ini ./
COPY --chown=borza:borza backend/app ./app
COPY --chown=borza:borza content /content

USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/live', timeout=2).read()"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--timeout-keep-alive", "5", "--no-access-log"]
