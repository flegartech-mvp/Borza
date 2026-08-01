import logging
from datetime import UTC, datetime

from app.providers.base import (
    NewsProvider,
    NormalizedArticle,
    ProviderFetchResult,
    sanitized_provider_error,
)

logger = logging.getLogger(__name__)


class FallbackNewsProvider(NewsProvider):
    """Optional demo fallback, deliberately disabled unless explicitly enabled."""

    def __init__(
        self, primary: NewsProvider, fallback: NewsProvider, *, allow_demo_fallback: bool = False
    ):
        self.primary = primary
        self.fallback = fallback
        self.allow_demo_fallback = allow_demo_fallback
        self.name = primary.name

    async def fetch_market_news(self) -> ProviderFetchResult:
        primary_error = ""
        primary_result: ProviderFetchResult | None = None
        try:
            primary_result = await self.primary.fetch_market_news()
            self.name = self.primary.name
            if primary_result.status != "failed" or not self.allow_demo_fallback:
                return primary_result
            primary_error = "; ".join(primary_result.errors) or "Primary provider failed."
        except Exception as exc:
            if not self.allow_demo_fallback:
                raise
            logger.warning(
                "%s provider failed; using %s fallback: %s",
                self.primary.name,
                self.fallback.name,
                exc,
            )
            primary_error = sanitized_provider_error(exc)
            self.name = self.fallback.name
        fallback_started_at = datetime.now(UTC)
        result = await self.fallback.fetch_market_news()
        return ProviderFetchResult(
            records=result.records,
            request_count=result.request_count
            + (primary_result.request_count if primary_result else 1),
            successful_groups=result.successful_groups,
            failed_groups=(
                *(primary_result.failed_groups if primary_result else (self.primary.name,)),
                *result.failed_groups,
            ),
            saturated_groups=result.saturated_groups,
            malformed_record_count=result.malformed_record_count
            + (primary_result.malformed_record_count if primary_result else 0),
            retry_count=result.retry_count + (primary_result.retry_count if primary_result else 0),
            warnings=(
                f"{self.primary.name} failed; {self.fallback.name} fallback was used.",
                *result.warnings,
            ),
            errors=(
                *(primary_result.errors if primary_result else ()),
                f"{self.primary.name}: {primary_error[:400]}",
                *result.errors,
            ),
            provider_started_at=(
                primary_result.provider_started_at if primary_result else fallback_started_at
            ),
            provider_completed_at=result.provider_completed_at,
            raw_record_count=result.raw_record_count,
        )

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        return self.primary.normalize_article(payload)
