# Phase G Gap: async agent execution

- ファイル: `docs/spec/gap-phase-g.md`
- 種別: `SPEC_GAP`
- 作成日: 2026-05-14
- 状態: Draft
- 対象 task: `G-pre-gap`
- 後続 task: `G1-async-agent-foundation`, `G2-async-agent-claude-code`, `G3-async-agent-codex`, `G4-async-agent-opencode`

## Scope

Phase G は、仕様 4C「非同期エージェント実行」を対象にする。

この gap 調査ではコード変更を行わず、現行 API / Web / contract / infra / benchmark に存在する runId worker、debug trace target、benchmark artifact contract、CodeBuild runner、Secrets / IAM 基盤の流用可能性と、4C の未実装範囲を整理する。チャット内オーケストレーションや RAG tool registry は Phase F の成果を踏襲し、非同期エージェント本実装とは分けて扱う。

## Input Inventory

| ID | 種別 | 対象 | 確度 | 用途 |
|---|---|---|---|---|
| G-SPEC-4C | 仕様 | `docs/spec/2026-chapter-spec.md` 4C 章 | confirmed | AsyncAgentRun、provider、workspace mount、skill / agent profile、preset、artifact、writeback、認可、安全制約。 |
| G-SPEC-9A | 仕様 | `docs/spec/2026-chapter-spec.md` 9A 章 | confirmed | `async_agent_task` benchmark useCase と評価観点。 |
| G-SPEC-14A | 仕様 | `docs/spec/2026-chapter-spec.md` 14A 章 | confirmed | `asyncAgentRun` debug trace target と sanitize tier。 |
| G-SPEC-14D | 仕様 | `docs/spec/2026-chapter-spec.md` 14D 章 | confirmed | 非同期 worker runId 契約。 |
| G-SPEC-18-20 | 仕様 | `docs/spec/2026-chapter-spec.md` 18 / 19 / 20 章 | confirmed | `agent:*`, `skill:*`, `agent_profile:*`, `agent_preset:*` permission と role preset。 |
| G-IMPL-WORKER | 実装 | `apps/api/src/types.ts`, `apps/api/src/schemas.ts`, `apps/api/src/chat-run-worker.ts`, `apps/api/src/rag/memorag-service.ts` | confirmed | `WorkerTargetType` に `async_agent_run` が予約され、chat / document ingest は `{ runId }` worker 契約を持つ。 |
| G-IMPL-DEBUG | 実装 | `apps/api/src/schemas.ts`, `apps/api/src/types.ts`, `apps/web/src/features/debug/types.ts`, `docs/spec/gap-phase-j2.md` | confirmed | `DebugTraceTargetType` に `async_agent_run` が予約されるが、async agent trace producer / route はない。 |
| G-IMPL-BENCH | 実装 / docs | `packages/contract/src/schemas/benchmark.ts`, `docs/spec/benchmark-artifact-contract.md`, `benchmark/codebuild-suite.ts`, `benchmark/suites.codebuild.json`, `docs/spec/gap-phase-i.md` | confirmed | `async_agent_task` / `async_agent` は contract に予約されるが、CodeBuild manifest は agent/search/conversation runner まで。 |
| G-IMPL-INFRA | 実装 | `infra/lib/memorag-mvp-stack.ts` | confirmed | benchmark CodeBuild project、Secrets Manager auth、S3 artifact、Step Functions orchestration、IAM grant が存在する。async agent 用 project / state machine / secret はない。 |
| G-IMPL-AUTH | 実装 / docs | `apps/api/src/authorization.ts`, `apps/api/src/security/access-control-policy.test.ts`, `docs/spec/gap-phase-b.md` | confirmed | 3 層認可 foundation はあるが、`agent:*` / `skill:*` / `agent_profile:*` / `agent_preset:*` permission は現行 union / role にない。 |
| G-IMPL-QUALITY | 実装 / docs | `docs/spec/gap-phase-c.md`, `apps/api/src/rag/quality.ts` | confirmed | RAG evidence の quality gate は実装済み。async agent raw file mount には未接続。 |
| G-IMPL-TOOL | 実装 / docs | `docs/spec/gap-phase-f.md`, `apps/api/src/chat-orchestration/tool-registry.ts` | confirmed | ChatToolDefinition / ChatToolInvocation registry はあるが、非同期 provider tool-call enforcement とは別物。 |
| G-IMPL-WEB | 実装 | `apps/web/src/features/` | confirmed | admin / benchmark / chat / debug / documents / history / questions はあるが、async agent feature directory / UI はない。 |

## Spec Requirements Summary

| 章 / AC | 要求 summary | 現行分類 |
|---|---|---|
| 4C.2 / AC-ASYNC-AGENT-001..003 | Claude Code / Codex / OpenCode / custom provider と model を実行時に選択し、既定値を個人設定で保持する。 | missing |
| 4C.3 / AC-ASYNC-AGENT-013..014 | AsyncAgentRun を chat history とは別 run として保存し、status、ログ、成果物、コスト、失敗理由、キャンセルを扱う。 | missing |
| 4C.4 / AC-ASYNC-AGENT-004..007 | 共有フォルダ / 文書の original file を readOnly または writableCopy として workspace mount し、writeback は full 権限と明示承認を要求する。 | missing |
| 4C.5-4C.7 / AC-ASYNC-AGENT-008..012 | SkillDefinition / AgentProfileDefinition / AgentExecutionPreset を Markdown として作成・編集・共有し、実行時に権限を再確認してフラットに渡す。 | missing |
| 4C.8 | Web UI で provider / model / 対象 / skill / agent profile / preset / budget / timeout を選び、run 詳細を確認する。 | missing |
| 4C.9 / AC-ASYNC-AGENT-015 | AgentArtifact を保存し、download / folder 保存 / patch writeback を承認付きで扱う。 | missing |
| 4C.10-4C.11 | `agent:*`, `skill:*`, `agent_profile:*`, `agent_preset:*` と resource permission / Secrets / log sanitize / prompt injection 検査を適用する。 | partially covered |
| 9A | `async_agent_task` benchmark で raw file mount、skill / agent profile、成果物品質、writeback 承認フローを評価する。 | partially covered |
| 14A / 14D | AsyncAgentRun debug trace と worker runId 契約を持つ。 | partially covered |

## confirmed

| ID | 現行で確認できた事実 | 根拠 | 仕様との差分 |
|---|---|---|---|
| G-CONF-001 | `WorkerTargetType` / `WorkerTargetTypeSchema` は `async_agent_run` を値として予約している。 | `apps/api/src/types.ts`, `apps/api/src/schemas.ts` | worker target 型はあるが、async agent worker handler / executor はない。 |
| G-CONF-002 | `WorkerEventSchema` は `runId` 必須、`targetType` optional の `{ runId }` 互換契約を持つ。chat worker は `targetType=chat_run` を補い、runId から executor を起動する。 | `apps/api/src/schemas.ts`, `apps/api/src/chat-run-worker.ts` | G1 で AsyncAgentRun worker を足す場合、J2 の `{ runId }` 互換を流用できる。 |
| G-CONF-003 | `DebugTraceTargetType` は `async_agent_run` を予約し、Web debug type も同じ target を受けられる。 | `apps/api/src/schemas.ts`, `apps/api/src/types.ts`, `apps/web/src/features/debug/types.ts` | trace target 型だけで、provider / model / mount / artifact / failure reason の trace producer は未実装。 |
| G-CONF-004 | benchmark contract は `BenchmarkUseCase=async_agent_task` と `BenchmarkRunner=async_agent` を予約し、artifact contract では `async_agent` を scope-out と明記している。 | `packages/contract/src/schemas/benchmark.ts`, `docs/spec/benchmark-artifact-contract.md` | benchmark data contract は準備済みだが、async agent runner / suite manifest / metrics は未実装。 |
| G-CONF-005 | CodeBuild benchmark runner は Secrets Manager から auth token を解決し、失敗時 fail-fast、S3 artifact、DynamoDB metrics update、Step Functions startBuild.sync を持つ。 | `infra/lib/memorag-mvp-stack.ts`, `docs/spec/gap-phase-i.md` | provider runner の long-running execution / artifact upload へ設計を流用できるが、benchmark service principal と async agent provider credentials は分離が必要。 |
| G-CONF-006 | Phase B の 3 層認可 foundation は account status、feature permission、resource permission helper、route metadata / policy test を持つ。 | `docs/spec/gap-phase-b.md`, `apps/api/src/authorization.ts`, `apps/api/src/security/access-control-policy.test.ts` | `agent:*` 系 permission は未登録なので、G1 で union / role / route metadata / policy test の追加が必要。 |
| G-CONF-007 | Phase C の quality gate は authorized and quality-approved evidence を通常 RAG に渡す不変条件を実装済み。 | `docs/spec/gap-phase-c.md` | async agent raw file mount は chunk 検索ではないため、mount 対象の quality-approved / allowed policy を別途定義する必要がある。 |
| G-CONF-008 | Phase F は ChatToolDefinition / ChatToolInvocation registry を追加し、RAG 系 toolId を enabled、後続 phase 依存 tool を disabled metadata とした。 | `docs/spec/gap-phase-f.md` | 非同期 provider の tool-call enforcement / external execution approval は ChatTool registry とは別に設計する。 |
| G-CONF-009 | Phase J2 は debug 4 tier、public/auth middleware、SSE、worker runId 契約の preserve 条件を整理済み。 | `docs/spec/gap-phase-j2.md` | AsyncAgentRun trace / SSE / cancel / retry は G に委譲されている。 |

## partially_covered

| ID | 内容 | 根拠 | 残差分 |
|---|---|---|---|
| G-PART-001 | runId worker foundation | chat / document ingest worker と benchmark Step Functions は runId で実行対象を引く。 | AsyncAgentRun store、event store、worker handler、state machine / CodeBuild project、cancel / retry がない。 |
| G-PART-002 | debug target foundation | `async_agent_run` target 型はある。 | 4 tier visibility ごとの async agent trace schema、log redaction、artifact reference、provider error sanitize がない。 |
| G-PART-003 | benchmark artifact foundation | `async_agent_task` useCase と `async_agent` runner は contract にある。 | `benchmark/codebuild-suite.ts` は runner を `agent/search/conversation` のみに validate し、async agent suite は manifest にない。 |
| G-PART-004 | provider execution infra | benchmark CodeBuild runner は long-running build、Secrets、IAM、S3 artifact を扱う。 | Claude Code / Codex / OpenCode 用 credentials、workspace mount、network policy、budget / timeout / max tool calls enforcement、provider-specific adapter interface はない。 |
| G-PART-005 | resource authorization foundation | folder/document resource permission helper と route policy test がある。 | AsyncAgentRun create/cancel/read/artifact/writeback の operationKey、run ownership、selected file readOnly/full、permission revoked 中断は未定義。 |
| G-PART-006 | Web feature shell | Web は permission-driven features と debug / benchmark / admin panels を持つ。 | async agent run list/create/detail、skill/profile editor、preset UI、writeback approval UI は未実装。 |

## missing

| ID | 未実装 / 未整備 | 根拠 | 後続対応 |
|---|---|---|---|
| G-GAP-001 | `AgentRuntimeProvider`, `AgentModelSelection`, `AsyncAgentRun`, `AgentWorkspaceMount`, `AgentArtifact` の API / contract schema と store。 | `apps/api/src/types.ts`, `apps/api/src/schemas.ts`, `packages/contract/src/` に該当型なし。 | G1 で provider-neutral schema、store interface、local / DynamoDB adapter、OpenAPI route を追加する。 |
| G-GAP-002 | AsyncAgentRun API route (`/agents`, `/agents/runs`, `/agents/runs/:agentRunId`, `/agents/presets`, `/agents/skills`, `/agents/profiles`)。 | `apps/api/src/routes/` に agent route がない。 | G1 で最小 run create/list/get/cancel と read-only artifact metadata から開始する。 |
| G-GAP-003 | provider adapter interface と Claude Code / Codex / OpenCode adapter。 | 実行器固有 code / config / Secrets がない。 | G2/G3/G4 で provider ごとに分割し、G1 は adapter contract と disabled provider registry までに留める。 |
| G-GAP-004 | workspace mount 実装。original file、readOnly、writableCopy、tenant / user / run isolation、retention、permission revoked 追加読み込み停止がない。 | document ingest / benchmark corpus はあるが、4C の workspace mount model はない。 | G1 で readOnly mount manifest と sandbox workspace layout を定義し、writableCopy / writeback は承認付き follow-up とする。 |
| G-GAP-005 | writeback approval workflow。 | AgentArtifact / patch / diff / approval / rollback reason の schema と route がない。 | 初回は download-only artifact に限定し、writeback は G1 scope-out または明示承認 route までに分ける。 |
| G-GAP-006 | `SkillDefinition`, `AgentProfileDefinition`, `AgentExecutionPreset` の Markdown 管理、共有、version、prompt injection 検査。 | product skill / profile route / store / Web feature がない。 | G1 で schema / read route と execution snapshot、G2 以降で provider input flatten を実装する。 |
| G-GAP-007 | provider credentials / Secrets 管理。 | benchmark runner secret はあるが、agent provider credentials / tenant settings / rotation / log masking はない。 | CodeBuild Secrets pattern を流用しつつ、provider secret scope と IAM を benchmark service user から分離する。 |
| G-GAP-008 | budget / timeout / max tool calls / network policy / external send enforcement。 | 4C の budget object は現実装にない。 | Provider adapter に hard limit と run failure reason を返す contract を置き、logs / debug に secret を出さない。 |
| G-GAP-009 | AsyncAgentRun Web UI。 | `apps/web/src/features/` に async agent feature がない。 | G1 で No Mock Product UI を守る read-only run list/detail + empty/permission states、G2-G4 で provider selection を段階追加する。 |
| G-GAP-010 | async agent benchmark runner。 | `benchmark/codebuild-suite.ts` は async runner を validate しない。 | G 実装後に I follow-up として `async_agent_task` suite / metrics / artifact を追加する。 |

## divergent

| ID | 乖離 | 内容 | 扱い |
|---|---|---|---|
| G-DIV-001 | worker target naming | 仕様 4C は `AsyncAgentRun.agentRunId`、J2 worker target は `async_agent_run`、既存 worker input は `runId`。 | G1 では externally `agentRunId`、worker contract は `{ runId }` 互換にして mapping を明示する。 |
| G-DIV-002 | run status naming | 仕様 4C は `completed`、既存 chat / benchmark は `succeeded` を使う箇所がある。 | AsyncAgentRun は仕様どおりにするか既存 run UI と合わせるかを G1 open question とする。 |
| G-DIV-003 | permission namespace | 仕様は `agent:*`, `skill:*`, `agent_profile:*`, `agent_preset:*` を要求するが、現行 `authorization.ts` にない。 | B の互換方針に従い、rename ではなく新規 namespace と role preset 追加として扱う。 |
| G-DIV-004 | CodeBuild runner identity | benchmark CodeBuild は BENCHMARK_RUNNER service credential で API を叩く。async agent は user-owned run と provider credential が混在する。 | benchmark service principal を流用せず、run 作成時 user/resource authorization と provider execution secret を分離する。 |
| G-DIV-005 | RAG chunk vs original file | 現行 RAG は chunk / vector / manifest 再確認、4C は raw original file mount。 | RAG search gate をそのまま使わず、mount manifest で selected original file と resource permission / quality policy を固定する。 |

## Preserve Existing Behavior

| ID | 踏襲すべき既存挙動 | 根拠 | G での扱い |
|---|---|---|---|
| G-PRESERVE-001 | folder / document permission は API handler で判定し、LLM / provider に権限判断を任せない。 | `docs/spec/gap-phase-b.md`, 仕様 21 | mount 作成前に selected folder/document readOnly 以上を確認し、writeback は full + 明示承認にする。 |
| G-PRESERVE-002 | RAG の evidence は authorized and quality-approved に限定する。 | `docs/spec/gap-phase-c.md` | async agent は raw file mount でも、品質不適格・権限外ファイルを workspace に混ぜない。 |
| G-PRESERVE-003 | ChatToolDefinition / ChatToolInvocation registry はチャット内 tool 実行の監査基盤であり、非同期 provider 実行と混線させない。 | `docs/spec/gap-phase-f.md` | provider tool-call enforcement は別 contract とし、必要に応じて audit event へ写像する。 |
| G-PRESERVE-004 | benchmark corpus isolation は `source=benchmark-runner`, `docType=benchmark-corpus`, `benchmarkSuiteId`, `aclGroups=["BENCHMARK_RUNNER"]` を維持する。 | `docs/spec/gap-phase-i.md`, `docs/spec/benchmark-artifact-contract.md` | async agent benchmark 追加時も通常 chat / user corpus と混ぜない。 |
| G-PRESERVE-005 | debug trace は 4 tier / sanitize 方針を守り、raw prompt、credential、権限外文書、内部 policy を不用意に出さない。 | `docs/spec/gap-phase-j2.md` | provider logs / workspace file names / error detail は target tier ごとに redaction する。 |
| G-PRESERVE-006 | worker input `{ runId }` 互換、SSE `Last-Event-ID`、public allowlist、protected route metadata を壊さない。 | `docs/spec/gap-phase-j2.md` | AsyncAgentRun worker / SSE も access-control-policy test に追加する。 |
| G-PRESERVE-007 | Secrets Manager の secret、token、signed URL を logs / artifacts / debug trace に入れない。 | `docs/spec/gap-phase-i.md`, `infra/lib/memorag-mvp-stack.ts` | provider credential は masked env / IAM least privilege / sanitized failure reason で扱う。 |
| G-PRESERVE-008 | No Mock Product UI を守り、未実装 provider、固定ファイル、架空コスト、架空 run を本番 UI に表示しない。 | `AGENTS.md` No Mock Product UI | provider registry が disabled の場合は「利用不可 / 未設定」として表示し、demo fallback を置かない。 |

## G1-async-agent-foundation Scope

後続 `G1-async-agent-foundation` の最小 scope は次とする。

1. provider-neutral な `AgentRuntimeProvider`, `AgentModelSelection`, `AsyncAgentRun`, `AgentWorkspaceMount`, `AgentArtifact`, `SkillDefinition`, `AgentProfileDefinition`, `AgentExecutionPreset` schema を追加する。
2. `agent:*`, `skill:*`, `agent_profile:*`, `agent_preset:*` permission と role preset を `authorization.ts` / route metadata / `access-control-policy.test.ts` に追加する。
3. `/agents/runs` の create/list/get/cancel と read-only artifact metadata API を追加する。provider execution は disabled / not_configured を正直に返し、mock run を作らない。
4. selected folder/document readOnly、writeback target full、run ownership / managed read の resource condition を docs と tests に固定する。
5. worker contract は J2 の `{ runId }` 互換を維持し、`agentRunId` と `runId` の mapping を明記する。
6. Web は empty / permission denied / not configured / read-only run detail を最小表示し、架空 provider や架空 artifact を表示しない。
7. provider credentials / workspace execution / writeback は schema と boundary だけ定義し、本実行は G2-G4 に分割する。

## G2-G4 provider sub-PR split

| Sub-PR | 対象 | 最小 scope | 依存 |
|---|---|---|---|
| `G2-async-agent-claude-code` | Claude Code provider adapter | Claude Code の provider config、Secrets 解決、sandbox workspace 実行、log redaction、artifact upload、timeout / budget enforcement。 | G1 schema / store / worker / permission。 |
| `G3-async-agent-codex` | Codex provider adapter | Codex provider config、model selection、workspace mount、artifact collection、failure reason sanitize。 | G1 と G2 で確定した adapter interface。 |
| `G4-async-agent-opencode` | OpenCode provider adapter | OpenCode provider config、credential / network policy、artifact / log redaction、provider-specific error mapping。 | G1 adapter interface、G2/G3 の common runner helper。 |

各 provider PR は、provider-specific credential を Secrets Manager / local config へ分離し、他 provider の未設定状態を mock で埋めない。provider が disabled / not configured の場合は API と Web が正直に利用不可を返す。

## Scope-out

| ID | scope-out | 理由 / 委譲先 |
|---|---|---|
| G-OUT-001 | 初回 G1 で Claude Code / Codex / OpenCode の全 provider を同時実装する。 | provider credentials / sandbox / artifact / timeout 差が大きい。G2-G4 に分割する。 |
| G-OUT-002 | writeback の自動適用。 | 危険操作。full 権限、差分確認、明示承認、監査ログ、rollback 設計が必要。 |
| G-OUT-003 | skill / agent profile の AI 自動生成と prompt injection 判定の本格実装。 | Markdown store と共有権限を先に固める。生成支援は後続。 |
| G-OUT-004 | async agent benchmark の本実装。 | G1-G4 の run/artifact/provider 実装後に Phase I follow-up として扱う。 |
| G-OUT-005 | provider 外部ネットワークの細粒度 egress control / tenant policy enforcement。 | infra / runtime sandbox policy が必要。G1 では設定項目と deny default を記録する。 |
| G-OUT-006 | resource permission revoked の全 executor 強制停止。 | J2/B/C/E/G/I 横断。G1 では追加読み込み停止・cancel reason の設計に留める。 |
| G-OUT-007 | managed run 横断管理 UI / audit export。 | J3 / 14 監査ログと同期する。 |

## Open Questions

| ID | 種別 | 内容 | 次の判断 |
|---|---|---|---|
| G-OQ-001 | open_question | `AsyncAgentRun.status` は仕様の `completed` を使うか、既存 run 系の `succeeded` と UI mapping するか。 | API 互換と Web 表示の統一で決める。 |
| G-OQ-002 | open_question | `agentRunId` と worker `runId` を同一値にするか、外部 API は `agentRunId`、worker は `runId` alias とするか。 | J2 worker contract 互換と route path の読みやすさで決める。 |
| G-OQ-003 | open_question | workspace mount の source of truth は S3 original object key、DocumentManifest、または一時 workspace manifest のどれか。 | permission revoked、retention、artifact traceability を比較する。 |
| G-OQ-004 | open_question | raw file mount に Phase C quality gate を必須にするか、管理者 override / historical mode を許すか。 | 4C の raw file 活用と 21 の quality-approved evidence 不変条件の整合が必要。 |
| G-OQ-005 | open_question | provider credential は tenant-level、user-level、admin-managed service credential のどれを最初にサポートするか。 | Secrets scope、監査、コスト attribution、least privilege に影響する。 |
| G-OQ-006 | open_question | SkillDefinition / AgentProfileDefinition は document store の Markdown 文書を参照するか、専用 store に本文を持つか。 | folder sharing reuse、versioning、prompt injection scan、検索対象混入防止で決める。 |
| G-OQ-007 | open_question | provider tool-call enforcement を ChatToolInvocation と同じ audit record に寄せるか、AsyncAgentRunEvent として別管理するか。 | Phase F/J2 の debug/audit 表示と保存量に影響する。 |

## Targeted Validation For G

| 検証 | 目的 |
|---|---|
| `npm run typecheck -w @memorag-mvp/api` | AsyncAgentRun schema / route / worker / store の型整合性。 |
| `npm test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts` | agent route の protected/public 境界、route metadata、permission / resource condition。 |
| `npm test -w @memorag-mvp/api -- src/authorization.test.ts` | `agent:*`, `skill:*`, `agent_profile:*`, `agent_preset:*` role mapping と account status。 |
| `npm run typecheck -w @memorag-mvp/contract` | contract schema の互換性。 |
| `npm run typecheck -w @memorag-mvp/web` | async agent Web UI と API types。 |
| `npm test -w @memorag-mvp/web` | empty / permission denied / not configured / run detail / writeback approval UI regression。 |
| `npm run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts` | provider runner CodeBuild / Secrets / IAM / artifact bucket / timeout。 |
| `npm run test -w @memorag-mvp/benchmark` | async agent benchmark artifact 追加時の contract / runner regression。 |
| `git diff --check` | whitespace / conflict marker 確認。 |
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` | spec-recovery 更新の構造確認。 |

## G1-async-agent-foundation 実装メモ

- 追記日: 2026-05-14
- 対象 task: `G1-async-agent-foundation`
- 状態: implemented foundation

### implemented

| ID | 実装内容 | 根拠 |
|---|---|---|
| G1-IMPL-001 | provider-neutral な `AgentRuntimeProvider`、`AgentModelSelection`、`AsyncAgentRun`、`AgentWorkspaceMount`、`AgentArtifact`、`SkillDefinition`、`AgentProfileDefinition`、`AgentExecutionPreset` schema / type を API と contract package に追加した。 | `apps/api/src/schemas.ts`, `apps/api/src/types.ts`, `packages/contract/src/schemas/agents.ts` |
| G1-IMPL-002 | `agent:*`、`skill:*`、`agent_profile:*`、`agent_preset:*` permission と `ASYNC_AGENT_USER`、`SKILL_PROFILE_ADMIN`、`ASYNC_AGENT_ADMIN` role preset を追加した。 | `apps/api/src/authorization.ts`, `apps/api/src/authorization.test.ts` |
| G1-IMPL-003 | `/agents/providers`、`/agents/runs` create/list/get/cancel、`/agents/runs/{agentRunId}/artifacts` read-only metadata API を追加した。 | `apps/api/src/routes/agent-routes.ts` |
| G1-IMPL-004 | provider は G1 では実行せず、未設定/無効/利用不可を `blocked` run と `not_configured` / `provider_unavailable` で返す。架空 provider execution、架空 artifact、固定 cost は作らない。 | `MemoRagService.createAsyncAgentRun`, `agent-routes.test.ts` |
| G1-IMPL-005 | selected folder/document は readOnly mount metadata として扱い、service 層で read access を確認する。writeback は `agent:artifact:writeback` と `agentWritebackFull` boundary だけ定義し、本実行は scope-out とした。 | `MemoRagService.assertAsyncAgentSelectionsReadable`, `access-control-policy.test.ts` |
| G1-IMPL-006 | worker contract は J2 の `{ runId }` 互換を維持し、`agentRunId` と `runId` を同一値として保存する。`agentRunId` input は worker alias として受ける。 | `apps/api/src/async-agent-run-worker.ts`, `worker-contract.test.ts` |
| G1-IMPL-007 | Web は provider 未設定、empty、permission denied、read-only run detail の最小表示に限定した。 | `apps/web/src/features/agents/` |

### scope-out

- Claude Code / Codex / OpenCode / custom provider の本実行。
- provider credentials、workspace execution、実ファイル mount、writableCopy、writeback 適用。
- skill / agent profile / preset の CRUD UI と prompt injection 検査。
- async agent benchmark runner と debug trace producer。

## G2-async-agent-claude-code 実装メモ

- 追記日: 2026-05-15
- 対象 task: `G2-async-agent-claude-code`
- 状態: implemented provider adapter foundation

### implemented

| ID | 実装内容 | 根拠 |
|---|---|---|
| G2-IMPL-001 | `AsyncAgentProviderAdapter` / `AsyncAgentProviderRegistry` を追加し、G3/G4 が同じ interface を再利用できるようにした。 | `apps/api/src/async-agent/provider.ts` |
| G2-IMPL-002 | `claude_code` provider は `CLAUDE_CODE_COMMAND` が設定された場合のみ `available` とし、未設定時は `not_configured` を返して mock execution / mock artifact を作らない。 | `apps/api/src/async-agent/claude-code-provider.ts`, `MemoRagService.listAgentRuntimeProviders` |
| G2-IMPL-003 | AsyncAgentRun worker の service 実行経路で provider adapter を呼び、`running` → `completed` / `failed` / `expired` の状態遷移、artifact metadata 保存、sanitized log artifact 保存を行う。 | `MemoRagService.executeAsyncAgentRun`, `memorag-service.test.ts` |
| G2-IMPL-004 | provider input には run ID、requester、model、instruction、workspace mounts、skill/profile selections、budget を渡す。selected mount の read boundary は G1 service check を継続する。 | `AsyncAgentProviderInput`, `memorag-service.test.ts` |
| G2-IMPL-005 | provider stdout/stderr/failure text から API key、Bearer token、S3 signed URL credential/signature を redaction してから run failure / artifact storage に残す。 | `sanitizeProviderText`, `memorag-service.test.ts` |

### scope-out

- Codex / OpenCode provider の本実行。
- provider credential の UI 管理、Secrets rotation、tenant/user-level provider settings。
- writeback の自動適用、writableCopy の実ファイル同期、provider 外部 network policy の細粒度 enforcement。
- async agent benchmark runner の本実装。

## G3-async-agent-codex 実装メモ

- 追記日: 2026-05-15
- 対象 task: `G3-async-agent-codex`
- 状態: implemented Codex command provider

### implemented

| ID | 実装内容 | 根拠 |
|---|---|---|
| G3-IMPL-001 | G2 の command 実行処理を `CommandAsyncAgentProvider` として共通化し、Claude Code / Codex / OpenCode が同じ stdin JSON、stdout artifact、stderr log、timeout 境界を再利用できるようにした。 | `apps/api/src/async-agent/command-provider.ts`, `apps/api/src/async-agent/claude-code-provider.ts` |
| G3-IMPL-002 | `codex` provider は `CODEX_COMMAND` が設定された場合のみ `available` とし、未設定時は `not_configured` を返して mock execution / mock artifact を作らない。 | `apps/api/src/config.ts`, `apps/api/src/async-agent/claude-code-provider.ts`, `memorag-service.test.ts` |
| G3-IMPL-003 | Codex command provider は stdout を `codex-output.md` artifact として保存し、stderr は sanitized log artifact として保存する。stdout が空の場合は固定 artifact を作らない。 | `CommandAsyncAgentProvider`, `memorag-service.test.ts` |
| G3-IMPL-004 | Codex failure / timeout は `failed` / `expired` run として保存し、Bearer token、`CODEX_TOKEN`、API key、signed URL を redaction する。 | `sanitizeProviderText`, `memorag-service.test.ts` |
| G3-IMPL-005 | provider input には run ID、requester、model、instruction、workspace mounts、skill/profile selections、budget を渡す。selected mount の read boundary は G1/G2 service check を継続する。 | `CommandAsyncAgentProvider`, `MemoRagService.executeAsyncAgentRun`, `memorag-service.test.ts` |

### scope-out

- OpenCode provider の本実行。
- Codex credential の UI 管理、Secrets rotation、tenant/user-level provider settings。
- writeback の自動適用、writableCopy の実ファイル同期、provider 外部 network policy の細粒度 enforcement。
- async agent benchmark runner の本実装。

## G4-async-agent-opencode 実装メモ

- 追記日: 2026-05-15
- 対象 task: `G4-async-agent-opencode`
- 状態: implemented OpenCode command provider

### implemented

| ID | 実装内容 | 根拠 |
|---|---|---|
| G4-IMPL-001 | `opencode` provider を G3 の `CommandAsyncAgentProvider` に接続し、Claude Code / Codex / OpenCode が同じ stdin JSON、stdout artifact、stderr log、timeout 境界を使うようにした。 | `apps/api/src/async-agent/claude-code-provider.ts`, `apps/api/src/async-agent/command-provider.ts` |
| G4-IMPL-002 | `opencode` provider は `OPENCODE_COMMAND` が設定された場合のみ `available` とし、未設定時は `not_configured` を返して mock execution / mock artifact を作らない。 | `apps/api/src/config.ts`, `memorag-service.test.ts` |
| G4-IMPL-003 | OpenCode command provider は stdout を `opencode-output.md` artifact として保存し、stderr は sanitized log artifact として保存する。stdout が空の場合は固定 artifact を作らない。 | `CommandAsyncAgentProvider`, `memorag-service.test.ts` |
| G4-IMPL-004 | OpenCode failure / timeout は `failed` / `expired` run として保存し、`OPENCODE_TOKEN`、`OPENCODE_API_KEY`、Bearer token、signed URL を redaction する。 | `sanitizeProviderText`, `memorag-service.test.ts` |
| G4-IMPL-005 | provider input には run ID、requester、model、instruction、workspace mounts、skill/profile selections、budget を渡す。selected mount の read boundary は G1/G2/G3 service check を継続する。 | `CommandAsyncAgentProvider`, `MemoRagService.executeAsyncAgentRun`, `memorag-service.test.ts` |

### scope-out

- provider credential の UI 管理、Secrets rotation、tenant/user-level provider settings。
- writeback の自動適用、writableCopy の実ファイル同期、provider 外部 network policy の細粒度 enforcement。
- async agent benchmark runner の本実装。
