"""Container / operational healthcheck CLI helper.

Exits with 0 if operational health (or specified target) is healthy/ready,
and exits with 1 otherwise.
"""

import sys
import urllib.error
import urllib.request


def check_health(target_url: str = "http://127.0.0.1:8000/ready") -> bool:
    try:
        req = urllib.request.Request(target_url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception as exc:
        print(f"Healthcheck failed for {target_url}: {exc}", file=sys.stderr)
        return False


def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/ready"
    success = check_health(url)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
