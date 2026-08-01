from urllib.parse import urlparse

_SOURCE_ALIASES = {
    "bloomberg": "bloomberg",
    "bloomberg.com": "bloomberg",
    "financial times": "financial-times",
    "ft": "financial-times",
    "ft.com": "financial-times",
    "reuters": "reuters",
    "reuters.com": "reuters",
    "the wall street journal": "wall-street-journal",
    "wall street journal": "wall-street-journal",
    "wsj": "wall-street-journal",
    "wsj.com": "wall-street-journal",
}

ESTABLISHED_SOURCES = frozenset({"reuters", "bloomberg", "financial-times", "wall-street-journal"})


def normalize_source(value: str) -> str:
    candidate = value.strip().casefold()
    parsed = urlparse(candidate if "://" in candidate else f"//{candidate}")
    hostname = (parsed.hostname or "").removeprefix("www.").casefold()
    if hostname:
        for domain, canonical in (
            ("reuters.com", "reuters"),
            ("bloomberg.com", "bloomberg"),
            ("ft.com", "financial-times"),
            ("wsj.com", "wall-street-journal"),
        ):
            if hostname == domain or hostname.endswith(f".{domain}"):
                return canonical
    normalized = " ".join(candidate.replace("_", " ").replace("-", " ").split())
    return _SOURCE_ALIASES.get(normalized, normalized)
