---
name: task-file-writer
description: リポジトリ内で実装・調査・改善タスクを Markdown ファイルとして分解、作成、更新する。Use when Codex needs to create reports/tasks task files, convert a report or plan into one-task-per-file work items, or write background, policy, required context, acceptance criteria, execution plan, validation, and risks for future implementation tasks.
---

# Task File Writer

## Overview

Use this skill to convert a plan, investigation report, review finding, roadmap, or user request into repository-local task files. Keep each file scoped to exactly one executable task.

## Output Location

- Default directory: `reports/tasks/`.
- Create the directory if it does not exist.
- Use Markdown files only.
- Use the repository work-report filename convention:
  - `YYYYMMDD-HHMM-<task-summary>.md`
  - `<task-summary>` must be short ASCII lowercase kebab-case.
- Do not combine multiple implementation goals in one task file.

## Required Sections

Each task file must include these sections:

1. `# <task title>`
2. `保存先`
3. `背景`
4. `目的`
5. `対象範囲`
6. `方針`
7. `必要情報`
8. `実行計画`
9. `ドキュメントメンテナンス計画`
10. `受け入れ条件`
11. `検証計画`
12. `PRレビュー観点`
13. `未決事項・リスク`

Use Japanese prose unless the user requests another language. Keep file paths, commands, API names, type names, and function names in their original spelling.

## Task Decomposition

When converting a report or plan:

- Treat each independent implementation outcome as a separate task.
- Include all tasks, regardless of priority, unless the user explicitly asks to filter.
- Split broad platform work from domain-specific cleanup.
- If one task depends on another, record it under `必要情報` or `未決事項・リスク`; do not merge them.
- Preserve source references such as report paths, code paths, issue IDs, PR numbers, or benchmark names.

## Writing Guidance

For each task:

- `背景`: Explain why the task exists and what concrete problem it addresses.
- `目的`: State the desired outcome in one or two sentences.
- `対象範囲`: List files, modules, docs, tests, or behavior likely to be touched.
- `方針`: Describe the implementation approach and design constraints.
- `必要情報`: Include prior reports, relevant code paths, assumptions, dependencies, and decisions needed before implementation.
- `実行計画`: Write concrete steps in execution order.
- `ドキュメントメンテナンス計画`: State which requirements, architecture/design, README, API examples, OpenAPI, local verification, operations, deploy docs, and PR body notes must be updated or explicitly judged unaffected.
- `受け入れ条件`: Write observable completion checks. Avoid vague conditions such as "works well".
- `検証計画`: Name likely commands or checks. Mark environment-dependent checks as candidates, not completed.
- `PRレビュー観点`: Translate repository review expectations into checks that reviewers can apply to the future PR.
- `未決事項・リスク`: Prefer explicit decisions over unresolved questions. Decide recommended defaults when reasonable, and leave only truly implementation-dependent items as proposals or risks.

## Documentation Maintenance Policy

Every task that can affect code, behavior, API contracts, data schemas, RAG quality, benchmark output, security, operations, or developer workflows must include a concrete `ドキュメントメンテナンス計画`.

The plan should cover the relevant subset below:

- Requirements:
  - identify related `FR-*`, `NFR-*`, `SQ-*`, and `TC-*`
  - update or add one-requirement-per-file docs when behavior or acceptance criteria change
  - keep "what must be true" in requirements and move "how to implement" to architecture / design docs
- Architecture / design:
  - update RAG workflow, authorization, search, benchmark, debug trace, data structure, API, or deployment design docs when affected
  - preserve traceability to ASR / ADR / DES docs
- User / developer docs:
  - update root `README.md`, `memorag-bedrock-mvp/README.md`, `docs/API_EXAMPLES.md`, OpenAPI targets, `docs/LOCAL_VERIFICATION.md`, `docs/OPERATIONS.md`, and deploy docs when behavior, API, verification, environment variables, permissions, rollback, cost, or deployment changes
- PR body:
  - if a doc is intentionally not updated, require the future PR body to explain why it is unaffected
  - list unrun checks and residual documentation risks

## Decision Policy

When updating or creating task files:

- Do not leave "要判断" or "未決" as a placeholder if the repository context supports a conservative default.
- Use `決定事項` for recommended choices that should guide implementation.
- Use `実装時確認` only when the answer depends on runtime measurements, missing stakeholder input, AWS account state, or data that is not available in the repository.
- Use `リスク` for known hazards such as compatibility, security, cost, latency, migration, or benchmark instability.
- Prefer backward-compatible decisions:
  - keep existing API request / response behavior unless the task explicitly requires a contract change
  - add optional fields before required fields
  - keep new RAG policies opt-in until benchmark evidence supports default changes
  - preserve existing manifests / artifacts through runtime fallback
  - record profile id / version when behavior becomes configurable

## PR Review Checklist Base

Every implementation task for `rag-assist` / `memorag-bedrock-mvp` should include task-specific review points covering the relevant subset below:

- PR whole:
  - title, body, semver, changed scope, reports, unverified checks, and risks are clear
  - one PR does not mix unrelated goals
- Requirements and docs:
  - feature or behavior changes update related `FR-*`, `NFR-*`, `SQ-*`, or `TC-*` docs when needed
  - requirements stay separate from architecture / design details
  - README, API examples, local verification, operations, deploy docs, and OpenAPI are updated or explicitly judged unaffected
- Architecture and RAG workflow:
  - changes respect `ASR-TRUST-001`, `ASR-GUARD-001`, `ASR-RETRIEVAL-001`, `ASR-EVAL-001`, and `ASR-SEC-*`
  - retrieval, rerank, answerability gate, sufficient context gate, citation validation, and support verification responsibilities stay separate
  - debug trace records decision reasons needed for investigation
- Testing:
  - tests match the changed layer: API, Web, Infra, Benchmark, docs, or smoke
  - normal, error, boundary, permission, missing data, no-answer, ambiguous query, conflicting evidence, unsupported citation, and compatibility cases are covered when relevant
  - unrun checks are not claimed as complete
- Security and access control:
  - `authMiddleware`, `requirePermission`, role boundaries, response filtering, debug trace access, benchmark artifact access, ACL metadata, alias data, raw prompt, chunk text, tokens, and internal memo exposure are reviewed
- RAG quality:
  - registered documents, computed facts, or explicit evidence ground answers
  - insufficient evidence refuses safely
  - citations point to retrieved chunks
  - retrieval changes are evaluated for recall, precision, refusal precision, unsupported rate, citation hit rate, and latency where relevant
- Data, compatibility, and migration:
  - optional fields remain backward-compatible
  - required field additions, manifest changes, benchmark schema changes, embedding dimension changes, reindex, cutover, and rollback are called out
- Operations, dependencies, and configuration:
  - environment variables, IAM, Cognito, S3, S3 Vectors, Bedrock, GitHub Actions, cost, logging, and deployment implications are documented when affected

Use review comment severity labels when capturing expected review outcomes:

- `blocking`: merge would create a safety, compatibility, security, or operational problem
- `should fix`: should be fixed before merge for quality or maintainability
- `suggestion`: optional quality improvement
- `question`: intent or scope clarification

## Validation

Before finishing:

- Inspect changed task files for missing required sections.
- Ensure each task has a `ドキュメントメンテナンス計画` section.
- Ensure each task has a `PRレビュー観点` section.
- Ensure `未決事項・リスク` uses explicit `決定事項` where a recommended choice is possible.
- Run a trailing-whitespace check on created Markdown and skill files.
- Run `git diff --check` when practical.
- If a validation command is skipped, record the reason in the final response or post-task report.
