from datetime import UTC, datetime

from app.providers.base import NewsProvider, NormalizedArticle, ProviderFetchResult
from app.providers.composite import CompositeNewsProvider
from app.providers.demo import DemoNewsProvider
from app.providers.fallback import FallbackNewsProvider
from app.providers.finnhub import FinnhubNewsProvider
from app.providers.gdelt import GdeltNewsProvider
from app.providers.marketaux import MarketauxNewsProvider
from app.providers.opennews import OpenNewsProvider
from app.providers.rss import RSSNewsProvider


class UnavailableNewsProvider(NewsProvider):
    """Fail a persisted provider job when its required credential disappeared."""

    def __init__(self, name: str, error: str):
        self.name = name
        self.error = error

    async def fetch_market_news(self) -> ProviderFetchResult:
        current = datetime.now(UTC)
        return ProviderFetchResult(
            records=[],
            request_count=0,
            failed_groups=(self.name,),
            errors=(self.error,),
            provider_started_at=current,
            provider_completed_at=current,
            raw_record_count=0,
        )

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        return None


def effective_provider_name(settings) -> str:
    """Return the provider that a queued job will initially execute."""

    provider_name = getattr(settings, "news_provider", "composite")
    if getattr(settings, "demo_mode", False) or provider_name == "demo":
        return "demo"
    if provider_name == "opennews" and not getattr(settings, "opennews_token", None):
        return "demo"
    if provider_name == "finnhub" and not getattr(settings, "finnhub_api_key", None):
        return "gdelt"
    return provider_name


def build_news_provider(settings, *, provider_name: str | None = None):
    selected = provider_name or effective_provider_name(settings)
    if selected == "demo":
        return DemoNewsProvider()
    if selected == "gdelt":
        return GdeltNewsProvider(
            base_url=settings.gdelt_base_url,
            request_timeout_seconds=settings.gdelt_request_timeout_seconds,
            max_retries=settings.gdelt_max_retries,
            request_delay_seconds=settings.gdelt_request_delay_seconds,
            max_records=settings.gdelt_max_records,
            default_lookback_hours=settings.gdelt_default_lookback_hours,
            query_groups=settings.gdelt_query_group_list,
        )
    if selected == "marketaux":
        if not settings.marketaux_api_token:
            return UnavailableNewsProvider(
                "marketaux",
                "The queued Marketaux job cannot run because MARKETAUX_API_TOKEN is unavailable.",
            )
        return MarketauxNewsProvider(
            settings.marketaux_api_token,
            base_url=settings.marketaux_base_url,
            request_timeout_seconds=settings.marketaux_request_timeout_seconds,
            countries=settings.marketaux_countries,
            languages=settings.marketaux_languages,
            article_limit=settings.marketaux_article_limit,
            default_lookback_hours=settings.marketaux_default_lookback_hours,
        )
    if selected == "composite":
        providers: list[NewsProvider] = []
        for name in settings.active_composite_provider_list:
            if name == "rss":
                providers.append(RSSNewsProvider())
            elif name == "gdelt":
                providers.append(build_news_provider(settings, provider_name="gdelt"))
            elif name == "marketaux":
                providers.append(build_news_provider(settings, provider_name="marketaux"))
            elif name == "opennews" and settings.opennews_token:
                providers.append(
                    OpenNewsProvider(
                        api_token=settings.opennews_token,
                        api_base=settings.opennews_api_base,
                        fetch_limit=settings.opennews_fetch_limit,
                    )
                )
            elif name == "finnhub" and settings.finnhub_api_key:
                providers.append(FinnhubNewsProvider(settings.finnhub_api_key))
        return CompositeNewsProvider(providers)
    if selected == "opennews":
        if not settings.opennews_token:
            return UnavailableNewsProvider(
                "opennews",
                "The queued OpenNews job cannot run because OPENNEWS_TOKEN is unavailable.",
            )
        return FallbackNewsProvider(
            OpenNewsProvider(
                api_token=settings.opennews_token,
                api_base=settings.opennews_api_base,
                fetch_limit=settings.opennews_fetch_limit,
            ),
            DemoNewsProvider(),
            allow_demo_fallback=True,
        )
    if selected == "rss":
        return RSSNewsProvider()
    if selected == "finnhub":
        if not settings.finnhub_api_key:
            return UnavailableNewsProvider(
                "finnhub",
                "The queued Finnhub job cannot run because FINNHUB_API_KEY is unavailable.",
            )
        return FinnhubNewsProvider(settings.finnhub_api_key)
    # A missing configured credential must not silently inject demo data.
    return GdeltNewsProvider(
        base_url=settings.gdelt_base_url,
        request_timeout_seconds=settings.gdelt_request_timeout_seconds,
        max_retries=settings.gdelt_max_retries,
        request_delay_seconds=settings.gdelt_request_delay_seconds,
        max_records=settings.gdelt_max_records,
        default_lookback_hours=settings.gdelt_default_lookback_hours,
        query_groups=settings.gdelt_query_group_list,
    )
