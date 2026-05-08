# Decisions

## 2026-05-08 — Use `.codex-memory` as auditable session memory

- Status: accepted
- Decision: Use `.codex-memory/` for durable project/session memory, contradiction records, repeated mistake patterns, archive candidates, audit logs, and dated dream reports.
- Rationale: The repository now includes `agent-dreaming-memory`, and the user requested an initial review using that Skill.
- Source: `.agents/skills/agent-dreaming-memory/SKILL.md`, current user request on 2026-05-08.
- Review trigger: Revisit if Codex gains a different official memory mechanism for this repository or if `.codex-memory` becomes too noisy.

## 2026-05-06 — Repository work must follow Worktree Task PR Flow

- Status: accepted
- Decision: Repository work involving edits, commands, investigation, validation, docs, commit, or PR uses a dedicated worktree, task file, acceptance criteria, validation, work report, commit, push, PR, acceptance comment, self-review comment, and task done movement.
- Rationale: A prior workflow miss made acceptance criteria and implementation results hard to trace on PR review.
- Source: `AGENTS.md`, `skills/worktree-task-pr-flow/SKILL.md`, `reports/bugs/20260506-1947-worktree-task-flow-miss.md`.
- Review trigger: Revisit only if `AGENTS.md` or `skills/worktree-task-pr-flow/SKILL.md` changes.

## 2026-05-07 — Project operation requirements are tracked as individual SWEBOK-lite files

- Status: accepted
- Decision: Project-operation constraints are split into `PRJ-001` through `PRJ-008`, including worktree use, task file management, docs structure, validation, security/RAG review, PR comments, work reports, and commit traceability.
- Rationale: One mixed project-operation file made acceptance criteria and evidence hard to trace.
- Source: `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md`.
- Review trigger: Revisit when repository workflow or required evidence changes.

## 2026-05-08 — Benchmark CodeBuild source is a CDK code default, not routine external context

- Status: accepted
- Decision: The benchmark CodeBuild source owner/repo/branch is treated as fixed IaC design data in CDK code rather than injected on every workflow run through `--context benchmarkSource*`.
- Rationale: The source is a repository design value, not a per-run environment parameter; keeping it in code improves reviewability and reproducibility.
- Source: `reports/working/20260508-0924-cdk-context-code-defaults.md`, commits in PR #188.
- Supersedes: Earlier mitigation that passed `benchmarkSource*` context explicitly through deploy and CI workflows.
- Review trigger: Revisit if benchmark CodeBuild needs to target per-environment or per-branch sources.

## 2026-05-06 — Human benchmark operator and service benchmark runner roles are separate

- Status: accepted
- Decision: Human performance-test operation uses a role with benchmark read/run permissions; `BENCHMARK_RUNNER` remains a service-runner style role for benchmark query and seed-corpus access.
- Rationale: Treating `BENCHMARK_RUNNER` as a human performance-test role caused role assignment to appear successful while Web/API access still failed.
- Source: `reports/bugs/20260506-2303-role-assignment-access-denied.md`.
- Review trigger: Revisit on role model, Cognito group, or benchmark UI permission changes.
