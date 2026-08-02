from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from scripts.validate_academy_content import (
    ContentValidationError,
    validate_registry,
)


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
ACADEMY_ROOT = REPOSITORY_ROOT / "content" / "academy"


class AcademyContentValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.content_root = Path(self.temporary_directory.name) / "academy"
        shutil.copytree(ACADEMY_ROOT, self.content_root)

    def read_json(self, filename: str) -> dict:
        return json.loads((self.content_root / filename).read_text(encoding="utf-8"))

    def write_json(self, filename: str, payload: dict) -> None:
        (self.content_root / filename).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def test_canonical_registry_resolves_final_counts(self) -> None:
        self.assertEqual(
            validate_registry(self.content_root),
            {
                "paths": 12,
                "active_paths": 4,
                "modules": 24,
                "lessons": 32,
                "questions": 108,
                "glossary_terms": 118,
                "review_cards": 118,
                "chart_exercises": 12,
                "calculator_exercises": 10,
                "simulation_scenarios": 10,
            },
        )

    def test_missing_slovenian_translation_is_rejected(self) -> None:
        payload = self.read_json("lessons.json")
        del payload["lessons"][0]["summary"]["sl"]
        self.write_json("lessons.json", payload)

        with self.assertRaisesRegex(ContentValidationError, "exactly the locales"):
            validate_registry(self.content_root)

    def test_flagship_risk_lessons_require_framework_and_handoff(self) -> None:
        payload = self.read_json("lessons.json")
        risk_lesson = next(
            item
            for item in payload["lessons"]
            if item["path_id"] == "path-risk-management"
        )
        del risk_lesson["content"]["reflection_prompt"]
        self.write_json("lessons.json", payload)

        with self.assertRaisesRegex(ContentValidationError, "flagship decision framework"):
            validate_registry(self.content_root)

    def test_answer_revealing_legacy_matching_shape_is_rejected(self) -> None:
        payload = self.read_json("questions.json")
        question = next(item for item in payload["questions"] if item["type"] == "matching")
        question["pairs"] = []
        question["answer"] = {"matched_pair_ids": []}
        self.write_json("questions.json", payload)

        with self.assertRaisesRegex(ContentValidationError, "legacy matching shape"):
            validate_registry(self.content_root)

    def test_generator_name_and_decimal_scale_are_locked(self) -> None:
        payload = self.read_json("practice.json")
        payload["chart_exercises"][0]["data"]["algorithm"] = "seeded-regime-v1"
        payload["chart_exercises"][1]["data"]["drift"] = 0
        self.write_json("practice.json", payload)

        with self.assertRaises(ContentValidationError) as context:
            validate_registry(self.content_root)
        message = str(context.exception)
        self.assertIn("algorithm must be lcg-ohlcv-v1", message)
        self.assertIn("drift must be a decimal return float", message)


if __name__ == "__main__":
    unittest.main()
