import asyncio
from datetime import UTC, datetime

import httpx
import pytest

from app.providers.base import validate_normalized_article
from app.providers.rss import (
    RSSFeedConfig,
    RSSNewsProvider,
    SSRFVulnerabilityError,
    is_safe_ip,
    validate_safe_url,
)

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ECB Press Releases</title>
    <link>https://www.ecb.europa.eu</link>
    <description>Latest news from the ECB</description>
    <item>
      <title>ECB monetary policy decisions</title>
      <link>https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.pr260801.en.html</link>
      <description>The Governing Council decided to keep key interest rates unchanged.</description>
      <pubDate>Sat, 01 Aug 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>"""

SAMPLE_ATOM = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Banka Slovenije</title>
  <entry>
    <title>Gospodarska napoved za Slovenijo</title>
    <link href="https://www.bsi.si/objave/napoved-2026"/>
    <published>2026-08-01T09:00:00Z</published>
    <summary>Banka Slovenije objavlja najnovejšo gospodarsko napoved.</summary>
  </entry>
</feed>"""

SAMPLE_RSS_MULTIPLE = SAMPLE_RSS.replace(
    "  </channel>",
    """    <item>
      <title>Old ECB decision</title>
      <link>https://www.ecb.europa.eu//press///pr/date/2025/html/old.html</link>
      <description>An older policy decision.</description>
      <pubDate>Fri, 01 Aug 2025 10:00:00 GMT</pubDate>
    </item>
  </channel>""",
)


def test_ssrf_ip_and_url_validation():
    assert is_safe_ip("8.8.8.8") is True
    assert is_safe_ip("127.0.0.1") is False
    assert is_safe_ip("10.0.0.1") is False
    assert is_safe_ip("172.16.0.1") is False
    assert is_safe_ip("192.168.1.1") is False
    assert is_safe_ip("169.254.169.254") is False

    with pytest.raises(SSRFVulnerabilityError, match="Localhost"):
        validate_safe_url("http://localhost/feed.xml")

    with pytest.raises(SSRFVulnerabilityError, match="Localhost"):
        validate_safe_url("http://127.0.0.1/feed.xml")

    with pytest.raises(SSRFVulnerabilityError, match="Disallowed URL scheme"):
        validate_safe_url("file:///etc/passwd")

    with pytest.raises(SSRFVulnerabilityError, match="Disallowed URL scheme"):
        validate_safe_url("gopher://localhost:70/1")


def test_rss_and_atom_parsing():
    feed_config = RSSFeedConfig(
        display_name="ECB",
        feed_url="https://www.ecb.europa.eu/rss/press.html",
        country="EU",
        language="en",
    )
    provider = RSSNewsProvider(feeds=[feed_config])

    articles = provider.parse_feed_xml(SAMPLE_RSS, feed_config)
    assert len(articles) == 1
    assert articles[0].title == "ECB monetary policy decisions"
    assert articles[0].provider == "rss"
    assert articles[0].external_id.startswith("rss:")
    assert articles[0].source == "ECB"
    assert articles[0].source_type == "official"
    assert articles[0].categories == ["macro"]
    assert articles[0].trust_score == 90
    assert validate_normalized_article(articles[0], default_provider="rss") == articles[0]

    atom_articles = provider.parse_feed_xml(SAMPLE_ATOM, feed_config)
    assert len(atom_articles) == 1
    assert atom_articles[0].title == "Gospodarska napoved za Slovenijo"
    assert validate_normalized_article(atom_articles[0], default_provider="rss") == atom_articles[0]


def test_rss_provider_fetch_market_news():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=SAMPLE_RSS, request=request)

    provider = RSSNewsProvider(
        feeds=[
            RSSFeedConfig(
                display_name="Test Feed",
                feed_url="https://www.example.com/rss.xml",
                enabled=True,
            )
        ],
        transport=httpx.MockTransport(handler),
        allowlist_domains={"www.example.com"},
    )

    result = asyncio.run(provider.fetch_market_news())
    assert result.status == "complete"
    assert len(result.records) == 1
    assert result.records[0].source == "Test Feed"


def test_rss_provider_honors_ingestion_window_and_global_limit():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=SAMPLE_RSS_MULTIPLE, request=request)

    provider = RSSNewsProvider(
        feeds=[
            RSSFeedConfig(
                display_name="Test Feed",
                feed_url="https://www.example.com/rss.xml",
            )
        ],
        transport=httpx.MockTransport(handler),
        allowlist_domains={"www.example.com"},
    )

    result = asyncio.run(
        provider.fetch_market_news(
            start_datetime=datetime(2026, 7, 31, tzinfo=UTC),
            end_datetime=datetime(2026, 8, 2, tzinfo=UTC),
            max_articles=1,
        )
    )

    assert [article.title for article in result.records] == ["ECB monetary policy decisions"]
    assert result.raw_record_count == 2


def test_rss_provider_uses_canonical_url_for_stable_identity():
    feed_config = RSSFeedConfig(
        display_name="ECB",
        feed_url="https://www.ecb.europa.eu/rss/press.html",
    )
    provider = RSSNewsProvider(feeds=[feed_config])

    article = provider.parse_feed_xml(SAMPLE_RSS_MULTIPLE, feed_config)[1]
    assert article.article_url == "https://www.ecb.europa.eu//press///pr/date/2025/html/old.html"
    assert article.canonical_url == "https://www.ecb.europa.eu/press/pr/date/2025/html/old.html"
