"""normalize article tickers

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-29
"""

import json

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

_REDUNDANT_ARTICLE_INDEXES = (
    "ix_articles_content_hash",
    "ix_articles_external_id",
)


def _normalized_tickers(article_id: int, raw_value: object) -> list[str]:
    value = raw_value
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Article {article_id} has invalid ticker JSON; expected an array of strings"
            ) from exc
    if not isinstance(value, list):
        raise RuntimeError(
            f"Article {article_id} has invalid ticker JSON; expected an array of strings"
        )

    symbols: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            raise RuntimeError(
                f"Article {article_id} has a non-string ticker; repair articles.tickers "
                "before retrying the migration"
            )
        symbol = item.strip().upper().lstrip("$")
        if not symbol:
            raise RuntimeError(
                f"Article {article_id} has a blank ticker; repair articles.tickers "
                "before retrying the migration"
            )
        if len(symbol) > 12:
            raise RuntimeError(
                f"Article {article_id} has an overlength ticker; repair articles.tickers "
                "before retrying the migration"
            )
        symbols.add(symbol)
    return sorted(symbols)


def _article_batches(bind, articles, *, batch_size: int = 1000):
    last_id: int | None = None
    while True:
        query = (
            sa.select(articles.c.id, articles.c.tickers).order_by(articles.c.id).limit(batch_size)
        )
        if last_id is not None:
            query = query.where(articles.c.id > last_id)
        rows = bind.execute(query).all()
        if not rows:
            return
        yield rows
        last_id = rows[-1].id


def _drop_redundant_article_indexes(bind) -> None:
    existing = {index["name"] for index in sa.inspect(bind).get_indexes("articles")}
    for name in _REDUNDANT_ARTICLE_INDEXES:
        if name in existing:
            op.drop_index(name, table_name="articles")


def upgrade() -> None:
    bind = op.get_bind()
    articles = sa.table(
        "articles",
        sa.column("id", sa.Integer()),
        sa.column("tickers", sa.JSON()),
    )

    # Validate before changing schema so malformed legacy data cannot be lost silently.
    expected_rows = 0
    for rows in _article_batches(bind, articles):
        for row in rows:
            expected_rows += len(_normalized_tickers(row.id, row.tickers))

    op.create_table(
        "article_tickers",
        sa.Column(
            "article_id",
            sa.Integer(),
            sa.ForeignKey("articles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ticker", sa.String(length=12), nullable=False),
        sa.PrimaryKeyConstraint("article_id", "ticker", name="pk_article_tickers"),
        sa.CheckConstraint(
            "ticker = upper(trim(ticker))",
            name="ck_article_tickers_canonical",
        ),
        sa.CheckConstraint(
            "length(ticker) BETWEEN 1 AND 12",
            name="ck_article_tickers_length",
        ),
    )
    op.create_index(
        "ix_article_tickers_ticker_article_id",
        "article_tickers",
        ["ticker", "article_id"],
    )

    article_tickers = sa.table(
        "article_tickers",
        sa.column("article_id", sa.Integer()),
        sa.column("ticker", sa.String(length=12)),
    )
    inserted_rows = 0
    for rows in _article_batches(bind, articles):
        batch = [
            {"article_id": row.id, "ticker": symbol}
            for row in rows
            for symbol in _normalized_tickers(row.id, row.tickers)
        ]
        if batch:
            bind.execute(article_tickers.insert(), batch)
            inserted_rows += len(batch)
    if inserted_rows != expected_rows:
        raise RuntimeError(
            "Article ticker backfill count changed during migration; stop writers and retry"
        )
    stored_rows = bind.scalar(sa.select(sa.func.count()).select_from(article_tickers)) or 0
    if stored_rows != expected_rows:
        raise RuntimeError("Article ticker backfill verification failed")

    _drop_redundant_article_indexes(bind)


def downgrade() -> None:
    op.drop_index(
        "ix_article_tickers_ticker_article_id",
        table_name="article_tickers",
    )
    op.drop_table("article_tickers")

    bind = op.get_bind()
    existing = {index["name"] for index in sa.inspect(bind).get_indexes("articles")}
    for name, column in (
        ("ix_articles_content_hash", "content_hash"),
        ("ix_articles_external_id", "external_id"),
    ):
        if name not in existing:
            op.create_index(name, "articles", [column])
