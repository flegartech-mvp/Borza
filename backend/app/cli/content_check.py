import sys

from app.content.registry import ContentRegistryError, load_academy_registry


def main() -> None:
    try:
        registry = load_academy_registry()
    except ContentRegistryError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
    print(
        "Academy content valid: "
        f"{len(registry.paths)} paths, {len(registry.lessons)} lessons, "
        f"{len(registry.questions)} questions, {len(registry.review_cards)} review cards"
    )


if __name__ == "__main__":
    main()
