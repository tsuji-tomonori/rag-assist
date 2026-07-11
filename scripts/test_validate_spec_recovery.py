from __future__ import annotations

import csv
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts import validate_spec_recovery as validator


CSV_COLUMNS = [
    "requirement_id",
    "type",
    "title",
    "source_ids",
    "source_locator",
    "current_evidence",
    "current_status",
    "confidence",
    "acceptance_ids",
    "validation_target",
    "open_question",
]


class ValidateSpecRecoveryTest(unittest.TestCase):
    def test_extract_repo_paths_removes_line_locators(self) -> None:
        self.assertEqual(
            validator.extract_repo_paths(
                "apps/api/src/auth.ts:7-12; docs/spec-recovery/README.md"
            ),
            {"apps/api/src/auth.ts", "docs/spec-recovery/README.md"},
        )

    def test_trace_csv_rejects_bad_path_status_and_reverse_question_link(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            inventory = repo / "inventory.md"
            questions = repo / "questions.md"
            requirement = repo / "REQ_FUNCTIONAL_056.md"
            trace = repo / "trace.csv"
            inventory.write_text("| SRC-034 | code |\n", encoding="utf-8")
            questions.write_text(
                "| Q-013 | OQ-RD-001 | FR-057 | question | why | default | owner | open_question |\n",
                encoding="utf-8",
            )
            requirement.write_text(
                "# FR-056 canonical title\n"
                "### AC-FR056-001 first\n"
                "### AC-FR056-002 second\n",
                encoding="utf-8",
            )
            self._write_rows(
                trace,
                [
                    [
                        "FR-056",
                        "functional",
                        "title",
                        "SRC-034",
                        "source",
                        "apps/api/src/does-not-exist.ts:1-2",
                        "partial/open",
                        "inferred",
                        "AC-FR056-001;AC-FR056-002",
                        "target",
                        "OQ-RD-001",
                    ]
                ],
            )
            errors: list[str] = []

            validator.validate_trace_csv(
                trace,
                {"FR-056": requirement},
                inventory,
                questions,
                repo,
                errors,
            )

            rendered = "\n".join(errors)
            self.assertIn("current_status has invalid labels open", rendered)
            self.assertIn("Related does not reference the requirement", rendered)
            self.assertIn("current_evidence path does not exist", rendered)
            self.assertIn(
                "CSV title 'title' does not match requirement title", rendered
            )

    def test_trace_csv_rejects_short_duplicate_and_ac_mismatch_rows(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            inventory = repo / "inventory.md"
            questions = repo / "questions.md"
            requirement = repo / "REQ_FUNCTIONAL_056.md"
            trace = repo / "trace.csv"
            inventory.write_text("| SRC-034 | code |\n", encoding="utf-8")
            questions.write_text(
                "| Q-013 | OQ-RD-001 | FR-056 | q | w | d | o | open_question |\n",
                encoding="utf-8",
            )
            requirement.write_text(
                "# FR-056 canonical title\n"
                "### AC-FR056-001 first\n"
                "### AC-FR056-002 second\n",
                encoding="utf-8",
            )
            valid_row = [
                "FR-056",
                "functional",
                "title",
                "SRC-034",
                "source",
                "evidence without a path",
                "partial",
                "inferred",
                "AC-FR056-001",
                "target",
                "OQ-RD-001",
            ]
            self._write_rows(trace, [["FR-056", "short"], valid_row, valid_row])
            errors: list[str] = []

            validator.validate_trace_csv(
                trace,
                {"FR-056": requirement},
                inventory,
                questions,
                repo,
                errors,
            )

            rendered = "\n".join(errors)
            self.assertIn("malformed or short CSV row", rendered)
            self.assertIn("duplicate requirement rows FR-056", rendered)
            self.assertIn("do not exactly match document ACs", rendered)

    def test_cli_rejects_missing_expected_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo" / "docs" / "spec-recovery"
            root.mkdir(parents=True)
            result = subprocess.run(
                [sys.executable, str(Path(validator.__file__)), str(root)],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 1)
            self.assertIn("missing expected file", result.stdout)
            self.assertIn("missing 2026-07 requirement baseline", result.stdout)

    @staticmethod
    def _write_rows(path: Path, rows: list[list[str]]) -> None:
        with path.open("w", encoding="utf-8", newline="") as output:
            writer = csv.writer(output)
            writer.writerow(CSV_COLUMNS)
            writer.writerows(rows)


if __name__ == "__main__":
    unittest.main()
