# 管理画面仕様復元 入力棚卸し（2026-07）

## 1. 対象と境界

- repository: `tsuji-tomonori/rag-assist`
- current evidence base: `9cd904d3c5203caf2400eb2ff654096d63f9d8fb`
- requested symptoms: 利用後も料金が 0、ロール一覧が見にくい
- expanded scope: 管理画面の全 section、関連 API/store/schema/auth/test、要求・設計・作業/障害レポート、responsive/a11y、未マージ改善案
- scope-out: このタスクでの本番コード修正、実 AWS 変更、料金・異常閾値・承認規則の独断確定

## 2. 入力ソース

| Source ID | 種別 | 対象 | 採用理由 | 確度 |
| --- | --- | --- | --- | --- |
| `SRC-AUI-001` | user need | 2026-07-13 の依頼 | 症状と期待成果物の一次情報 | confirmed |
| `SRC-AUI-002` | Web implementation | `apps/web/src/features/admin/**` | 現行画面、操作、状態、API client | confirmed |
| `SRC-AUI-003` | app shell | `apps/web/src/app/**`, styles | loader、route、error、URL、responsive | confirmed |
| `SRC-AUI-004` | API contract | `apps/api/src/routes/admin-routes.ts`, `schemas.ts`, `types.ts` | endpoint、permission、payload | confirmed |
| `SRC-AUI-005` | service/store | `apps/api/src/rag/memorag-service.ts`, adapters | 集計・永続化・identity 同期の実体 | confirmed |
| `SRC-AUI-006` | auth/catalog | `auth.ts`, `authorization.ts`, `infra/lib/memorag-mvp-stack.ts` | JWT、account status、role/permission/Cognito group | confirmed |
| `SRC-AUI-007` | tests | Web admin、API contract、service、directory tests | 現在固定されている期待と欠落 | confirmed |
| `SRC-AUI-008` | product requirements | `FR-027`, `FR-079`, `FR-080`, `FR-086`, 2026-07 baseline | 現行/新 canonical requirement との適合 | confirmed/conflict |
| `SRC-AUI-009` | chapter specification | `docs/spec/2026-chapter-spec.md` §§10–14 | dashboard/user/group/role/usage/cost/audit の期待 UI | confirmed/conflict |
| `SRC-AUI-010` | design | `DES_API_001.md`, `gap-phase-j3.md`, `CHAPTER_TO_REQ_MAP.md` | 概算 cost と既知の後続範囲 | confirmed/conflict |
| `SRC-AUI-011` | work/bug reports | 2026-05 の admin/cost/RBAC/no-mock/J3 reports | 過去判断、未検証、本番連携の意図 | confirmed |
| `SRC-AUI-012` | generated inventory | `docs/generated/web-*` | 静的 UI/a11y inventory と不明点 | confirmed |
| `SRC-AUI-013` | open PR | PR #339 / `e7654ad4bdf3b825557f4f1a503443638bf82325` | usage event 実装候補と残 gap | confirmed at 2026-07-13 |
| `SRC-AUI-014` | repository UI/a11y policy | local UI/a11y skills | 320 px、zoom、target、state、metadata の評価基準 | confirmed |

## 3. 管理画面の section・データ・認可対応

| Section / surface | Web component | 読み取り API / source | mutation | route permission | store/read model | 主な test evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Overview | `AdminOverviewGrid` | documents/questions/debug/benchmark の各 loader、admin props の配列長 | 詳細画面へ遷移 | 各機能 permission | 複数 store の client-side count | `AdminWorkspace.test.tsx:159-198` |
| Users | `AdminUserPanel` | `GET /admin/users` | create、role set、suspend、unsuspend、delete | `user:*`, `access:role:assign` | `admin/admin-ledger.json` + Cognito list/groups | Web `269-348`; API contract `1748+`; service `1924+` |
| Roles | `AdminRolePanel` | `GET /admin/roles` | なし | `access:policy:read` | `authorization.ts` の `rolePermissions` | API contract `376-379`; Web は表示内容の専用 test なし |
| Usage | `AdminUsagePanel` | `GET /admin/usage` | なし | `usage:read:all_users` | admin ledger + documents + benchmark + debug | service test `2339-2340`; Web empty/null tests |
| Cost | `AdminCostPanel` | `GET /admin/costs` | UI なし。API は `POST /admin/costs/export` | `cost:read:all` | usage summary + documents + benchmark + debug + fixed rates | service `2341-2343`; Web empty/null tests |
| Audit | `AdminAuditPanel` | `GET /admin/audit-log` | UI なし。API は `POST /admin/audit-log/export` | `access:policy:read` | admin ledger `auditLog`, 直近 100 件 | Web empty/null tests; API contract list test |
| Alias | `AliasAdminPanel` | aliases/audit-log | create/update/review/disable/publish | `rag:alias:*` | `admin/alias-ledger.json` + published artifact | Web `200-267`; service alias test |
| Quality action | Web 接続なし | `GET /admin/quality-actions` | なし | `rag:doc:read` + document group read | document manifests から action card | API/security tests のみ |
| Cost export | Web 接続なし | signed URL response | export object 作成 | `cost:read:all` | debug download bucket | API/OpenAPI tests。UI test なし |
| Audit export | Web 接続なし | signed URL response | export object 作成 | `access:policy:read` | debug download bucket | API/OpenAPI tests。UI test なし |

## 4. ユーザー・ロール mutation の実際の write path

| Operation | API write | authoritative identity write | ledger write | audit | session/token |
| --- | --- | --- | --- | --- | --- |
| create user | ledger record を追加 | なし | あり | success のみ | なし |
| set roles | Cognito group を先に更新 | `setUserGroups` | 後で ledger 全体を保存 | success のみ、ledger と同時保存 | 既存 token は更新しない |
| suspend/restore/delete | なし | なし | status のみ更新 | success のみ | revoke/disable なし |

この表の「authoritative」は現行コード上の write 先を示す。製品上どの identity source を正本とするかは `OQ-AUI-006` で確定が必要である。

## 5. 関連要求・仕様

| Requirement/spec | 現行への意味 |
| --- | --- |
| `FR-027` | Phase 2 の管理台帳・概算 cost を受け入れる旧い最小契約。2026-07 target と差がある |
| `FR-079` | backend 12 role / Cognito 9 group の catalog drift を conflict として明記 |
| `FR-080` | role grant/revoke の permission、active/same tenant、reason、self/last-admin、authoritative commit を要求 |
| `FR-086` | security mutation の success/denied/conflict/failed と actor/tenant/target/before/after/reason/result/policy version を要求 |
| chapter §10 | actionable dashboard、権限別 card、freshness、詳細遷移 |
| chapter §11 | user search/filter/detail/effective permission、group management |
| chapter §12 | role display name/description/system flag、assigned users、理由・影響 |
| chapter §13 | monthly/delta/model/feature/user/group/benchmark/anomaly、専用 export permission |
| chapter §14 | common audit、検索/期間/対象 filter、export、reason、before/after |

## 6. 関連レポートで維持すべき判断

| Report | 維持する事実・判断 |
| --- | --- |
| `20260502-1125-cost-design-update.md` | debug token は請求根拠ではない。単価は service/region/model/tier/source/effective date を持つ。Billing/CUR が正本 |
| `20260502-1607-phase2-admin-ops.md` | 当時は契約先行の管理台帳・概算実装であり、Cognito/Billing は後続だった |
| `20260504-1126-admin-user-management-all-users.md` | Cognito 全ユーザー read は入ったが、実 AWS smoke と大規模 pagination/latency は未確認 |
| `20260506-2303-role-assignment-access-denied.md` | ledger と JWT/Cognito の乖離が実障害を起こした |
| `20260506-2317-role-access-fix.md` | Cognito group write を追加したが、既存 token は再ログインまで stale。実 AWS smoke 未実施 |
| `20260510-1223-no-mock-display-audit.md` | API 非提供・未設定・失敗を固定 fallback で埋めない |
| `20260514-2254-j3-admin-dashboard-unified.md` | null/empty、action/KPI、role diff を導入。reason/export/anomaly/custom role 等は明示的 scope-out |
| `20260516-1640-admin-real-data-surfaces.md` | fake group/control を抑止。ただし shell 初期 loader は依然 error を null/zero と混同 |

## 7. 未マージ PR #339 の扱い

- 2026-07-13 GitHub Apps 確認: open、未 merge、head `e7654ad4`、head workflow 2 件 success。
- 改善済み候補: token usage event、actual/estimated/missing、monthly filter、pricing version、breakdown、usage/cost export UI。
- 未解決: current main への再適合、DynamoDB scan 1,000 件 truncation、tenant `default` 固定、period/tenant query 不在、汎用固定 pricing、user cost/unit price の UI 欠落、live Bedrock/DynamoDB/S3 export 未検証。
- 結論: future evidence として採用し、current behavior としては採用しない。

## 8. 調査制約

- 実 AWS Billing/CUR、Cognito User Pool、DynamoDB、Bedrock provider response は参照していない。
- 本タスクでは画面を変更しておらず、実端末、VoiceOver/NVDA、contrast meter、400% zoom の手動結果はない。
- 利用者観察やサポート問い合わせ件数はないため、「見にくさ」の定量値は作っていない。
- 料金表、異常閾値、保持期間、approval policy は repository だけでは確定しない。
