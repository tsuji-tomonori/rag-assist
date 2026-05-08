#!/usr/bin/env python3
"""Lightweight validator for rag-assist spec recovery markdown files.

This script checks whether expected files exist and whether common ID prefixes appear.
It intentionally avoids strict parsing so it can be used early in documentation recovery.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

EXPECTED_FILES = [
    "00_input_inventory.md",
    "01_report_facts.md",
    "02_tasks.md",
    "03_acceptance_criteria.md",
    "04_e2e_scenarios.md",
    "05_operation_expectation_groups.md",
    "06_requirements.md",
    "07_specifications.md",
    "08_traceability_matrix.md",
    "09_gap_analysis.md",
    "10_open_questions.md",
]

ID_PATTERNS = {
    "TASK": re.compile(r"\bTASK-\d{3,}\b"),
    "AC": re.compile(r"\bAC-[A-Z]*-?\d{3,}\b"),
    "E2E": re.compile(r"\bE2E-[A-Z]*-?\d{3,}\b"),
    "REQ": re.compile(r"\bREQ-[A-Z]+-\d{3,}\b"),
    "SPEC": re.compile(r"\bSPEC-[A-Z]+-\d{3,}\b"),
}


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/spec-recovery")
    errors: list[str] = []
    warnings: list[str] = []

    if not root.exists():
        print(f"ERROR: directory not found: {root}")
        return 2

    combined = ""
    for name in EXPECTED_FILES:
        path = root / name
        if not path.exists():
            warnings.append(f"missing expected file: {path}")
            continue
        combined += "\n" + path.read_text(encoding="utf-8", errors="replace")

    for label, pattern in ID_PATTERNS.items():
        if not pattern.search(combined):
            warnings.append(f"no {label} IDs found")

    matrix = root / "08_traceability_matrix.md"
    if matrix.exists():
        text = matrix.read_text(encoding="utf-8", errors="replace")
        for label in ["Requirement", "Specification", "Confidence"]:
            if label not in text:
                warnings.append(f"traceability matrix may be missing column: {label}")

    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")

    if errors:
        return 1
    print("Validation completed. Review warnings before treating the spec recovery as complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
