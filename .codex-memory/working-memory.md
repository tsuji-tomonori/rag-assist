# Working Memory

## Current durable context — updated 2026-05-08 12:11

### Project purpose

- `rag-assist` manages a MemoRAG-style internal QA chatbot MVP plus repository-local Codex/AI agent skills, task files, work reports, and specification recovery assets. Source: `README.md`.
- `memorag-bedrock-mvp` is an MVP for RAG quality, authorization boundaries, benchmark operation, docs, and PR workflow. Source: `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md`.

### Current implementation facts

- Repo-scoped Codex skills live under `.agents/skills/`; broader repository-local workflow and writing skills live under `skills/`. Source: `AGENTS.md`, `.agents/skills/agent-dreaming-memory/SKILL.md`, `skills/worktree-task-pr-flow/SKILL.md`.
- `agent-dreaming-memory` is installed and should be used for cross-session memory consolidation, contradiction detection, repeated mistake detection, and `.codex-memory` updates. Source: `.agents/skills/agent-dreaming-memory/SKILL.md`.
- Specification recovery work is part of the repository workflow and should use `skills/rag-assist-spec-completion-orchestrator/SKILL.md`, placing artifacts under `docs/spec-recovery/` and validating with `scripts/validate_spec_recovery.py` when applicable. Source: `AGENTS.md`, `README.md`.
- The project has formal project-operation requirements `PRJ-001` through `PRJ-008` covering worktrees, task files, docs structure, validation, security/RAG review, PR comments, work reports, and commit traceability. Source: `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md`.

### User/team preferences

- For repository work involving edits, commands, investigation, validation, docs, commit, or PR, create a dedicated worktree from `origin/main`, create a `tasks/do/` task file before deliverable edits, and complete with commit, push, PR, acceptance comment, self-review comment, and task move to `tasks/done/`. Source: `AGENTS.md`, `skills/worktree-task-pr-flow/SKILL.md`.
- PR title, PR body, PR comments, and review comments must be Japanese. Commit messages should use gitmoji + Conventional Commit style with Japanese summary. Source: `AGENTS.md`, `skills/japanese-pr-title-comment/SKILL.md`, `skills/japanese-git-commit-gitmoji/SKILL.md`.
- Do not claim unrun checks as passed. Record skipped or blocked validation with the command or check name and concrete reason. Source: `AGENTS.md`, `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_005.md`.
- Routine PR comments should prefer GitHub Apps when available; if PR creation tooling is unavailable through GitHub Apps, record the limitation and use the best approved fallback without hiding the limitation. Source: `AGENTS.md`, `skills/github-apps-pr-operator/SKILL.md`, recent PR #187 workflow.

### Non-negotiable constraints

- Never weaken RAG grounding: answers must cite source document locations, insufficient evidence must refuse, benchmark quality checks must not be bypassed by expected phrase, QA sample row id, dataset-specific branch, or hard-coded domain term hacks. Source: `AGENTS.md`, `skills/pr-review-self-review/SKILL.md`.
- API route, middleware, auth/RBAC, owner boundaries, management APIs, public exposure, and sensitive schemas/stores require security access-control review. Protected route changes must update static access-control policy tests when relevant. Source: `AGENTS.md`, `skills/security-access-control-reviewer/SKILL.md`.
- `memorag-bedrock-mvp/docs` updates should follow SWEBOK-lite structure as much as possible, with one requirement per file and acceptance criteria in the same file. Source: `AGENTS.md`, `memorag-bedrock-mvp/docs/DOCS_STRUCTURE.md`.
- `.codex-memory` is an auditable memory layer. Do not silently delete, overwrite, compact, or store secrets in it. Archive candidates are recommendations only. Source: `.agents/skills/agent-dreaming-memory/SKILL.md`.

### Active risks and watchpoints

- Workflow drift has already happened: a prior PR missed task creation and acceptance-comment steps. Always include task file, acceptance comment, and task done movement in Done conditions before implementation. Source: `reports/bugs/20260506-1947-worktree-task-flow-miss.md`.
- CI failures often surface after PR creation, especially coverage, API contract, lint type-only imports, and GitHub Actions workflow changes. Watch PR checks after each push and repair before claiming completion. Source: `reports/working/20260508-0102-fix-api-ci-after-route-split.md`, `reports/working/20260507-2035-async-ingest-runs.md`, PR #187 CI follow-up.
- RBAC has had source-of-truth drift between admin ledger, Cognito groups, JWT groups, and Web permission checks. Role or permission work must update API, Cognito/group sync, Web gates, workflows, docs, and tests together. Source: `reports/bugs/20260506-2303-role-assignment-access-denied.md`, `reports/bugs/20260502-1135-question-escalation-forbidden.md`.
- Deployment workflow triggers and CDK context assumptions can silently break post-merge deploys. Workflow trigger changes and CDK context/default changes need local static checks plus actual GitHub Actions confirmation when possible. Source: `reports/bugs/20260508-0049-main-merge-deploy-not-triggered.md`, `reports/bugs/20260508-0902-cdk-benchmark-context-required.md`, `reports/working/20260508-0924-cdk-context-code-defaults.md`.
- Benchmark corpus ingestion and OCR can fail in AWS-only timing conditions. Treat large PDF/Textract behavior and CodeBuild runner artifacts as operationally sensitive and record unverified AWS reruns explicitly. Source: `reports/bugs/20260507-2029-mmrag-textract-timeout.md`.

### Next-session startup checklist

- Run `git status --short --branch` and check for unrelated untracked or user changes before editing.
- If the task is repository work, read `AGENTS.md` plus the directly relevant `skills/**/SKILL.md` or `.agents/skills/**/SKILL.md`; do this even when the skill is not listed in the active tool context.
- Create a dedicated worktree from `origin/main` and create the task file in `tasks/do/` before deliverable edits.
- Select validation from changed files, run targeted checks, and watch PR CI after push.
- Before final response, confirm there are no unmanaged long-running sessions, unresolved validation failures, or stale `tasks/do/` entries for the current task.
