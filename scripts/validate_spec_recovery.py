#!/usr/bin/env python3
"""Validate spec-recovery artifacts and the 2026-07 product baseline."""

from __future__ import annotations

import csv
import re
import sys
from collections import Counter
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

REDEFINITION_FILES = [
    "13_requirements_redefinition_202607.md",
    "14_authorization_sharing_matrix_202607.md",
    "15_rag_lifecycle_matrix_202607.md",
    "16_current_state_gap_analysis_202607.md",
    "17_traceability_matrix_202607.csv",
]

ID_PATTERNS = {
    "TASK": re.compile(r"\bTASK-\d{3,}\b"),
    "AC": re.compile(r"\bAC-[A-Z]*-?\d{3,}\b"),
    "E2E": re.compile(r"\bE2E-[A-Z]*-?\d{3,}\b"),
    "REQ": re.compile(r"\bREQ-[A-Z]+-\d{3,}\b"),
    "SPEC": re.compile(r"\bSPEC-[A-Z]+-\d{3,}\b"),
}

REQUIRED_SECTIONS = [
    "## 要件",
    "## 要求属性",
    "## 受け入れ条件",
    "## 妥当性確認",
    "## トレース",
]

REQUIRED_ATTRIBUTES = [
    "識別子",
    "説明",
    "根拠",
    "源泉",
    "Actor / trigger",
    "種類",
    "依存関係",
    "衝突",
    "受け入れ基準",
    "優先度",
    "安定性",
    "Confidence",
    "所有者",
    "変更履歴",
]

ALLOWED_CONFIDENCE = {"confirmed", "inferred", "conflict", "open_question"}
VALIDATION_PERSPECTIVES = {
    "必要性",
    "十分性",
    "理解容易性",
    "一貫性",
    "標準・契約適合",
    "実現可能性",
    "検証可能性",
    "ニーズ適合",
}
EXPECTED_REQUIREMENTS = {
    *(f"FR-{number:03d}" for number in range(56, 94)),
    *(f"SQ-{number:03d}" for number in range(5, 16)),
}
ALLOWED_CURRENT_STATUS = {
    "implemented",
    "partial",
    "missing",
    "conflict",
    "open_question",
}
REPO_PATH_PATTERN = re.compile(
    r"(?<![\w.-])((?:apps|benchmark|docs|infra|reports|scripts|tasks)/[^;,\s]+)"
)


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/spec-recovery")
    root = root.resolve()
    errors: list[str] = []

    if not root.exists():
        print(f"ERROR: directory not found: {root}")
        return 2

    repo = root.parents[1]
    combined = ""
    for name in EXPECTED_FILES:
        path = root / name
        if not path.exists():
            errors.append(f"missing expected file: {path}")
            continue
        combined += "\n" + path.read_text(encoding="utf-8", errors="replace")

    for label, pattern in ID_PATTERNS.items():
        if not pattern.search(combined):
            errors.append(f"no {label} IDs found in base recovery artifacts")

    validate_base_matrix(root, errors)
    validate_gap_ids(root, errors)
    validate_e2e_links(root, errors)

    baseline = (
        repo
        / "docs"
        / "1_要求_REQ"
        / "11_製品要求_PRODUCT"
        / "REQUIREMENTS_BASELINE_202607.md"
    )
    if baseline.exists():
        validate_redefinition(root, repo, baseline, errors)
    else:
        errors.append(f"missing 2026-07 requirement baseline: {baseline}")

    for error in errors:
        print(f"ERROR: {error}")

    if errors:
        return 1
    print(
        "Validation completed: required artifacts, one-declaration-per-file structure, "
        "required fields, AC syntax, and checked trace references passed. "
        "Semantic atomicity and sufficiency require review."
    )
    return 0


def validate_base_matrix(root: Path, errors: list[str]) -> None:
    matrix = root / "08_traceability_matrix.md"
    if not matrix.exists():
        return
    text = matrix.read_text(encoding="utf-8", errors="replace")
    for label in ["Requirement", "Specification", "Confidence"]:
        if label not in text:
            errors.append(f"traceability matrix is missing column: {label}")


def validate_gap_ids(root: Path, errors: list[str]) -> None:
    path = root / "09_gap_analysis.md"
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8", errors="replace")
    gap_ids = re.findall(r"^## (GAP-\d+):", text, flags=re.MULTILINE)
    duplicates = sorted(
        gap_id for gap_id, count in Counter(gap_ids).items() if count > 1
    )
    if duplicates:
        errors.append(f"duplicate gap IDs: {', '.join(duplicates)}")

    detailed = root / "16_current_state_gap_analysis_202607.md"
    if detailed.exists():
        detailed_ids = re.findall(
            r"^\|\s*(GAP-RD-\d{3})\s*\|",
            detailed.read_text(encoding="utf-8", errors="replace"),
            flags=re.MULTILINE,
        )
        detailed_duplicates = sorted(
            gap_id for gap_id, count in Counter(detailed_ids).items() if count > 1
        )
        if detailed_duplicates:
            errors.append(
                "duplicate detailed gap IDs: " + ", ".join(detailed_duplicates)
            )


def validate_e2e_links(root: Path, errors: list[str]) -> None:
    scenarios = root / "04_e2e_scenarios.md"
    redefinition = root / "13_requirements_redefinition_202607.md"
    if not scenarios.exists() or not redefinition.exists():
        return

    scenario_text = scenarios.read_text(encoding="utf-8", errors="replace")
    definitions = re.findall(
        r"^##\s+(E2E-[A-Z]+-\d{3}):",
        scenario_text,
        flags=re.MULTILINE,
    )
    duplicates = sorted(
        e2e_id for e2e_id, count in Counter(definitions).items() if count > 1
    )
    if duplicates:
        errors.append(f"duplicate E2E definitions: {', '.join(duplicates)}")

    referenced = set(
        re.findall(
            r"\bE2E-[A-Z]+-\d{3}\b",
            redefinition.read_text(encoding="utf-8", errors="replace"),
        )
    )
    missing = sorted(referenced - set(definitions))
    if missing:
        errors.append(
            "2026-07 redefinition references undefined E2E IDs: " + ", ".join(missing)
        )


def validate_redefinition(
    root: Path,
    repo: Path,
    baseline: Path,
    errors: list[str],
) -> None:
    for name in REDEFINITION_FILES:
        if not (root / name).exists():
            errors.append(f"missing 2026-07 artifact: {root / name}")

    product_root = repo / "docs" / "1_要求_REQ" / "11_製品要求_PRODUCT"
    requirement_files = [
        *product_root.rglob("REQ_FUNCTIONAL_*.md"),
        *product_root.rglob("REQ_SERVICE_QUALITY_*.md"),
    ]
    selected: dict[str, Path] = {}

    for path in requirement_files:
        match = re.fullmatch(r"REQ_(FUNCTIONAL|SERVICE_QUALITY)_(\d{3})\.md", path.name)
        if not match:
            continue
        prefix = "FR" if match.group(1) == "FUNCTIONAL" else "SQ"
        requirement_id = f"{prefix}-{match.group(2)}"
        if requirement_id not in EXPECTED_REQUIREMENTS:
            continue
        if requirement_id in selected:
            errors.append(
                f"duplicate requirement ID {requirement_id}: "
                f"{selected[requirement_id]} and {path}"
            )
            continue
        selected[requirement_id] = path
        validate_requirement(path, requirement_id, errors)

    missing_requirements = sorted(EXPECTED_REQUIREMENTS - selected.keys())
    if missing_requirements:
        errors.append(
            "missing 2026-07 requirement files: " + ", ".join(missing_requirements)
        )

    baseline_text = baseline.read_text(encoding="utf-8", errors="replace")
    for requirement_id in sorted(EXPECTED_REQUIREMENTS):
        if requirement_id not in baseline_text:
            errors.append(f"baseline does not reference {requirement_id}")

    validate_requirement_indexes(repo, product_root, errors)
    validate_trace_csv(
        root / "17_traceability_matrix_202607.csv",
        selected,
        root / "00_input_inventory.md",
        root / "10_open_questions.md",
        repo,
        errors,
    )
    validate_superseded_requirements(product_root, baseline, errors)

    if "TBD" in baseline_text or "TODO" in baseline_text:
        errors.append("baseline contains TBD/TODO; use an explicit open_question ID")

    open_questions = (root / "10_open_questions.md").read_text(
        encoding="utf-8", errors="replace"
    )
    for question_id in range(13, 25):
        if f"Q-{question_id:03d}" not in open_questions:
            errors.append(f"missing open question Q-{question_id:03d}")
    for question_id in range(1, 13):
        if f"OQ-RD-{question_id:03d}" not in baseline_text:
            errors.append(f"baseline does not reference OQ-RD-{question_id:03d}")


def validate_requirement(path: Path, requirement_id: str, errors: list[str]) -> None:
    text = path.read_text(encoding="utf-8", errors="replace")
    declarations = re.findall(r"^- ((?:FR|SQ)-\d{3}):\s+\S", text, flags=re.MULTILINE)
    if declarations != [requirement_id]:
        errors.append(
            f"{path}: expected exactly one declaration for {requirement_id}, "
            f"found {declarations}"
        )

    for section in REQUIRED_SECTIONS:
        if section not in text:
            errors.append(f"{path}: missing required section {section}")

    if requirement_id.startswith("FR-"):
        if "## 分類（L0-L3）" not in text:
            errors.append(f"{path}: missing L0-L3 classification")
        if f"- L3要件: `{requirement_id}`" not in text:
            errors.append(f"{path}: L3 classification does not match {requirement_id}")

    for attribute in REQUIRED_ATTRIBUTES:
        if not re.search(
            rf"^\|\s*{re.escape(attribute)}\s*\|", text, flags=re.MULTILINE
        ):
            errors.append(f"{path}: missing required attribute {attribute}")

    ac_prefix = requirement_id.replace("-", "")
    ac_headings = re.findall(
        rf"^###\s+(AC-{ac_prefix}-\d{{3}})\b",
        text,
        flags=re.MULTILINE,
    )
    if len(ac_headings) < 2:
        errors.append(f"{path}: expected at least two requirement-local AC headings")
    duplicate_acs = sorted(
        ac_id for ac_id, count in Counter(ac_headings).items() if count > 1
    )
    if duplicate_acs:
        errors.append(f"{path}: duplicate AC headings {', '.join(duplicate_acs)}")

    acceptance_row = re.search(
        r"^\|\s*受け入れ基準\s*\|\s*([^|]+)\|",
        text,
        flags=re.MULTILINE,
    )
    attributed_acs = (
        set(re.findall(rf"AC-{ac_prefix}-\d{{3}}", acceptance_row.group(1)))
        if acceptance_row
        else set()
    )
    if set(ac_headings) != attributed_acs:
        errors.append(
            f"{path}: acceptance attribute IDs {sorted(attributed_acs)} "
            f"do not exactly match AC headings {sorted(set(ac_headings))}"
        )

    for index, match in enumerate(
        re.finditer(
            rf"^###\s+(AC-{ac_prefix}-\d{{3}})\b.*$",
            text,
            flags=re.MULTILINE,
        )
    ):
        next_heading = re.search(r"^#{2,3}\s+", text[match.end() :], flags=re.MULTILINE)
        end = match.end() + next_heading.start() if next_heading else len(text)
        section = text[match.end() : end]
        for keyword in ["Given", "When", "Then"]:
            count = len(
                re.findall(
                    rf"^-\s+{keyword}:\s+\S",
                    section,
                    flags=re.MULTILINE,
                )
            )
            if count != 1:
                errors.append(
                    f"{path}: {match.group(1)} must contain exactly one {keyword} bullet"
                )

    for perspective in VALIDATION_PERSPECTIVES:
        if not re.search(
            rf"^\|\s*{re.escape(perspective)}\s*\|",
            text,
            flags=re.MULTILINE,
        ):
            errors.append(f"{path}: validation table missing {perspective}")

    confidence_rows = re.findall(
        r"^\|\s*Confidence\s*\|\s*([^|]+)\|", text, flags=re.MULTILINE
    )
    if not confidence_rows:
        errors.append(f"{path}: no Confidence attribute value")
    elif confidence_rows[0].strip().strip("`") not in ALLOWED_CONFIDENCE:
        errors.append(
            f"{path}: Confidence must be exactly one of "
            "confirmed/inferred/conflict/open_question"
        )

    if re.search(r"\b(?:TBD|TODO)\b", text):
        errors.append(f"{path}: unresolved TBD/TODO; use an open_question ID")


def validate_trace_csv(
    path: Path,
    requirement_files: dict[str, Path],
    inventory_path: Path,
    questions_path: Path,
    repo: Path,
    errors: list[str],
) -> None:
    if not path.exists():
        return
    with path.open(encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))

    required_columns = {
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
    }
    actual_columns = set(rows[0].keys()) if rows else set()
    missing_columns = sorted(required_columns - actual_columns)
    if missing_columns:
        errors.append(f"{path}: missing columns {', '.join(missing_columns)}")
        return

    complete_rows: list[dict[str, str]] = []
    for line_number, row in enumerate(rows, start=2):
        if None in row or any(row.get(column) is None for column in required_columns):
            errors.append(f"{path}:{line_number}: malformed or short CSV row")
            continue
        complete_rows.append(
            {key: value for key, value in row.items() if key is not None}
        )
    rows = complete_rows

    ids = [row["requirement_id"] for row in rows]
    duplicate_ids = sorted(
        requirement_id for requirement_id, count in Counter(ids).items() if count > 1
    )
    if duplicate_ids:
        errors.append(f"{path}: duplicate requirement rows {', '.join(duplicate_ids)}")

    missing = sorted(EXPECTED_REQUIREMENTS - set(ids))
    extra = sorted(set(ids) - EXPECTED_REQUIREMENTS)
    if missing:
        errors.append(f"{path}: missing requirement rows {', '.join(missing)}")
    if extra:
        errors.append(f"{path}: unexpected requirement rows {', '.join(extra)}")

    inventory_ids = set(
        re.findall(
            r"^\|\s*(SRC-\d{3})\s*\|",
            inventory_path.read_text(encoding="utf-8", errors="replace"),
            flags=re.MULTILINE,
        )
    )
    questions_text = questions_path.read_text(encoding="utf-8", errors="replace")
    known_question_ids = set(
        re.findall(
            r"\b(?:OQ-RD-\d{3}|Q-\d{3})\b",
            questions_text,
        )
    )
    question_related = parse_question_related_requirements(questions_text)

    for row in rows:
        requirement_id = row["requirement_id"]
        expected_ac_prefix = f"AC-{requirement_id.replace('-', '')}-"
        if expected_ac_prefix not in row["acceptance_ids"]:
            errors.append(
                f"{path}: {requirement_id} acceptance_ids do not use "
                f"{expected_ac_prefix}"
            )
        for column in [
            "type",
            "title",
            "source_ids",
            "source_locator",
            "current_evidence",
            "current_status",
            "confidence",
            "acceptance_ids",
            "validation_target",
        ]:
            if not row[column].strip():
                errors.append(f"{path}: {requirement_id} has empty {column}")

        confidence = row["confidence"].strip().strip("`")
        if confidence not in ALLOWED_CONFIDENCE:
            errors.append(
                f"{path}: {requirement_id} confidence must be exactly one allowed label"
            )

        status_tokens = set(row["current_status"].strip().split("/"))
        invalid_status = sorted(status_tokens - ALLOWED_CURRENT_STATUS)
        if invalid_status:
            errors.append(
                f"{path}: {requirement_id} current_status has invalid labels "
                + ", ".join(invalid_status)
            )

        source_ids = set(re.findall(r"SRC-\d{3}", row["source_ids"]))
        unknown_sources = sorted(source_ids - inventory_ids)
        if unknown_sources:
            errors.append(
                f"{path}: {requirement_id} has unknown source IDs "
                + ", ".join(unknown_sources)
            )

        question_ids = set(re.findall(r"(?:OQ-RD-\d{3}|Q-\d{3})", row["open_question"]))
        unknown_questions = sorted(question_ids - known_question_ids)
        if unknown_questions:
            errors.append(
                f"{path}: {requirement_id} has unknown open-question IDs "
                + ", ".join(unknown_questions)
            )
        for question_id in sorted(question_ids - set(unknown_questions)):
            if requirement_id not in question_related.get(question_id, set()):
                errors.append(
                    f"{path}: {requirement_id} references {question_id}, but "
                    "10_open_questions.md Related does not reference the requirement"
                )

        for evidence_path in extract_repo_paths(row["current_evidence"]):
            if not (repo / evidence_path).exists():
                errors.append(
                    f"{path}: {requirement_id} current_evidence path does not exist: "
                    f"{evidence_path}"
                )

        requirement_path = requirement_files.get(requirement_id)
        if requirement_path is not None:
            requirement_text = requirement_path.read_text(
                encoding="utf-8", errors="replace"
            )
            title_match = re.search(
                rf"^#\s+{re.escape(requirement_id)}\s+(.+?)\s*$",
                requirement_text,
                flags=re.MULTILINE,
            )
            if title_match and row["title"].strip() != title_match.group(1).strip():
                errors.append(
                    f"{path}: {requirement_id} CSV title {row['title']!r} "
                    f"does not match requirement title {title_match.group(1)!r}"
                )
            doc_acs = set(
                re.findall(
                    rf"^###\s+(AC-{requirement_id.replace('-', '')}-\d{{3}})\b",
                    requirement_text,
                    flags=re.MULTILINE,
                )
            )
            csv_acs = set(
                re.findall(
                    rf"AC-{requirement_id.replace('-', '')}-\d{{3}}",
                    row["acceptance_ids"],
                )
            )
            if csv_acs != doc_acs:
                errors.append(
                    f"{path}: {requirement_id} CSV acceptance IDs {sorted(csv_acs)} "
                    f"do not exactly match document ACs {sorted(doc_acs)}"
                )


def parse_question_related_requirements(text: str) -> dict[str, set[str]]:
    related: dict[str, set[str]] = {}
    for line in text.splitlines():
        if not line.lstrip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not cells or not re.fullmatch(r"Q-\d{3}", cells[0]):
            continue
        question_ids = [cells[0]]
        related_index = 1
        if len(cells) > 1 and re.fullmatch(r"OQ-RD-\d{3}", cells[1]):
            question_ids.append(cells[1])
            related_index = 2
        if len(cells) <= related_index:
            continue
        requirement_ids = set(re.findall(r"\b(?:FR|SQ)-\d{3}\b", cells[related_index]))
        for question_id in question_ids:
            related.setdefault(question_id, set()).update(requirement_ids)
    return related


def extract_repo_paths(value: str) -> set[str]:
    paths: set[str] = set()
    for match in REPO_PATH_PATTERN.finditer(value):
        candidate = match.group(1).strip("`'\"()[]{}.")
        candidate = re.sub(r":\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$", "", candidate)
        paths.add(candidate)
    return paths


def validate_requirement_indexes(
    repo: Path, product_root: Path, errors: list[str]
) -> None:
    functional_index = (
        product_root / "01_機能要求_FUNCTIONAL" / "README.md"
    ).read_text(encoding="utf-8", errors="replace")
    requirements_index = (repo / "docs" / "REQUIREMENTS.md").read_text(
        encoding="utf-8", errors="replace"
    )

    for requirement_id in sorted(
        requirement_id
        for requirement_id in EXPECTED_REQUIREMENTS
        if requirement_id.startswith("FR-")
    ):
        if requirement_id not in functional_index:
            errors.append(f"functional README does not reference {requirement_id}")

    for requirement_id in sorted(
        requirement_id
        for requirement_id in EXPECTED_REQUIREMENTS
        if requirement_id.startswith("SQ-")
    ):
        if requirement_id not in requirements_index:
            errors.append(f"requirements index does not reference {requirement_id}")

    for marker in ["REQUIREMENTS_BASELINE_202607.md", "CHG-003"]:
        if marker not in requirements_index:
            errors.append(f"requirements index does not reference {marker}")


def validate_superseded_requirements(
    product_root: Path, baseline: Path, errors: list[str]
) -> None:
    expected = {
        "REQ_FUNCTIONAL_041.md": "FR-061",
        "REQ_FUNCTIONAL_052.md": "FR-056",
        "REQ_NON_FUNCTIONAL_011.md": "FR-056",
    }
    by_name = {path.name: path for path in product_root.rglob("*.md")}
    baseline_text = baseline.read_text(encoding="utf-8", errors="replace")
    for name, replacement in expected.items():
        path = by_name.get(name)
        if path is None:
            errors.append(f"missing superseded requirement file: {name}")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if (
            "状態: Superseded" not in text
            or replacement not in text
            or "disposition" not in text
        ):
            errors.append(
                f"{path}: must record Superseded state, replacement {replacement}, "
                "and acceptance disposition"
            )

        if name == "REQ_FUNCTIONAL_041.md":
            disposition_match = re.search(
                r"## 受け入れ条件 disposition\s*(.+?)(?=^##\s|\Z)",
                text,
                flags=re.MULTILINE | re.DOTALL,
            )
            baseline_match = re.search(
                r"^\|\s*`FR-041`\s*\|.*$",
                baseline_text,
                flags=re.MULTILINE,
            )
            if disposition_match and baseline_match:
                disposition_ids = extract_requirement_ids(disposition_match.group(1))
                baseline_ids = extract_requirement_ids(baseline_match.group(0))
                missing = sorted((disposition_ids - {"FR-041"}) - baseline_ids)
                if missing:
                    errors.append(
                        "baseline FR-041 replacement summary is missing disposition "
                        "requirements: " + ", ".join(missing)
                    )


def extract_requirement_ids(value: str) -> set[str]:
    normalized = value.replace("`", "")
    requirement_ids = set(re.findall(r"\b(?:FR|SQ)-\d{3}\b", normalized))
    for match in re.finditer(
        r"\b(FR|SQ)-(\d{3})\s*–\s*(?:(FR|SQ)-)?(\d{3})\b",
        normalized,
    ):
        start_prefix, start_number, end_prefix, end_number = match.groups()
        if end_prefix and end_prefix != start_prefix:
            continue
        requirement_ids.update(
            f"{start_prefix}-{number:03d}"
            for number in range(int(start_number), int(end_number) + 1)
        )
    return requirement_ids


if __name__ == "__main__":
    raise SystemExit(main())
