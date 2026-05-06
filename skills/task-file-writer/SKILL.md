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
9. `受け入れ条件`
10. `検証計画`
11. `未決事項・リスク`

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
- `受け入れ条件`: Write observable completion checks. Avoid vague conditions such as "works well".
- `検証計画`: Name likely commands or checks. Mark environment-dependent checks as candidates, not completed.
- `未決事項・リスク`: State unknowns, migration concerns, compatibility risks, and test impact.

## Validation

Before finishing:

- Inspect changed task files for missing required sections.
- Run a trailing-whitespace check on created Markdown and skill files.
- Run `git diff --check` when practical.
- If a validation command is skipped, record the reason in the final response or post-task report.
