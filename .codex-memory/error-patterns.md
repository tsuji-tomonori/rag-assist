# Error Patterns

## 2026-05-08 — Repository workflow evidence is easy to omit

- Pattern: Worktree + PR tasks can complete implementation and validation while missing task-file creation, acceptance criteria confirmation comment, or task done movement.
- Evidence: `reports/bugs/20260506-1947-worktree-task-flow-miss.md`; `AGENTS.md` now explicitly requires the full flow.
- Likely trigger: The user asks for code/PR work and the agent applies generic commit/PR handling without reading repository-local workflow Skills.
- Corrective rule: Before deliverable edits, read `AGENTS.md` and `skills/worktree-task-pr-flow/SKILL.md`, create `tasks/do/<timestamp>-<summary>.md`, and include PR acceptance comment plus task done movement in Done conditions.
- Verification: Check `tasks/do`, `tasks/done`, PR top-level comments, and final `git status --short --branch` before final response.
- Confidence: high

## 2026-05-08 — CI failures often appear after otherwise valid local changes

- Pattern: PR CI fails on lint, coverage, contract tests, or merge-ref interactions even when the local targeted change looks unrelated.
- Evidence: `reports/working/20260508-0102-fix-api-ci-after-route-split.md`, `reports/working/20260507-2035-async-ingest-runs.md`, PR #187 initial CI fail and rebase/pass cycle.
- Likely trigger: Branch is behind `origin/main`, coverage gates are near threshold, or tests depend on merge-ref state.
- Corrective rule: Fetch/rebase against latest `origin/main` before PR or after CI failure, run the failing command locally when feasible, and watch PR checks after every push.
- Verification: `gh pr checks <number> --watch --interval 10` or equivalent PR check inspection; record final CI status.
- Confidence: high

## 2026-05-08 — Authorization source-of-truth can drift across ledger, Cognito, JWT, API, and Web

- Pattern: A role or permission appears assigned in one layer but is not reflected in the effective permission source used by API/Web.
- Evidence: `reports/bugs/20260506-2303-role-assignment-access-denied.md`, `reports/bugs/20260502-1135-question-escalation-forbidden.md`.
- Likely trigger: Updating admin ledger, UI visibility, or route permission checks without synchronizing Cognito groups, JWT-derived permissions, Web permission gates, and tests.
- Corrective rule: For role/permission changes, update and test API permissions, Cognito group synchronization, Web gating, creation workflows, docs, and static access-control policy together.
- Verification: API authorization tests, Web permission/visibility tests, and `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` when protected routes change.
- Confidence: high

## 2026-05-08 — Workflow/CDK configuration can break only after merge or deploy

- Pattern: Static local checks pass while deploy workflow triggers or CDK context assumptions fail in GitHub Actions.
- Evidence: `reports/bugs/20260508-0049-main-merge-deploy-not-triggered.md`, `reports/bugs/20260508-0902-cdk-benchmark-context-required.md`, `reports/working/20260508-0924-cdk-context-code-defaults.md`.
- Likely trigger: Changing GitHub Actions `on:` triggers, job guards, checkout refs, or CDK context keys without testing the omitted/default path.
- Corrective rule: For workflow and CDK changes, inspect triggers and branch guards, run synth/test with omitted context where supported, and confirm post-merge or PR GitHub Actions behavior.
- Verification: `git diff --check`, workflow YAML validation/pre-commit, `task memorag:cdk:test`, `task memorag:cdk:synth:yaml`, and GitHub Actions run inspection.
- Confidence: high

## 2026-05-08 — Benchmark corpus and AWS-only processing need explicit degraded-path handling

- Pattern: Large PDF/Textract or CodeBuild environment timing can turn one corpus item into a fatal benchmark runner failure.
- Evidence: `reports/bugs/20260507-2029-mmrag-textract-timeout.md`.
- Likely trigger: Treating ingestion/OCR failure as runner-fatal instead of classifying unextractable corpus rows and documenting skipped rows.
- Corrective rule: Benchmark ingestion should distinguish fatal runner failures from corpus-row extraction failures and preserve artifacts explaining skipped rows.
- Verification: Benchmark unit tests for skipped/unextractable paths and AWS CodeBuild rerun when behavior is environment-dependent.
- Confidence: medium

## 2026-05-08 — Coverage gates have little headroom

- Pattern: Web/API coverage checks can fail after reasonable feature changes because branch coverage sits close to required thresholds.
- Evidence: `reports/working/20260507-2216-web-coverage-todo.md`, `reports/working/20260507-2035-async-ingest-runs.md`, `reports/working/20260508-0102-fix-api-ci-after-route-split.md`.
- Likely trigger: Adding user-visible branches, async states, failure states, or API routes without matching targeted tests.
- Corrective rule: Add tests for new success, failure, permission, timeout/cancelled, and optional-field branches with the implementation change.
- Verification: `npm run test:coverage -w @memorag-mvp/web` or API c8 coverage command when web/API branch coverage is affected.
- Confidence: medium
