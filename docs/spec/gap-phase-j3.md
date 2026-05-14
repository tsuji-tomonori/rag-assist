# Phase J3 Gap: admin dashboard, users/groups, roles, usage/cost, and audit

- ファイル: `docs/spec/gap-phase-j3.md`
- 種別: `SPEC_GAP`
- 作成日: 2026-05-14
- 状態: Draft
- 対象 task: `J3-pre-gap`
- 後続 task: `J3-admin-dashboard-unified`

## Scope

Phase J3 は、仕様 10「管理ダッシュボード」、11「ユーザー・グループ管理」、12「ロール・権限管理」、13「利用状況・コスト」、14「監査ログ」を対象にする。

この gap 調査ではコード変更を行わず、現行 `apps/web/src/features/admin/`、admin API routes、`/me`、authorization contract、route-level static policy、generated web inventory の差分、踏襲すべき既存挙動、後続 `J3-admin-dashboard-unified` の scope / scope-out を整理する。J2 で整備した debug 4 tier / public endpoint / auth middleware 境界と、I で整備した benchmark artifact contract / runner 権限境界は弱めない。

## Input Inventory

| ID | 種別 | 対象 | 確度 | 用途 |
|---|---|---|---|---|
| J3-SPEC-10 | 仕様 | `docs/spec/2026-chapter-spec.md` 10 章 | confirmed | 管理ダッシュボード、Action card、KPI、権限別カード、受け入れ条件。 |
| J3-SPEC-11 | 仕様 | `docs/spec/2026-chapter-spec.md` 11 章 | confirmed | ユーザー一覧・詳細、グループ一覧・詳細、危険操作、受け入れ条件。 |
| J3-SPEC-12 | 仕様 | `docs/spec/2026-chapter-spec.md` 12 章 | confirmed | ロール定義、機能権限と文書権限の分離、差分/理由/監査。 |
| J3-SPEC-13 | 仕様 | `docs/spec/2026-chapter-spec.md` 13 章 | confirmed | usage/cost 集計、個人情報境界、export、異常利用。 |
| J3-SPEC-14 | 仕様 | `docs/spec/2026-chapter-spec.md` 14 章 | confirmed | 監査ログ項目、必須監査対象、検索/フィルタ/export、認可。 |
| J3-MAP | 章対応表 | `docs/spec/CHAPTER_TO_REQ_MAP.md` 10/11/12/13/14 行 | confirmed | 章別仕様と既存 REQ / 実装の対応状態。 |
| J3-WEB-ADMIN | 実装 | `apps/web/src/features/admin/` | confirmed | AdminWorkspace、overview tiles、user/role/usage/cost/audit/alias panels、権限別 data load。 |
| J3-WEB-PERM | 実装 | `apps/web/src/app/hooks/usePermissions.ts`, `useAppShellState.ts`, `AppRoutes.tsx`, `RailNav.tsx` | confirmed | 管理画面入口と panel/data loader の permission gate。 |
| J3-API-ADMIN | 実装 | `apps/api/src/routes/admin-routes.ts` | confirmed | user create/list/role assign/suspend/unsuspend/delete、roles、usage、cost、audit、alias API。 |
| J3-API-ME | 実装 | `apps/api/src/routes/system-routes.ts` | confirmed | `/me` が groups / effective permissions を返す。 |
| J3-AUTH | 実装 | `apps/api/src/authorization.ts` | confirmed | `USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR`、`SYSTEM_ADMIN` と permission mapping。 |
| J3-SEC-TEST | テスト | `apps/api/src/security/access-control-policy.test.ts` | confirmed | public allowlist、protected route permission、debug gate、operationKey/resourceCondition static guard。 |
| J3-SERVICE | 実装 | `apps/api/src/rag/memorag-service.ts`, `apps/api/src/schemas.ts`, `apps/api/src/types.ts` | confirmed | managed user ledger、admin audit ledger、usage/cost estimated summary、access role list。 |
| J3-WEB-INVENTORY | generated docs | `docs/generated/web-features/admin.md`, `docs/generated/web-ui-inventory.json` | confirmed/inferred | Admin UI の静的棚卸し。runtime 条件はコード確認を優先する。 |
| J3-I-GAP | 先行 gap | `docs/spec/gap-phase-i.md` | confirmed | benchmark artifact contract / runner 境界の踏襲条件。 |
| J3-J2-GAP | 先行 gap | `docs/spec/gap-phase-j2.md` | confirmed | debug 4 tier / public endpoint / auth middleware 境界の踏襲条件。 |

## Spec Requirements Summary

| 章 / AC | 要求 summary | 現行分類 |
|---|---|---|
| 10 / AC-ADMIN-DASH-001..005 | 編集フォームなしの管理ダッシュボード、権限別 Action card、KPI、最新 benchmark / 失敗取り込み / 問い合わせ件数。 | partially_covered |
| 11 / AC-USER-* / AC-GROUP-* | ユーザー一覧/詳細、ロール差分、グループ full/readOnly、影響計算、内部 folderPolicy 非表示、循環禁止。 | partially_covered |
| 12 / AC-ROLE-* | role assign / revoke、差分、強権限理由入力、監査ログ。 | partially_covered / divergent |
| 13 / AC-USAGE-* / AC-COST-* | 集計利用量、user-level usage 権限、月次コスト、高コスト run/user、cost export 専用権限。 | partially_covered |
| 14 / AC-AUDIT-* | 危険操作監査、actor/action/target/before/after/createdAt、reason、export 専用権限、通常ユーザー非表示。 | partially_covered |

## confirmed

| ID | 現行で確認できた事実 | 根拠 | 仕様との差分 |
|---|---|---|---|
| J3-CONF-001 | Web は `canSeeAdminSettings` のときだけ `AdminWorkspace` へ遷移し、admin panel と API data load は permission ごとに分岐する。 | `usePermissions.ts`, `useAppShellState.ts`, `AppRoutes.tsx`, `AdminWorkspace.tsx` | 10.3 の権限別表示の基礎はある。 |
| J3-CONF-002 | `AdminOverviewGrid` は document、assignee、debug、benchmark への clickable tile と、access/users/usage/cost/alias の overview tile を持つ。 | `AdminOverviewGrid.tsx`, `docs/generated/web-features/admin.md` | 10.2 の下段導線の一部はあるが、仕様の Action card 全量ではない。 |
| J3-CONF-003 | Admin user API は create/list/role assign/suspend/unsuspend/delete を持ち、route ごとに `user:*` または `access:role:assign` を要求する。 | `admin-routes.ts`, `schemas.ts` | 11 の user 管理の基礎はある。 |
| J3-CONF-004 | role assignment は自分自身の role 更新を拒否し、`SYSTEM_ADMIN` 付与は実行者も `SYSTEM_ADMIN` であることを要求する。 | `admin-routes.ts` | 12 の強権限付与リスクに対する現行 guard として踏襲対象。 |
| J3-CONF-005 | `MemoRagService` は managed user ledger と admin audit log を持ち、user create / role assign / suspend / unsuspend / delete を監査する。 | `memorag-service.ts`, `ManagedUserAuditLogEntrySchema` | 14 の admin user/role 監査の一部はある。 |
| J3-CONF-006 | `/admin/roles` は `access:policy:read` で保護され、`rolePermissions` から role と permissions を返す read-only endpoint。 | `admin-routes.ts`, `authorization.ts` | 12 の role 定義閲覧はあるが、role create/update はない。 |
| J3-CONF-007 | `/admin/usage` は `usage:read:all_users`、`/admin/costs` は `cost:read:all` を要求する。 | `admin-routes.ts`, `authorization.ts` | 13 の usage / cost 権限分離の基礎はある。 |
| J3-CONF-008 | cost summary は `confidence` に `actual_usage` / `estimated_usage` / `manual_estimate` を持ち、Web は `costConfidenceLabel` を表示する。 | `CostAuditSummarySchema`, `AdminCostPanel.tsx`, `types.ts` | 推定コストを実コストとして断定しないため、No Mock Product UI の踏襲対象。 |
| J3-CONF-009 | `/admin/audit-log` は `access:policy:read` で保護され、通常ユーザー向けには admin audit panel が表示されない。 | `admin-routes.ts`, `usePermissions.ts`, `AdminWorkspace.tsx` | 14 の通常ユーザー非表示の基礎はある。 |
| J3-CONF-010 | `/me` は認証済みユーザーに groups と effective permissions を返し、Web の permission gate はこの response に依存する。 | `system-routes.ts`, `currentUserApi.ts`, `usePermissions.ts` | J3 UI は API 側 permission contract と同期する必要がある。 |
| J3-CONF-011 | `access-control-policy.test.ts` は public allowlist を `/health` と `/openapi.json` に固定し、protected route が permission metadata と handler check を持つことを検査する。 | `access-control-policy.test.ts` | admin route 追加/変更時の回帰 guard として踏襲対象。 |
| J3-CONF-012 | Alias 管理は admin workspace 内にあり、draft / review / publish / disable と alias audit を持つ。 | `AliasAdminPanel.tsx`, `admin-routes.ts`, `memorag-service.ts` | 8/14B の alias review/publish に近接するが、J3 では admin workspace 統合時の既存パネルとして扱う。 |

## partially_covered

| ID | 部分充足している仕様 | 現状 | 残差分 |
|---|---|---|---|
| J3-PART-001 | 管理ダッシュボード入口 | `AdminWorkspace` と `AdminOverviewGrid` は権限別 tile と admin panels を提供する。 | 仕様 10 の上段 KPI、失敗/警告件数、最新 benchmark 結果、コスト異常、高リスク権限変更、品質/解析要対応 card の統合集計はない。 |
| J3-PART-002 | Action card 導線 | document / assignee / debug / benchmark は clickable button。access/users/usage/cost/alias は panel 表示の overview tile。 | クリックできない KPI と ActionCard の見た目分離は一部あるが、詳細画面遷移とカード状態の体系は未整理。 |
| J3-PART-003 | ユーザー一覧 | 管理対象ユーザー一覧、状態、ロール、作成、停止、再開、削除、role 付与がある。 | 検索、状態/ロール/グループ filter、ユーザー詳細、実効権限、閲覧可能 folder、監査履歴 drilldown はない。 |
| J3-PART-004 | グループ管理 | Cognito group / application role は user groups として扱われる。 | 仕様 11 の department/project/team/admin group、full/readOnly membership、子グループ、folderPolicy 非表示、循環禁止、影響する folder/document 数の計算は未実装。 |
| J3-PART-005 | ロール・権限管理 | role list と permissions の read-only 表示、user への role assignment がある。 | role create/update、role revoke の明示 UI、差分/影響表示、強権限理由入力、文書権限との分離説明、割当ユーザー一覧は未整備。 |
| J3-PART-006 | 利用状況 | user-level usage summary は chat / document / question / benchmark / debug / last activity を返し、Web table で表示する。 | aggregate/user 権限名は仕様と現行で異なり、group 別、model 別、機能別、異常利用、export はない。 |
| J3-PART-007 | コスト | estimated monthly summary、service/category 別 item、user cost summary、pricing catalog date を返す。 | 前月比、高コスト run、model 別、group 別、cost export、異常検知、実請求データ連携はない。 |
| J3-PART-008 | 監査ログ | managed user / role assign の admin audit と alias audit がある。 | 仕様 14.3 の folder/document/chat/async agent/skill/search improvement/benchmark/debug/export/writeback など横断監査、reason、requestId、before/after 汎用 JSON、検索/期間/対象種別 filter、export はない。 |
| J3-PART-009 | Web inventory | generated inventory は AdminWorkspace と各 panel / button / form を棚卸ししている。 | static 解析のため runtime permission / data availability は推定を含み、gap 判断は source code と API route を優先する必要がある。 |

## missing

| Gap ID | 状態 | 内容 | 後続対応 |
|---|---|---|---|
| J3-GAP-001 | missing | 仕様 10 の統合 dashboard aggregation API がない。現行 overview は既存 props と各 panel data の表示に寄る。 | `J3-admin-dashboard-unified` で read-only dashboard view model を作る。初回は既存 API 結果の合成または小さな aggregate endpoint に留める。 |
| J3-GAP-002 | missing | 失敗取り込み、未検証/期限切れ/低 OCR/表/図解析失敗、文書オーナー未設定、レビュー期限超過など品質/解析 Action card がない。 | Phase C/E の quality / extraction metadata がある範囲だけ表示し、未実装値を固定件数や demo fallback で埋めない。 |
| J3-GAP-003 | missing | グループ管理 API/UI がない。 | 初回 J3 では group CRUD/membership は scope-out。表示が必要なら「未提供」状態に留め、架空グループを表示しない。 |
| J3-GAP-004 | missing | ロール変更時の差分、影響、理由入力、強権限付与理由必須がない。 | 既存 `access:role:assign` / self assignment forbidden / SYSTEM_ADMIN guard を維持し、最小 slice では role assign dialog を差分表示から始める。 |
| J3-GAP-005 | missing | `audit:read` / `audit:export`、`cost:export`、仕様名の `usage:read:aggregate` / `usage:read:user` / `cost:read:aggregate` / `cost:read:user` permission は現行 contract にない。 | Phase B の permission alias 方針と同期する。J3 で即 rename せず、既存 `access:policy:read`、`usage:read:all_users`、`cost:read:all` を弱めない。 |
| J3-GAP-006 | missing | audit export / cost export がない。 | export は機微データと signed URL / audit 記録を伴うため初回 J3 から scope-out し、read-only 表示を優先する。 |
| J3-GAP-007 | missing | benchmark artifact / latest result を admin dashboard に read-only 表示する統合 view がない。 | Phase I の artifact contract に従い、admin scope では artifact 参照と summary 表示に限定する。runner 起動や production promotion は混ぜない。 |
| J3-GAP-008 | missing | debug 4 tier / trace export / replay を admin workspace に統合する dedicated panel はない。 | J2 の debug route public 非公開、`chat:admin:read_all` alias gate、debug:* 移行方針を維持する。 |

## divergent

| ID | 乖離 | 内容 | 扱い |
|---|---|---|---|
| J3-DIV-001 | 画面性格 | 仕様 10 は編集フォームなしの監視/導線 dashboard を求めるが、現行 `AdminWorkspace` は overview と user/alias 編集 panel を同一 workspace に置く。 | 後続では「dashboard overview」と「管理操作 panel」を視覚/構造上分ける。既存 user/alias panel は削除せず、dashboard card から遷移/展開する候補。 |
| J3-DIV-002 | permission 名 | 仕様 12 は `role:assign`、14 は `audit:read/export`、13 は `usage:read` / `cost:read` 系を使うが、現行は `access:role:assign`、`access:policy:read`、`usage:read:all_users`、`cost:read:all`。 | Phase B の権限モデル移行と合わせる。J3 は既存 route permission を弱めず、docs で alias / migration gap として扱う。 |
| J3-DIV-003 | group model | 仕様 11 の UserGroup / GroupMembership は folder full/readOnly と階層を持つが、現行 admin user groups は application role / Cognito group として扱われる。 | role と resource group を混同しない。J3 初回では group CRUD を入れず、章 1/2/16-20 の設計と同期する。 |
| J3-DIV-004 | audit model | 仕様 14 の `AuditLogEntry` は汎用 target/before/after/reason/requestId を要求するが、現行 admin audit は managed user 操作専用 schema。 | 汎用 audit store へ一気に置換せず、admin audit と alias audit を既存互換で表示し、横断 audit は後続設計に分ける。 |
| J3-DIV-005 | cost accuracy | 仕様 13 はコスト/異常利用を扱うが、現行 cost は estimated/manual estimate を含む計算値。 | UI/PR/docs で推定であることを明示し、実コストや請求額として扱わない。 |

## Preserve Existing Behavior

| ID | 踏襲すべき既存挙動 | 根拠 | J3 での扱い |
|---|---|---|---|
| J3-PRESERVE-001 | Admin API route は操作ごとの `requirePermission` と OpenAPI authorization metadata を維持する。 | `admin-routes.ts`, `access-control-policy.test.ts` | route 追加/変更時は `apps/api/src/security/access-control-policy.test.ts` と OpenAPI docs を同時更新する。 |
| J3-PRESERVE-002 | user create/list/status/role assign は `user:*` / `access:role:assign`、usage は `usage:read:all_users`、cost は `cost:read:all`、audit/roles は `access:policy:read` の境界を弱めない。 | `admin-routes.ts`, `authorization.ts` | dashboard 統合で「管理画面が見える」だけを理由に全 panel data を取得しない。 |
| J3-PRESERVE-003 | role assignment の self update 禁止と `SYSTEM_ADMIN` 付与時の system admin requirement を維持する。 | `admin-routes.ts` | 差分 dialog / reason 入力を追加する場合も guard を削らない。 |
| J3-PRESERVE-004 | Web は permission がない panel / API loader を実行しない。 | `useAdminData.ts`, `AdminWorkspace.tsx`, `useAppShellState.ts` | dashboard aggregate でも権限外 card を mock / disabled card として表示しない。 |
| J3-PRESERVE-005 | 本番 UI/API で固定ユーザー、固定グループ、固定容量、固定コスト、demo fallback を実データのように表示しない。 | `no-mock-product-ui` rule, current empty states | 未実装 metric は「未提供」「未設定」「利用不可」など正直な状態にする。 |
| J3-PRESERVE-006 | Cost は `confidence` を持つ推定値として扱い、実請求額と断定しない。 | `CostAuditItemSchema`, `AdminCostPanel.tsx` | dashboard KPI でも `estimated` / confidence を維持する。 |
| J3-PRESERVE-007 | J2 の `/health` と `/openapi.json` だけを public allowlist にする境界、debug route public 非公開、`Last-Event-ID` / SSE / auth middleware 境界を弱めない。 | `docs/spec/gap-phase-j2.md`, `access-control-policy.test.ts` | admin dashboard から debug を参照する場合も protected route と debug permission gate を維持する。 |
| J3-PRESERVE-008 | I の benchmark corpus isolation、runner permission、artifact contract、dataset 固有値を本番 RAG 実装へ入れない方針を維持する。 | `docs/spec/gap-phase-i.md` | admin では latest result / artifact summary の read-only 表示に留め、runner 権限や production promotion を混ぜない。 |
| J3-PRESERVE-009 | alias admin panel の draft / review / publish / disable / audit の human review 境界を維持する。 | `AliasAdminPanel.tsx`, `admin-routes.ts` | dashboard 統合で approved alias を自動 publish しない。 |

## J3-admin-dashboard-unified Scope

後続 `J3-admin-dashboard-unified` の候補 scope は次とする。

1. 管理ダッシュボード / ユーザー・グループ / ロール・権限 / コスト / 監査を admin workspace 内で統合表示し、dashboard overview と操作 panel を明確に分ける。
2. 既存 props/API から得られる document、question、debug、benchmark、managed user、role、usage、cost、audit、alias の read-only summary card を整理する。
3. clickable Action card と非クリック KPI の見た目を分け、クリックできる card は既存 view/panel へ遷移または focus する。
4. 権限に応じて card / panel / data load を出し分け、権限外 card には固定件数や demo fallback を出さない。
5. ユーザー管理は既存 create/list/status/role assign を維持し、role assign は差分表示と `SYSTEM_ADMIN` guard の説明を加える最小改善から始める。
6. ロール・権限は read-only role definition と permission list を整理し、resource-level folder permission と機能 permission を混同しない説明/UI 構造にする。
7. Usage/cost は現行 API の範囲で集計を表示し、推定値は推定として明示する。
8. 監査は現行 admin audit と alias audit を read-only で統合表示し、横断 audit / export は未提供として扱う。
9. benchmark は Phase I artifact summary の read-only 参照に限定し、runner 実行/seed/promotion は dashboard scope に入れない。
10. debug は J2 の permission / visibility 境界に従い、admin workspace からの導線または read-only summary に留める。

### 最小 slice

初回実装 task に入れるべき最小 slice は次とする。

| Slice | 内容 | 理由 |
|---|---|---|
| J3-SLICE-001 | `AdminWorkspace` を overview / users / roles / usage-cost / audit / alias の sections または tabs に整理する。 | 既存 API を活かし、統合表示の基礎を作る。 |
| J3-SLICE-002 | Dashboard card model を定義し、clickable action と read-only KPI を区別する。 | 仕様 10 の最小不変条件。 |
| J3-SLICE-003 | 既存 permission gate と data loader 条件を維持したまま、権限別 card/panel 表示を整理する。 | 認可境界を弱めない。 |
| J3-SLICE-004 | Usage/cost/audit は現行 API の read-only 表示を改善し、推定/未提供/空状態を明示する。 | No Mock Product UI と 13/14 の部分充足。 |
| J3-SLICE-005 | role assign UI に変更前後の差分表示を追加し、理由入力は API 追加が必要なため後続扱いとして明示する。 | 12 の差分要求に近づけつつ、API contract の大変更を避ける。 |

### Scope-out

| ID | scope-out | 理由 / 委譲先 |
|---|---|---|
| J3-OUT-001 | グループ CRUD / membership full/readOnly / group hierarchy / 循環検出 / folderPolicy group 非表示の本実装。 | 章 1/2/16-20 の resource permission 設計と同期が必要。 |
| J3-OUT-002 | 汎用 audit store、全危険操作の横断 audit、audit export。 | schema / storage / permission / signed URL / audit of audit が必要。 |
| J3-OUT-003 | cost export、実請求データ連携、異常検知 job。 | 機微データと運用連携が大きく、初回統合表示から分ける。 |
| J3-OUT-004 | role create/update/delete と custom role editor。 | 現行 role は `authorization.ts` の static preset。runtime role store 設計が必要。 |
| J3-OUT-005 | benchmark runner 起動、seed、promotion、本番設定反映。 | Phase I の runner / artifact / permission 境界に委譲。J3 は read-only artifact summary。 |
| J3-OUT-006 | debug replay 実行、raw trace export、debug permission 完全移行。 | Phase J2 の 4 tier / debug permission migration に委譲。 |
| J3-OUT-007 | 架空の dashboard KPI を埋めるための fixed seed / demo fallback。 | No Mock Product UI 違反。未実装値は未提供として表示する。 |

## Open Questions

| ID | 種別 | 内容 | 次の判断 |
|---|---|---|---|
| J3-OQ-001 | open_question | admin dashboard aggregate API を新設するか、既存 API を Web 側で権限別合成するか。 | 権限境界、API call 数、OpenAPI docs 更新範囲で判断する。 |
| J3-OQ-002 | open_question | 仕様 permission 名 (`audit:*`, `cost:export`, `role:assign`) と現行 permission 名を rename / alias するか。 | Phase B の permission migration 方針と既存 role 互換で決める。 |
| J3-OQ-003 | open_question | group 管理は Cognito group と resource group を同一 UI にするか、別タブ/別 entity として扱うか。 | role と folder permission の混同を避ける設計が必要。 |
| J3-OQ-004 | open_question | admin audit と alias audit を一時的に統合表示するか、汎用 audit schema まで待つか。 | 14 の横断 audit 要求と既存 ledger 互換で判断する。 |
| J3-OQ-005 | open_question | role assign の reason 入力を UI 先行で optional にするか、API schema / audit schema まで同時に拡張するか。 | 実施していない reason 保存を実施済みに見せないよう、API 追加有無で切る。 |

## Targeted Validation For J3

| 検証 | 目的 |
|---|---|
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` | spec-recovery 更新の構造確認。 |
| `git diff --check` | Markdown whitespace / conflict marker 確認。 |
| `npm run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts` | 後続で admin route / permission / public middleware を変更した場合の静的 policy guard。今回の pre-gap docs 変更では未実施。 |
| `npm run test -w @memorag-mvp/web -- AdminWorkspace useAdminData usePermissions` | 後続で admin UI / permission gate を変更した場合の UI regression。今回の pre-gap docs 変更では未実施。 |
