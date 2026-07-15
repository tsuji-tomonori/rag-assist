# 管理 Access / Audit / Query state の残余 gap を修復する

- 状態: in_progress
- 優先度: P0
- 種別: 実装 / security / integrity / UI state
- 起票日: 2026-07-14
- 参照: `reports/working/admin-ui-audit-202607/30_admin_ui_revalidation_20260714.md`

## 目的

現行の安全な role/account lifecycle service を管理 UI と read model へ正しく接続し、複数 role の破壊的置換、deleted projection の復活、成功操作だけの監査、global loading/error、silent truncation を解消する。

## 作業前チェックリスト

- [x] 現行 role/account lifecycle、directory projection、session revoke、security audit outbox/read model の正本と fault boundary を特定する。
- [x] admin user/role/audit API と Web の query/mutation/pagination/error state を受け入れ条件へ trace する。
- [x] route permission、tenant/target 境界、export 専用 permission、redaction と static access-control policy への影響を確認する。
- [x] report/正規 docs/generated docs/README/runbook の更新要否と最小十分な test matrix を決める。
- [x] Issue #345 の既存 stacked PR と重複する実装を確認し、本 task の残余だけを scoped milestone にする。

## Done 条件

- [x] 下記受け入れ条件が API/Web/store の実挙動と自動 test で満たされる。
- [x] denied/conflict/failed を含む security audit と export 境界が tenant/permission/redaction を弱めず検証される。
- [x] concurrent write、partial failure、retry/reconciliation、deleted/suspended invariant を fault-injection で検証する。
- [x] lint、typecheck、関連/full test、build、docs/generated freshness、security policy test が成功する。
- [x] 未実施の live/manual 検証は達成扱いにせず report/PR に理由とリスクを記録する。
- [ ] 日本語 commit、stacked draft PR、受け入れ条件コメント、セルフレビュー、作業レポート、task の `done` 移動と lifecycle push が完了する。

## 実行計画

1. 正本 service/store/read model と現 API/Web の gap を復元する。
2. projection invariant、security audit/outbox、export permission/query contract を API/store へ実装する。
3. capability/propagation/reconciliation と scoped query/error/retry を Web へ接続する。
4. fault-injection、security negative、pagination/export、UI state と full quality gate を実行して修復する。

## ドキュメントメンテナンス計画

関連 FR、access-control/security/API/data/UI design、OpenAPI、API-code/Web inventory、traceability を実装と同期する。README/deploy/runbook は公開運用手順の変更有無で再判定し、不要なら作業レポートへ理由を残す。

## 受け入れ条件

- [x] Web は複数 application role の grant/revoke delta、変更前後、必須 reason を表示し、未選択 role を意図せず削除しない。
- [x] server capability で self、inactive/cross-tenant target、付与不能 role、last recovery principal を事前表示し、最終判定は server が行う。
- [x] role/account mutation 後の session revoke、effective permission、propagation/reconciliation state を UI が説明する。
- [x] `loadAdminLedger` と directory reconciliation は deleted/suspended invariant、source direction、version/as-of を守り、actor load だけで active へ戻さない。
- [x] user/role/audit は server-side search/filter/stable cursor/total/truncation を持ち、row/panel/query key ごとに pending/error/retry を分離する。
- [x] 初期 loader failure を `console.warn` だけにせず、safe error/request ID と scoped retry を表示し、unknown/error を zero/empty へ変換しない。
- [x] Admin audit read model は共通 security audit outbox の success/denied/conflict/failed、reason、tenant、target、request/policy version を権限内で表示する。
- [x] audit export は read と別 permission、同じ query、全ページ、scope/audit/redaction を強制する。
- [x] shared projection の concurrent write、partial failure、retry/reconciliation を fault-injection test で検証する。

## 検証

- multi-role UI/API contract と before/after regression
- cross-tenant/self/last-admin/inactive negative matrix
- current identity / session revoke / deleted projection integration
- per-panel/row loading/error/retry component test
- audit pagination/export permission/fault-injection

## 検証結果

- `npm run lint`: 成功
- API/Web typecheck: 成功
- API full test: 785 tests 成功
- Web full test: 53 files / 390 tests 成功
- Access/Audit 関連 Web test: 67 tests 成功
- 対象 E2E: 5 scenarios 成功（fixture 修正後の再実行を含む）
- workspace build: 成功（Vite の bundle size warning のみ）
- `task docs:check`: 成功
- E2E 修正後の `task docs:web-inventory:check`: 成功
