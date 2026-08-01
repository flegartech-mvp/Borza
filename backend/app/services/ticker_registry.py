"""Curated symbols accepted by Borza's conservative ticker extractor.

The registry is intentionally small and precision-first. Additions should come from a
reviewed exchange/provider symbol export, retain the canonical uppercase symbol, and
include a regression test. Provider-supplied symbols are not trusted unless registered.
"""

REGISTERED_SYMBOLS = frozenset(
    {
        "AAPL",
        "AMD",
        "AMZN",
        "ASML",
        "AZN",
        "BABA",
        "BHP",
        "BIDU",
        "BMW",
        "BP",
        "BRK.B",
        "BTC",
        "COIN",
        "CVX",
        "ETH",
        "GOOG",
        "GOOGL",
        "HDB",
        "INFY",
        "INTC",
        "JD",
        "JPM",
        "MELI",
        "META",
        "MRNA",
        "MSFT",
        "NFLX",
        "NIO",
        "NVO",
        "NVDA",
        "PBR",
        "RY",
        "SAP",
        "SHEL",
        "SHOP",
        "SONY",
        "SPOT",
        "TD",
        "TM",
        "TSLA",
        "TSM",
        "UBS",
        "VALE",
    }
)

NON_TICKER_ACRONYMS = frozenset(
    {
        "AI",
        "CEO",
        "COVID",
        "ECB",
        "EUR",
        "FDA",
        "GDP",
        "IMF",
        "IPO",
        "NATO",
        "OPEC",
        "SEC",
        "UK",
        "UN",
        "USA",
        "USD",
        "WHO",
    }
)


def normalize_registered_symbol(value: object) -> str | None:
    symbol = str(value).strip().upper().lstrip("$") if value is not None else ""
    if symbol in NON_TICKER_ACRONYMS:
        return None
    return symbol if symbol in REGISTERED_SYMBOLS else None
