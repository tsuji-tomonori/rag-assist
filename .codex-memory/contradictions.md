# Contradictions

## 2026-05-08 — No unresolved instruction contradiction found in authoritative current sources

- Claim A: Repository work must run through Worktree Task PR Flow unless the user explicitly asks for plan-only, pure question answering, or no worktree/commit/PR.
  - Source: `AGENTS.md`, `skills/worktree-task-pr-flow/SKILL.md`.
  - Authority: Current repository-level instructions and workflow Skill.
- Claim B: Some older work reports describe worktree/commit/PR work without task file or PR acceptance comment.
  - Source: `reports/bugs/20260506-1947-worktree-task-flow-miss.md`, older `reports/working/*`.
  - Authority: Historical work traces and explicit incident record, lower authority for future behavior.
- Current handling: use Claim A. The historical mismatch is resolved as an error pattern rather than an active contradiction.
- Risk if unresolved: Future agents may repeat incomplete workflow evidence and mark work done too early.

## 2026-05-08 — Deploy trigger security vs main merge deployment

- Claim A: Removing automatic deploy triggers reduces accidental or unsafe deploy risk.
  - Source: `reports/working/20260502-0000-disable-auto-deploy-workflow.md`, referenced by `reports/bugs/20260508-0049-main-merge-deploy-not-triggered.md`.
  - Authority: Historical mitigation record.
- Claim B: Main merge should trigger `Deploy MemoRAG MVP` so dev deployment follows merged application and infra changes.
  - Source: `reports/bugs/20260508-0049-main-merge-deploy-not-triggered.md`.
  - Authority: Later incident analysis and fix.
- Current handling: use Claim B with guardrails. Keep `push.branches: [main]`, main-only job guard, and checkout ref protection.
- Risk if unresolved: Either main merges do not deploy, or unsafe deploy paths are reintroduced without branch guard.

## 2026-05-08 — CDK external context vs code-owned benchmark source defaults

- Claim A: Passing CDK context via CLI/workflow is a valid CDK mechanism and temporarily fixed missing benchmark source context.
  - Source: `reports/bugs/20260508-0902-cdk-benchmark-context-required.md`.
  - Authority: Incident mitigation with validation.
- Claim B: The benchmark source is fixed IaC design data and should live in CDK code rather than be injected on every run.
  - Source: `reports/working/20260508-0924-cdk-context-code-defaults.md`.
  - Authority: Later design review and merged follow-up.
- Current handling: use Claim B. Treat Claim A as a superseded mitigation, not an active requirement.
- Risk if unresolved: Agents may reintroduce workflow context injection and create drift between workflow commands and CDK code defaults.

## 2026-05-08 — Admin ledger roles vs Cognito/JWT effective permissions

- Claim A: Older admin UI work treated role assignment in the admin ledger as the visible management action.
  - Source: `reports/working/20260504-1149-pr100-review-fixes.md`.
  - Authority: Historical implementation state.
- Claim B: Effective authorization comes from Cognito groups/JWT-derived permissions, so role assignment must sync the actual authorization source and separate human operator roles from service runner roles.
  - Source: `reports/bugs/20260506-2303-role-assignment-access-denied.md`.
  - Authority: Later incident report and resolved correction.
- Current handling: use Claim B.
- Risk if unresolved: Admin UI can show a role while API/Web still deny access, causing operational misconfiguration.
