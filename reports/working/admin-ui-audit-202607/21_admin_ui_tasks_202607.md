# 管理画面 改善タスク（2026-07）

## 位置づけ

本書は [20_admin_ui_facts_202607.md](20_admin_ui_facts_202607.md) の確定事実と [28_admin_ui_gap_analysis_202607.md](28_admin_ui_gap_analysis_202607.md) の gap を、実装・検証可能な後続作業へ分解した候補である。製品要件の承認を代替しない。金額、閾値、保持期間など未決の値は [29_admin_ui_open_questions_202607.md](29_admin_ui_open_questions_202607.md) で決定してから実装する。

## 実装順と依存関係

| Wave | 目的 | Task | 開始条件 |
| --- | --- | --- | --- |
| 1 | 認可・identity・整合性を先に安全化 | `TASK-AUI-004`, `TASK-AUI-005`, `TASK-AUI-008`, `TASK-AUI-009` | Security / Identity owner が authoritative source と失敗時契約を承認 |
| 2 | 計測値と料金根拠を正す | `TASK-AUI-001`, `TASK-AUI-002`, `TASK-AUI-013` | FinOps が pricing source と実測/推定の区分を承認 |
| 3 | 管理者が判断・操作できる UI にする | `TASK-AUI-003`, `TASK-AUI-006`, `TASK-AUI-007`, `TASK-AUI-010` | Wave 1/2 の read/write contract が確定 |
| 4 | ガバナンスと利用品質を仕上げる | `TASK-AUI-011`, `TASK-AUI-012` | 共通 audit/query-state component が利用可能 |

P0 は Wave 1 と Wave 2 である。現行の不正確な値や効かない操作を、見た目だけ整えて信頼可能に見せる変更は行わない。

## TASK-AUI-001: 実利用を欠測と区別して計測する

- Actor: chat/RAG/embedding/debug/benchmark の実行経路、FinOps、`SYSTEM_ADMIN`
- Intent: provider が返す実利用量を、再試行で二重計上せず期間・tenant・user・機能・model 単位で集計する
- Problem: `AdminLedger.usage` は 0 初期化のみで実行時 write path がない (`FACT-AUI-011`–`014`)
- Improvement: immutable usage event、idempotency key、provider quantity、measurement source、completeness、cursor query を導入し、`zero` と `missing` を別状態にする
- Outcome: 利用後の集計が増え、欠測・遅延・重複・再集計を説明できる
- Component: chat/RAG/provider adapter、usage event store、usage aggregation API
- Dependencies: tenant/user attribution policy、retention、`TASK-AUI-009`
- Source: `FACT-AUI-011`–`018`, `FACT-AUI-077`–`081`; `GAP-AUI-001`, `GAP-AUI-003`, `GAP-AUI-030`
- Confidence: confirmed

## TASK-AUI-002: 監査可能な料金算出契約を確立する

- Actor: FinOps、`SYSTEM_ADMIN`
- Intent: 表示額の期間、数量、単価、出典、計算時点、実測/推定/欠測を追跡する
- Problem: 現行は期間外数量、固定単価、単位の異なる benchmark 価格、根拠のない confidence を混在させる (`FACT-AUI-019`–`023`)
- Improvement: versioned pricing catalog、effective range、region/model/provider key、同一期間集計、calculation breakdown、rounding rule を契約化する
- Outcome: 合計から数量と適用単価へ drill-down でき、請求額との差異を「推定」として説明できる
- Component: pricing catalog、cost aggregation API、cost export
- Dependencies: `TASK-AUI-001`、pricing owner の決定 (`OQ-AUI-001`–`005`)
- Source: `FACT-AUI-019`–`023`, `FACT-AUI-026`; `GAP-AUI-002`, `GAP-AUI-004`
- Confidence: confirmed / open_question

## TASK-AUI-003: 利用量・料金を意思決定可能な画面にする

- Actor: `SYSTEM_ADMIN`、許可された own-scope user
- Intent: 期間、group、user、機能、model で利用量と費用を比較し、異常・欠測・高額要因を調べる
- Problem: user cost、unit price、conversation、期間 filter、比較、異常、export が表示されない (`FACT-AUI-024`–`030`)
- Improvement: query/filter/sort/pagination、前期間比較、breakdown、completeness、as-of、専用 export permission、精度を失わない金額表示を設ける
- Outcome: 0、丸めゼロ、欠測、対象なし、権限不足を混同せず、同一 query の export ができる
- Component: Admin usage/cost panels、Web API contract、export UI
- Dependencies: `TASK-AUI-001`, `TASK-AUI-002`, `TASK-AUI-009`, `TASK-AUI-012`
- Source: `FACT-AUI-024`–`030`; `GAP-AUI-004`–`008`, `GAP-AUI-036`
- Confidence: confirmed

## TASK-AUI-004: canonical で読みやすいロールカタログを提供する

- Actor: `ACCESS_ADMIN`, `SYSTEM_ADMIN`
- Intent: 各 application role の用途、危険度、権限、割当状況、変更可否を比較する
- Problem: backend と Cognito の role catalog が不一致で、UI は raw ID と comma-separated permission だけを表示する (`FACT-AUI-035`–`039`)
- Improvement: canonical catalog を一つにし、表示名、説明、category、risk、system/custom、assigned count、permission group、検索・比較を read model に含める
- Outcome: 未知 role を黙って捨てず、identity group と application role を区別して判断できる
- Component: authorization catalog、Cognito provisioning、role API、role panel
- Dependencies: Identity/Security owner が role catalog と custom-role 方針を決定 (`OQ-AUI-006`, `OQ-AUI-007`)
- Source: `FACT-AUI-035`–`039`, `FACT-AUI-052`; `GAP-AUI-009`, `GAP-AUI-011`, `GAP-AUI-012`, `GAP-AUI-033`
- Confidence: confirmed / conflict

## TASK-AUI-005: 複数ロールを安全に付与・解除する

- Actor: `ACCESS_ADMIN`, `SYSTEM_ADMIN`
- Intent: 対象者の既存 role set を確認し、明示した grant/revoke だけを安全に反映する
- Problem: 単一 select が全 role set を置換し、reason、last-admin、tenant、version、原子的 audit がない (`FACT-AUI-031`–`043`)
- Improvement: multi-role editor、before/after/delta/reason、server-side guard、optimistic concurrency、identity/ledger/audit の整合または補償を一つの command contract にする
- Outcome: 意図しない role 消失、自己昇格、最後の管理者喪失、部分更新を防止または明示的に回復できる
- Component: role mutation schema/route/service、Cognito adapter、admin UI、audit
- Dependencies: `TASK-AUI-004`, `TASK-AUI-008`, `TASK-AUI-009`
- Source: `FACT-AUI-031`–`043`, `FACT-AUI-073`; `GAP-AUI-010`, `GAP-AUI-013`, `GAP-AUI-014`
- Confidence: confirmed

## TASK-AUI-006: account lifecycle を認証基盤まで強制する

- Actor: `USER_ADMIN`, `SYSTEM_ADMIN`, identity provider
- Intent: ユーザー作成、停止、復元、削除を authoritative identity と session に反映する
- Problem: create/suspend/delete は管理台帳だけで、停止・削除済み利用者の access token/session を止めない (`FACT-AUI-044`–`050`)
- Improvement: lifecycle state machine、Cognito create/disable/enable/delete、session/token revoke、request-time status check、reconciliation、失敗/競合 audit を定義する
- Outcome: UI の状態と実際のログイン/API access が一致し、削除 actor が再 active 化されない
- Component: user lifecycle routes/service、UserDirectory、auth middleware、admin UI
- Dependencies: destructive delete/retention policy (`OQ-AUI-008`, `OQ-AUI-009`)、`TASK-AUI-008`, `TASK-AUI-009`
- Source: `FACT-AUI-044`–`050`; `GAP-AUI-015`–`017`
- Confidence: confirmed

## TASK-AUI-007: ユーザー・group 管理を探索可能かつ大規模対応にする

- Actor: `USER_ADMIN`, `ACCESS_ADMIN`, `SYSTEM_ADMIN`
- Intent: 対象ユーザーを検索し、状態、application role、resource group、実効権限、関連監査を確認する
- Problem: 検索/filter/detail/pagination がなく、role と group の語も混同し、全 mutation が全行を loading にする (`FACT-AUI-051`–`053`)
- Improvement: server-side cursor/search/filter、詳細 drawer/page、role/group 分離、effective permission/folder visibility、row-scoped mutation state を設ける
- Outcome: 多数ユーザーでも対象と影響を特定でき、他行を止めずに安全な操作と再試行ができる
- Component: user/group query API、AdminUserPanel、user detail、resource group management
- Dependencies: `TASK-AUI-004`–`006`, `TASK-AUI-009`, pagination/SLO decision (`OQ-AUI-010`)
- Source: `FACT-AUI-051`–`053`; `GAP-AUI-018`, `GAP-AUI-019`, `GAP-AUI-030`, `GAP-AUI-033`
- Confidence: confirmed / conflict

## TASK-AUI-008: 管理操作を共通 audit と export で追跡する

- Actor: `AUDIT_REVIEWER` 相当の専用権限保持者、Security/Ops
- Intent: success/denied/conflict/failed を actor、tenant、target、before/after、reason、request と共に検索・export する
- Problem: 現行 audit は成功した user/role 5 action、直近 100 件、read permission 流用に限定される (`FACT-AUI-054`–`058`)
- Improvement: immutable common audit schema、専用 read/export permission、cursor/date/actor/target/action/result filter、redaction/retention/integrity contract を導入する
- Outcome: 重要 mutation と拒否・競合・失敗を漏れなく追跡し、画面 query と同じ範囲を export できる
- Component: audit store/schema/service/routes、audit panel/export、全 admin commands
- Dependencies: audit retention/SIEM/PII policy (`OQ-AUI-011`–`013`)、`TASK-AUI-009`
- Source: `FACT-AUI-054`–`058`; `GAP-AUI-007`, `GAP-AUI-026`–`028`
- Confidence: confirmed / conflict

## TASK-AUI-009: query state・契約・競合制御を統一する

- Actor: 全管理者、Web/API maintainer
- Intent: loading、空、失敗、拒否、stale、競合を正確に表示し、安全に retry/refresh する
- Problem: loader error が console のみで 0/空/null に畳み込まれ、nested response validation と conditional write がない (`FACT-AUI-004`–`008`, `FACT-AUI-058`, `FACT-AUI-063`–`066`)
- Improvement: typed query state、runtime schema validation、error envelope/request ID、scoped retry/as-of、ETag/version、idempotency、row-level mutation state を共通化する
- Outcome: 障害を正常値として見せず、同時更新を上書きせず、利用者が影響範囲を保ったまま回復できる
- Component: Web loaders/API clients、API error schema、ledger/store、shared admin components
- Dependencies: error/redaction policy、store technology
- Source: `FACT-AUI-004`–`008`, `FACT-AUI-053`, `FACT-AUI-058`, `FACT-AUI-063`–`066`; `GAP-AUI-019`–`023`, `GAP-AUI-028`
- Confidence: confirmed

## TASK-AUI-010: overview と管理 section を行動可能かつ URL 復元可能にする

- Actor: permission を持つ管理者
- Intent: 異常や未処理項目を overview で知り、対象 section/filter へ遷移して対応する
- Problem: KPI は action を持たず、quality action API は未使用、section は URL に保存されない (`FACT-AUI-001`–`010`)
- Improvement: role に応じた action card、drill-down link、URL route/query、badge/threshold provenance、scoped refresh を設ける
- Outcome: deep link/back/forward が機能し、失敗を 0 とせず、カードから具体的対応へ到達できる
- Component: AdminWorkspace routing、overview read model、quality actions
- Dependencies: `TASK-AUI-003`, `TASK-AUI-007`–`009`、threshold owner (`OQ-AUI-014`)
- Source: `FACT-AUI-001`–`010`; `GAP-AUI-020`–`025`
- Confidence: confirmed / inferred

## TASK-AUI-011: alias review/publish を説明可能な governance flow にする

- Actor: `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN`
- Intent: 検索 alias の draft、review、publish、reject、disable を理由と差分付きで管理する
- Problem: reject 理由が固定、draft 化が no-op update、client が架空 state/time を補い、disabled transition も server で拒否しない (`FACT-AUI-059`–`062`)
- Improvement: explicit transition command、必須 reason、server-authoritative response、state/version guard、差分 preview、audit/search/pagination を設ける
- Outcome: UI 文言・状態・監査が server の確定結果と一致し、不正 transition と競合を拒否する
- Component: alias schema/routes/service/store、AliasAdminPanel、audit
- Dependencies: `TASK-AUI-008`, `TASK-AUI-009`
- Source: `FACT-AUI-056`, `FACT-AUI-059`–`062`, `FACT-AUI-073`; `GAP-AUI-027`, `GAP-AUI-029`
- Confidence: confirmed

## TASK-AUI-012: responsive・a11y・用語・テスト gate を満たす

- Actor: keyboard/screen reader/zoom/mobile を含む全管理者
- Intent: viewport や支援技術に依存せず、対象・状態・危険操作を理解して完了する
- Problem: 横 scroll 固定、alias grid、狭い touch target、table semantics、対象を含まない操作名、状態通知・検証が不足する (`FACT-AUI-067`–`074`)
- Improvement: 320 px/400% reflow、44 px 目安の操作面、native table/list semantics、focus/status/error、対象を含む accessible name、日本語用語統一、自動+手動 test matrix を導入する
- Outcome: WCAG 2.2 AA を基準に主要管理 task が keyboard/screen reader/mobile で完了し、回帰 gate がある
- Component: admin components/CSS、routing、a11y tests、browser E2E、manual test evidence
- Dependencies: 各 panel の最終情報設計、対応 browser/AT matrix (`OQ-AUI-015`)
- Source: `FACT-AUI-003`, `FACT-AUI-065`–`074`; `GAP-AUI-031`–`035`
- Confidence: confirmed evidence gap / open_question

## TASK-AUI-013: PR #339 を現行契約へ再適合して段階導入する

- Actor: maintainer、FinOps、Ops
- Intent: 未マージの usage/cost 実装候補から有効な部分を再利用し、現行 main と新受け入れ条件へ安全に移行する
- Problem: PR #339 は主要機能を持つが、1,000 件 Scan、tenant `default`、固定 pricing、live AWS 未検証、現行 main との差分が残る (`FACT-AUI-077`–`081`)
- Improvement: rebase/cherry-pick 方針を決め、tenant+period index/cursor、migration/backfill、dual-read comparison、kill switch、live canary、cost reconciliation を追加する
- Outcome: event 欠落・二重計上・tenant 混在なしに rollout し、旧 ledger 依存を計測付きで終了できる
- Component: candidate usage/cost changes、DynamoDB index/migration、observability、release runbook
- Dependencies: `TASK-AUI-001`–`003`, `TASK-AUI-008`–`009`、rollout owner (`OQ-AUI-016`)
- Source: `FACT-AUI-077`–`081`; `GAP-AUI-008`, `GAP-AUI-030`, `GAP-AUI-035`
- Confidence: confirmed candidate / open_question

## 共通 Done 条件

各後続 task は、次を満たすまで done にしない。

1. 対応する [22_admin_ui_acceptance_criteria_202607.md](22_admin_ui_acceptance_criteria_202607.md) の必須 AC が自動 test または記録可能な手動 test で確認されている。
2. permission deny、tenant/owner 境界、empty/loading/error/stale/conflict/retry が対象範囲に応じて検証されている。
3. API/schema/authorization/access-control policy、Web runtime validation、OpenAPI、運用・ユーザー文書が同期している。
4. 監査対象 mutation は success だけでなく denied/conflict/failed の記録と redaction が確認されている。
5. 未決値を固定値や demo fallback で埋めず、未設定・欠測・利用不可を正直に表示している。
6. live provider/identity/storage を必要とする検証は実施結果を残し、実施できない場合は rollout blocker または明示的な残余リスクとして扱っている。
