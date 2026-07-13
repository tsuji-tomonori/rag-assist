---
name: rag-assist-spec-completion-orchestrator
description: Use when completing rag-assist requirements, specifications, acceptance criteria, Japanese E2E scenarios, traceability, or gap analysis from work reports, tickets, PRs, existing docs, or tests.
---

# rag-assist Specification Completion Orchestrator

## What this skill does

Use this skill when completing requirements, specifications, acceptance criteria, E2E scenarios, or traceability for `rag-assist` from work reports, tickets, PR descriptions, commit logs, issue reports, existing specs, or test files.

The skill coordinates the full pipeline:

```text
work reports / tickets / PRs / existing docs
  -> facts
  -> tasks
  -> acceptance criteria
  -> E2E scenarios
  -> operation/expectation groups
  -> requirements/specifications
  -> traceability matrix
  -> gap analysis/open questions
```

## Required inputs

Accept any of the following:

- Work reports
- Tickets/issues
- PR descriptions
- Commit messages
- Existing specs
- README or architecture docs
- Screenshots or screen descriptions
- Existing E2E/unit/API tests
- User-provided domain notes

If some inputs are missing, proceed with the available material and mark gaps explicitly.

## Core rules

- Every generated item must carry a `source` when possible.
- Separate facts from inference.
- Do not treat screen operations as the entire requirement. Use screen operations as verifiable examples of broader requirements.
- Keep Japanese output for requirements, acceptance criteria, and E2E scenarios unless the repository convention is clearly English.
- Prefer atomic tasks: one actor, one intent, one observable outcome.
- Preserve IDs across iterations. Do not renumber existing IDs unless explicitly requested.
- Use confidence labels:
  - `confirmed`: directly supported by source material.
  - `inferred`: likely but not explicitly stated.
  - `conflict`: contradicted by another source.
  - `open_question`: cannot be decided from available material.

## Execution steps

1. Inventory sources.
   - Create a task-scoped analysis report such as `reports/working/YYYYMMDD-HHMM-<summary>-spec-analysis.md`.
   - Add an `Input inventory` section to that report.
   - List each input source, date if known, type, and reliability.

2. Extract facts and tasks.
   - Invoke or follow `work-report-task-extractor-ja`.
   - Add `Report facts` and `Candidate tasks` sections to the task-scoped analysis report.

3. Write acceptance criteria.
   - Invoke or follow `acceptance-criteria-writer-ja`.
   - Include normal path, error path, permission path, boundary values, and RAG quality paths.
   - Add an `Acceptance criteria` section to the task-scoped analysis report.

4. Generate E2E scenarios.
   - Invoke or follow `e2e-scenario-writer-ja`.
   - Write screen operations and expected results in Japanese.
   - Add an `E2E and non-UI scenarios` section to the task-scoped analysis report.

5. Group operations and expectations.
   - Invoke or follow `operation-expectation-clusterer-ja`.
   - Add an `Operation and expectation groups` section to the task-scoped analysis report.

6. Synthesize requirements and specifications.
   - Invoke or follow `requirement-spec-synthesizer-ja`.
   - Write each approved requirement to one file under `docs/1_要求_REQ/`.
   - Route architecture and design decisions to `docs/2_アーキテクチャ_ARC/` or `docs/3_設計_DES/` instead of creating a second specification tree.

7. Add RAG quality and security specs.
   - Invoke or follow `rag-quality-and-security-spec-ja`.
   - Integrate output into the canonical requirement files, architecture/design files, and the current requirements baseline gap table.

8. Build traceability and gap analysis.
   - Invoke or follow `traceability-gap-analysis-ja`.
   - Update `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md` for durable traceability.
   - Update the current `REQUIREMENTS_BASELINE_*.md` gap/open-question sections and create or reuse `tasks/todo/` files for unimplemented requirements.

9. Final review.
   - Ensure all tasks have acceptance criteria.
   - Ensure all acceptance criteria have at least one E2E or non-UI verification.
   - Ensure all requirements/specifications trace to evidence or are marked inferred/open.
   - Ensure security, RAG quality, and non-functional requirements are not omitted.

## Output routing

Do not create a parallel specification directory. Use this routing:

```text
reports/working/YYYYMMDD-HHMM-<summary>-spec-analysis.md  # intermediate evidence
docs/1_要求_REQ/                                           # approved requirements, gap, trace
docs/2_アーキテクチャ_ARC/                                 # architecture and ADR
docs/3_設計_DES/                                           # implementation contracts
docs/4_運用_OPS/21_監視_MONITORING/                        # monitoring/verification only
tasks/todo/                                                # missing or partial implementation
```

`docs/generated/` is reserved for repository generators and must never receive authored analysis.

## Final response format

When done, report:

```markdown
## 実施結果
- 作成/更新したファイル:
- 抽出した task 数:
- 受け入れ条件数:
- E2Eシナリオ数:
- 要件数:
- 仕様数:
- 未確定質問数:

## 重要な未確定点
...

## 次に人間が確認すべきこと
...
```
