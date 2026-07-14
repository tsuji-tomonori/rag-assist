# 管理 Access / Audit / Query state の残余 gap を修復する

- 状態: todo
- 優先度: P0
- 種別: 実装 / security / integrity / UI state
- 起票日: 2026-07-14
- 参照: `reports/working/admin-ui-audit-202607/30_admin_ui_revalidation_20260714.md`

## 目的

現行の安全な role/account lifecycle service を管理 UI と read model へ正しく接続し、複数 role の破壊的置換、deleted projection の復活、成功操作だけの監査、global loading/error、silent truncation を解消する。

## 受け入れ条件

- [ ] Web は複数 application role の grant/revoke delta、変更前後、必須 reason を表示し、未選択 role を意図せず削除しない。
- [ ] server capability で self、inactive/cross-tenant target、付与不能 role、last recovery principal を事前表示し、最終判定は server が行う。
- [ ] role/account mutation 後の session revoke、effective permission、propagation/reconciliation state を UI が説明する。
- [ ] `loadAdminLedger` と directory reconciliation は deleted/suspended invariant、source direction、version/as-of を守り、actor load だけで active へ戻さない。
- [ ] user/role/audit は server-side search/filter/stable cursor/total/truncation を持ち、row/panel/query key ごとに pending/error/retry を分離する。
- [ ] 初期 loader failure を `console.warn` だけにせず、safe error/request ID と scoped retry を表示し、unknown/error を zero/empty へ変換しない。
- [ ] Admin audit read model は共通 security audit outbox の success/denied/conflict/failed、reason、tenant、target、request/policy version を権限内で表示する。
- [ ] audit export は read と別 permission、同じ query、全ページ、scope/audit/redaction を強制する。
- [ ] shared projection の concurrent write、partial failure、retry/reconciliation を fault-injection test で検証する。

## 検証

- multi-role UI/API contract と before/after regression
- cross-tenant/self/last-admin/inactive negative matrix
- current identity / session revoke / deleted projection integration
- per-panel/row loading/error/retry component test
- audit pagination/export permission/fault-injection
