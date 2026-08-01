import re

from app.services.ticker_mapping import COMPANY_TICKERS
from app.services.ticker_registry import normalize_registered_symbol

_EXPLICIT_TICKER_RE = re.compile(
    r"(?:\$(?P<cash>[A-Z]{1,5}(?:\.[A-Z])?)|"
    r"\b(?:NASDAQ|NYSE|AMEX|LSE|TSX):\s*(?P<exchange>[A-Z]{1,5}(?:\.[A-Z])?))\b"
)


def extract_tickers(text: str, supplied_tickers: list[str] | None = None) -> list[str]:
    """Return registered provider/explicit symbols plus reviewed company-name mappings."""

    found = {
        symbol
        for item in supplied_tickers or []
        if (symbol := normalize_registered_symbol(item)) is not None
    }
    for match in _EXPLICIT_TICKER_RE.finditer(text or ""):
        candidate = match.group("cash") or match.group("exchange")
        symbol = normalize_registered_symbol(candidate)
        if symbol:
            found.add(symbol)
    lowered = (text or "").lower()
    for company, ticker in COMPANY_TICKERS.items():
        if re.search(rf"\b{re.escape(company)}\b", lowered):
            found.add(ticker)
    return sorted(found)
