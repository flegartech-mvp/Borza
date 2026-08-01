"""Generic RSS / Atom news provider for free official first-party sources.

Includes strict SSRF protection (IP validation, scheme restrictions, redirect protection).
"""

import hashlib
import html
import ipaddress
import logging
import re
import socket
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse

import httpx

from app.providers.base import (
    NewsProvider,
    NormalizedArticle,
    ProviderFetchResult,
    normalized_http_url,
    normalized_source_country,
    sanitized_provider_error,
)
from app.services.deduplication import normalized_url
from app.version import __version__

logger = logging.getLogger(__name__)


class RSSProviderError(RuntimeError):
    """Raised when an RSS feed fetch or validation fails."""


class SSRFVulnerabilityError(ValueError):
    """Raised when a configured RSS feed target violates SSRF security boundaries."""


def is_safe_ip(ip_str: str) -> bool:
    """Validate that an IP address is not private, loopback, link-local, or cloud metadata."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
        # Specific check for AWS / GCP / Azure metadata endpoint
        if str(ip) == "169.254.169.254":
            return False
        return True
    except ValueError:
        return False


def validate_safe_url(url: str, allowlist_domains: set[str] | None = None) -> str:
    """Enforce strict SSRF rules on external feed URLs."""
    if not url or not isinstance(url, str):
        raise SSRFVulnerabilityError("URL must be a non-empty string")

    parsed = urlparse(url.strip())
    if parsed.scheme.lower() not in {"http", "https"}:
        raise SSRFVulnerabilityError(f"Disallowed URL scheme: {parsed.scheme}")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFVulnerabilityError("URL missing hostname")

    hostname_lower = hostname.lower()
    if hostname_lower in {"localhost", "127.0.0.1", "::1", "metadata.google.internal"}:
        raise SSRFVulnerabilityError("Localhost or metadata domain explicitly blocked")

    if allowlist_domains and hostname_lower not in allowlist_domains:
        raise SSRFVulnerabilityError(f"Domain {hostname_lower} is not in the explicit allowlist")

    # Resolve IP address to prevent DNS rebinding / private IP targeting
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for _, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            if not is_safe_ip(ip_str):
                raise SSRFVulnerabilityError(f"URL resolves to disallowed IP address: {ip_str}")
    except socket.gaierror as exc:
        raise SSRFVulnerabilityError(f"Failed to resolve host {hostname}") from exc

    return url.strip()


@dataclass(frozen=True)
class RSSFeedConfig:
    display_name: str
    feed_url: str
    source_id: str = ""
    source_type: str = "official"
    country: str = "US"
    region: str = "global"
    language: str = "en"
    category: str = "macro"
    trust_tier: int = 90
    refresh_interval_seconds: int = 1800
    enabled: bool = True


DEFAULT_OFFICIAL_FEEDS: list[RSSFeedConfig] = [
    RSSFeedConfig(
        display_name="European Central Bank Press Releases",
        feed_url="https://www.ecb.europa.eu/rss/press.html",
        source_id="ecb-press",
        source_type="official",
        country="EU",
        region="europe",
        language="en",
        category="central_banks",
        trust_tier=100,
    ),
    RSSFeedConfig(
        display_name="SEC News & Press Releases",
        feed_url="https://www.sec.gov/news/pressreleases.rss",
        source_id="sec-press",
        source_type="regulator",
        country="US",
        region="north_america",
        language="en",
        category="regulation",
        trust_tier=100,
    ),
    RSSFeedConfig(
        display_name="Ministrstvo za finance Republike Slovenije",
        feed_url="https://www.gov.si/novice/rss/?orgID%5B0%5D=24",
        source_id="gov-si-finance",
        source_type="official",
        country="SI",
        region="europe",
        language="sl",
        category="slovenian_economy",
        trust_tier=100,
    ),
]


class RSSNewsProvider(NewsProvider):
    name = "rss"

    def __init__(
        self,
        *,
        feeds: list[RSSFeedConfig] | None = None,
        request_timeout_seconds: float = 15.0,
        transport: httpx.AsyncBaseTransport | None = None,
        allowlist_domains: set[str] | None = None,
    ):
        self.feeds = feeds or DEFAULT_OFFICIAL_FEEDS
        self.request_timeout_seconds = request_timeout_seconds
        self.transport = transport
        self.allowlist_domains = allowlist_domains
        self.user_agent = f"Borza/{__version__} (+https://github.com/borza/borza)"
        self._client: httpx.AsyncClient | None = None
        self._validators: dict[str, dict[str, str]] = {}

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.request_timeout_seconds),
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
                headers={
                    "User-Agent": self.user_agent,
                    "Accept": "application/xml, text/xml, application/atom+xml",
                },
                transport=self.transport,
                follow_redirects=False,  # Enforce manual redirect SSRF verification
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def fetch_market_news(
        self,
        *,
        start_datetime: datetime | None = None,
        end_datetime: datetime | None = None,
        max_articles: int | None = None,
    ) -> ProviderFetchResult:
        started_at = datetime.now(UTC)
        records: list[NormalizedArticle] = []
        successful_groups: list[str] = []
        failed_groups: list[str] = []
        errors: list[str] = []
        request_count = 0
        raw_record_count = 0

        client = await self.get_client()

        for feed in self.feeds:
            if not feed.enabled:
                continue
            request_count += 1
            try:
                safe_url = validate_safe_url(
                    feed.feed_url, allowlist_domains=self.allowlist_domains
                )
                response = await client.get(safe_url, headers=self._validators.get(safe_url))

                # Check for redirects manually to protect against open redirects
                if response.status_code in (301, 302, 303, 307, 308):
                    redirect_target = response.headers.get("Location")
                    if not redirect_target:
                        raise RSSProviderError("Redirect response missing Location header")
                    safe_url = validate_safe_url(
                        urljoin(safe_url, redirect_target),
                        allowlist_domains=self.allowlist_domains,
                    )
                    response = await client.get(safe_url)

                if response.status_code == 304:
                    successful_groups.append(feed.display_name)
                    continue
                response.raise_for_status()
                validators = {
                    key: value
                    for key, value in {
                        "If-None-Match": response.headers.get("ETag"),
                        "If-Modified-Since": response.headers.get("Last-Modified"),
                    }.items()
                    if value
                }
                if validators:
                    self._validators[safe_url] = validators
                feed_articles = self.parse_feed_xml(response.text, feed)
                raw_record_count += len(feed_articles)
                if start_datetime is not None:
                    start = self._as_utc(start_datetime)
                    feed_articles = [
                        article for article in feed_articles if article.published_at >= start
                    ]
                if end_datetime is not None:
                    end = self._as_utc(end_datetime)
                    feed_articles = [
                        article for article in feed_articles if article.published_at <= end
                    ]
                records.extend(feed_articles)
                successful_groups.append(feed.display_name)
            except Exception as exc:
                failed_groups.append(feed.display_name)
                sanitized_msg = sanitized_provider_error(exc)
                errors.append(f"{feed.display_name}: {sanitized_msg}")
                logger.warning("RSS feed fetch failed (%s): %s", feed.display_name, sanitized_msg)

        records.sort(key=lambda article: article.published_at, reverse=True)
        if max_articles is not None:
            records = records[: max(0, max_articles)]

        return ProviderFetchResult(
            records=records,
            request_count=request_count,
            successful_groups=tuple(successful_groups),
            failed_groups=tuple(failed_groups),
            errors=tuple(errors),
            provider_started_at=started_at,
            provider_completed_at=datetime.now(UTC),
            raw_record_count=raw_record_count,
        )

    def parse_feed_xml(
        self, xml_content: str, feed_config: RSSFeedConfig
    ) -> list[NormalizedArticle]:
        articles: list[NormalizedArticle] = []
        try:
            root = ET.fromstring(xml_content)
        except ET.ParseError as exc:
            raise RSSProviderError("Invalid RSS/Atom XML format") from exc

        # Collect elements by local tag name ignoring XML namespaces
        for elem in root.iter():
            tag = elem.tag.split("}")[-1].lower() if "}" in elem.tag else elem.tag.lower()
            if tag == "item":
                article = self._parse_rss_item(elem, feed_config)
                if article:
                    articles.append(article)
            elif tag == "entry":
                article = self._parse_atom_entry(elem, feed_config)
                if article:
                    articles.append(article)

        return articles

    def _parse_rss_item(self, item: ET.Element, feed: RSSFeedConfig) -> NormalizedArticle | None:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date_raw = item.findtext("pubDate") or item.findtext("dc:date") or ""

        if not title or not link:
            return None

        article_url = normalized_http_url(link)
        if not article_url:
            return None
        canonical_url = normalized_url(article_url)

        published_at = self._parse_datetime(pub_date_raw) or datetime.now(UTC)
        description = self._clean_summary(
            item.findtext("description") or item.findtext("summary") or ""
        )

        provider_article_id = hashlib.sha256(
            f"{canonical_url}:{published_at.isoformat()}".encode()
        ).hexdigest()

        return NormalizedArticle(
            external_id=f"rss:{provider_article_id}",
            provider="rss",
            provider_article_id=provider_article_id,
            provider_payload_version="rss-2.0",
            title=title[:500],
            description=description[:2000],
            article_url=article_url,
            source=feed.display_name[:120],
            published_at=published_at,
            source_id=feed.source_id or None,
            source_domain=urlparse(article_url).hostname,
            source_type=feed.source_type,
            canonical_url=canonical_url,
            original_url=article_url,
            language=feed.language,
            source_country=normalized_source_country(feed.country),
            region=feed.region,
            categories=[feed.category],
            organizations=[feed.display_name],
            trust_score=feed.trust_tier,
            relevance_score=80 if feed.country in {"SI", "EU"} else 70,
            relevance_reason="Verified first-party financial publication",
        )

    def _parse_atom_entry(self, entry: ET.Element, feed: RSSFeedConfig) -> NormalizedArticle | None:
        children = {elem.tag.split("}")[-1].lower(): elem for elem in entry}
        title = (
            children.get("title").text
            if children.get("title") is not None and children.get("title").text
            else ""
        ).strip()

        link_elem = children.get("link")
        link = ""
        if link_elem is not None:
            link = link_elem.attrib.get("href") or (link_elem.text or "").strip()

        pub_elem = (
            children.get("published")
            if children.get("published") is not None
            else children.get("updated")
        )
        pub_date_raw = (pub_elem.text if pub_elem is not None and pub_elem.text else "").strip()

        if not title or not link:
            return None

        article_url = normalized_http_url(link)
        if not article_url:
            return None
        canonical_url = normalized_url(article_url)

        published_at = self._parse_datetime(pub_date_raw) or datetime.now(UTC)
        description = self._clean_summary(
            entry.findtext("summary") or entry.findtext("content") or ""
        )

        provider_article_id = hashlib.sha256(
            f"{canonical_url}:{published_at.isoformat()}".encode()
        ).hexdigest()

        return NormalizedArticle(
            external_id=f"rss:{provider_article_id}",
            provider="rss",
            provider_article_id=provider_article_id,
            provider_payload_version="atom-1.0",
            title=title[:500],
            description=description[:2000],
            article_url=article_url,
            source=feed.display_name[:120],
            published_at=published_at,
            source_id=feed.source_id or None,
            source_domain=urlparse(article_url).hostname,
            source_type=feed.source_type,
            canonical_url=canonical_url,
            original_url=article_url,
            language=feed.language,
            source_country=normalized_source_country(feed.country),
            region=feed.region,
            categories=[feed.category],
            organizations=[feed.display_name],
            trust_score=feed.trust_tier,
            relevance_score=80 if feed.country in {"SI", "EU"} else 70,
            relevance_reason="Verified first-party financial publication",
        )

    def _parse_datetime(self, raw_str: str) -> datetime | None:
        if not raw_str or not raw_str.strip():
            return None
        try:
            parsed = parsedate_to_datetime(raw_str.strip())
            return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)
        except Exception:
            try:
                parsed = datetime.fromisoformat(raw_str.strip().replace("Z", "+00:00"))
                return (
                    parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)
                )
            except Exception:
                return None

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    @staticmethod
    def _clean_summary(value: str) -> str:
        plain = re.sub(r"<[^>]+>", " ", html.unescape(value))
        return " ".join(plain.split())[:2000]

    def normalize_article(self, payload: dict) -> NormalizedArticle | None:
        return None
