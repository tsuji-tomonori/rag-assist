# Archive Candidates

## 2026-05-08 — Historical reports that duplicate current project-operation requirements

- Candidate: older `reports/working/*` entries that only restate worktree/task/PR/report workflow now captured by `AGENTS.md`, `skills/worktree-task-pr-flow/SKILL.md`, and `REQ_PROJECT_001` through `REQ_PROJECT_008`.
- Reason: duplicate
- Keep because: They are audit history and evidence for why the current workflow exists.
- Proposed action: keep in place; optionally link representative reports from `.codex-memory` rather than deleting or compacting them.
- Confidence: medium

## 2026-05-08 — Superseded CDK benchmark context mitigation notes

- Candidate: guidance or report sections that say deploy/CI workflows must pass `--context benchmarkSourceOwner`, `benchmarkSourceRepo`, and `benchmarkSourceBranch` for every CDK command.
- Reason: superseded
- Keep because: They document the incident timeline and why the later code-default decision was made.
- Proposed action: keep as historical; when writing future docs or task plans, treat `reports/working/20260508-0924-cdk-context-code-defaults.md` as the current source.
- Confidence: high

## 2026-05-08 — Older role-assignment notes that separate admin ledger from effective Cognito/JWT permissions

- Candidate: older notes describing `assignUserRoles()` as ledger-only or requiring external group assignment as normal behavior.
- Reason: superseded
- Keep because: They explain the RBAC incident and source-of-truth drift.
- Proposed action: keep as historical; future role changes should cite `reports/bugs/20260506-2303-role-assignment-access-denied.md` as the current corrective source.
- Confidence: high

## 2026-05-08 — Current root worktree untracked reports not present in `origin/main`

- Candidate: untracked files observed in the original root worktree before this pass, including several `reports/working/*.md` and `tasks/done/*.md`.
- Reason: needs review
- Keep because: They may be user-owned local artifacts or pending work from another task; this pass intentionally used a clean worktree and did not import them.
- Proposed action: do not delete. Review from the original worktree separately if the user wants local artifact cleanup or migration.
- Confidence: medium

## 2026-05-08 — `tasks/todo/` backlog of RAG quality roadmap tasks

- Candidate: `tasks/todo/20260506-1203-*` and related unstarted RAG quality tasks.
- Reason: stale or pending, not duplicate
- Keep because: They represent active roadmap ideas such as adaptive retrieval calibration, typed claim conflict, structured fact planning, and benchmark profiles.
- Proposed action: keep as backlog. Review priority before implementation; do not auto-close from memory consolidation.
- Confidence: medium
