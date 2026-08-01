import asyncio
import hashlib
import inspect
import re
from collections import defaultdict
from contextlib import suppress
from datetime import UTC, datetime, timedelta

from rapidfuzz.fuzz import ratio

from app.providers.base import (
    NewsProvider,
    NormalizedArticle,
    ProviderFetchResult,
    sanitized_provider_error,
)
from app.services.deduplication import normalized_url


def _title_key(title: str) -> str:
    return " ".join(re.sub(r"[^\w\s]", " ", title.lower()).split())


def _quality_key(article: NormalizedArticle) -> tuple[int, int, int, str]:
    official = article.source_type in {"official", "regulator", "exchange"}
    return (
        int(official),
        article.trust_score,
        article.relevance_score,
        article.external_id,
    )


def _same_story(first: NormalizedArticle, second: NormalizedArticle) -> bool:
    first_title = _title_key(first.title)
    second_title = _title_key(second.title)
    if first_title == second_title:
        return True
    if not first_title or not second_title or first_title.split()[0] != second_title.split()[0]:
        return False
    if abs(first.published_at - second.published_at) > timedelta(hours=36):
        return False
    first_words = set(first_title.split())
    second_words = set(second_title.split())
    overlap = len(first_words & second_words) / max(len(first_words | second_words), 1)
    return overlap >= 0.65 and ratio(first_title, second_title) >= 92


def _alternative(article: NormalizedArticle) -> dict[str, str]:
    return {
        "provider": article.provider or "unknown",
        "source": article.source,
        "url": article.article_url,
        "source_type": article.source_type,
    }


def merge_provider_articles(records: list[NormalizedArticle]) -> list[NormalizedArticle]:
    """Merge bounded provider batches without all-history pairwise comparisons."""

    representatives: list[NormalizedArticle] = []
    canonical_index: dict[str, NormalizedArticle] = {}
    title_index: dict[str, NormalizedArticle] = {}
    candidate_buckets: dict[tuple[str, str], list[NormalizedArticle]] = defaultdict(list)

    for article in sorted(records, key=_quality_key, reverse=True):
        canonical = normalized_url(article.canonical_url or article.article_url)
        title = _title_key(article.title)
        day_key = article.published_at.astimezone(UTC).date().isoformat()
        first_word = title.split()[0] if title else ""
        duplicate = canonical_index.get(canonical) or title_index.get(title)
        if duplicate is None and first_word:
            duplicate = next(
                (
                    candidate
                    for candidate in candidate_buckets[(day_key, first_word)]
                    if _same_story(candidate, article)
                ),
                None,
            )

        if duplicate is not None:
            alternative = _alternative(article)
            if (
                alternative["url"] != duplicate.article_url
                and alternative not in duplicate.alternative_sources
            ):
                duplicate.alternative_sources.append(alternative)
            duplicate.categories = sorted(set(duplicate.categories) | set(article.categories))
            duplicate.organizations = sorted(
                set(duplicate.organizations) | set(article.organizations)
            )
            duplicate.companies = sorted(set(duplicate.companies) | set(article.companies))
            duplicate.asset_classes = sorted(
                set(duplicate.asset_classes) | set(article.asset_classes)
            )
            duplicate.relevance_score = min(
                100,
                max(duplicate.relevance_score, article.relevance_score)
                + min(len(duplicate.alternative_sources) * 2, 10),
            )
            duplicate.duplicate_count += article.duplicate_count
            duplicate.duplicate_group_id = (
                duplicate.duplicate_group_id
                or hashlib.sha256(f"{canonical}|{title}".encode()).hexdigest()[:32]
            )
            continue

        article.canonical_url = canonical
        article.original_url = article.original_url or article.article_url
        representatives.append(article)
        canonical_index[canonical] = article
        title_index[title] = article
        candidate_buckets[(day_key, first_word)].append(article)

    return representatives


class CompositeNewsProvider(NewsProvider):
    name = "composite"

    def __init__(self, providers: list[NewsProvider]):
        if not providers:
            raise ValueError("CompositeNewsProvider requires at least one provider")
        self.providers = providers

    async def _fetch_one(self, provider: NewsProvider, **kwargs) -> tuple[str, ProviderFetchResult]:
        started_at = datetime.now(UTC)
        try:
            signature = inspect.signature(provider.fetch_market_news)
            supported = {key: value for key, value in kwargs.items() if key in signature.parameters}
            result = await provider.fetch_market_news(**supported)
            return provider.name, result
        except Exception as exc:
            completed_at = datetime.now(UTC)
            return provider.name, ProviderFetchResult(
                records=[],
                request_count=0,
                failed_groups=(provider.name,),
                errors=(sanitized_provider_error(exc),),
                provider_started_at=started_at,
                provider_completed_at=completed_at,
                raw_record_count=0,
            )
        finally:
            close = getattr(provider, "aclose", None)
            if close is not None:
                with suppress(Exception):
                    await close()

    async def fetch_market_news(self, **kwargs) -> ProviderFetchResult:
        started_at = datetime.now(UTC)
        results = await asyncio.gather(
            *(self._fetch_one(provider, **kwargs) for provider in self.providers)
        )
        records: list[NormalizedArticle] = []
        successful: list[str] = []
        failed: list[str] = []
        saturated: list[str] = []
        warnings: list[str] = []
        errors: list[str] = []
        request_count = malformed = retries = raw_count = 0

        for provider_name, result in results:
            records.extend(result.records)
            request_count += result.request_count
            malformed += result.malformed_record_count
            retries += result.retry_count
            raw_count += result.raw_record_count or len(result.records)
            successful.extend(f"{provider_name}:{item}" for item in result.successful_groups)
            failed.extend(f"{provider_name}:{item}" for item in result.failed_groups)
            saturated.extend(f"{provider_name}:{item}" for item in result.saturated_groups)
            warnings.extend(f"{provider_name}: {item}" for item in result.warnings)
            errors.extend(f"{provider_name}: {item}" for item in result.errors)

        return ProviderFetchResult(
            records=merge_provider_articles(records),
            request_count=request_count,
            successful_groups=tuple(successful),
            failed_groups=tuple(failed),
            saturated_groups=tuple(saturated),
            malformed_record_count=malformed,
            retry_count=retries,
            warnings=tuple(warnings),
            errors=tuple(errors),
            provider_started_at=started_at,
            provider_completed_at=datetime.now(UTC),
            raw_record_count=raw_count,
        )

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        return None
