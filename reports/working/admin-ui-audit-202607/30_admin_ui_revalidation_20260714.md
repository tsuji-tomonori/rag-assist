# 管理画面監査の現行 main 再検証（2026-07-14）

## 基準と判定規則

- 初回監査: `9cd904d3c5203caf2400eb2ff654096d63f9d8fb`
- 再検証: `c6eff7deef0d8f3d06d66391be181e45b058aaaf`（PR #341–#343 取り込み後）
- `resolved`: 初回 gap の主要な誤表示または security/data integrity 条件が production path と test で解消
- `partially_resolved`: 危険な表示・主要境界は改善したが、同じ gap の機能または運用条件が残る
- `open`: 現行 source/test で主要条件が未実装または evidence gap のまま

静的 source/test と GitHub PR metadata を再確認した。実 AWS、請求照合、production traffic、実 browser、screen reader、320px/400% zoom は実施していない。

## 結論

36 gap の現行状態は `resolved` 4、`partially_resolved` 10、`open` 22 である。特に次の初回事実は現行 main へそのまま適用できない。

- Cost は固定単価の偽精度を表示せず、承認済み price catalog と完全な usage evidence がない場合は `available: false` を返す。これは誤表示の解消であり、料金監査機能の完成ではない。
- Usage は document owner と benchmark creator に由来する二指標だけを available とし、chat/question/debug/conversation は `unavailableMetrics` に分離する。実行量の完全計測は未実装である。
- application role は contract の 12 role を API/authorization/infra provisioning が共有し、drift test を持つ。
- production の role mutation、user create、suspend/restore/delete は verified identity、tenant/active guard、session revoke、audit outbox、deny-first cleanup、移管 fence を持つ。
- 一方、Web の role editor は依然として一つの select を一要素配列で保存し、panel/row 別 query state、監査画面の共通 outbox 接続、alias governance、pagination、responsive/a11y は残る。

## 36 gap の再判定

| Gap | 現行状態 | 現行根拠 / 補正 | 残余 action |
| --- | --- | --- | --- |
| `GAP-AUI-001` | `partially_resolved` | `listUsageSummaries` は document/benchmark だけを算出し、未計測指標を unavailable にする。完全な runtime usage event はない | Usage event と completeness を実装 |
| `GAP-AUI-002` | `partially_resolved` | `getCostAuditSummary` は根拠不足時に `available: false` を返し、固定単価の偽精度を除去 | versioned price と同一期間集計を実装 |
| `GAP-AUI-003` | `partially_resolved` | document は owner、benchmark は `createdBy` へ帰属し、他指標は unavailable | 全実行の tenant/subject/run attribution を実装 |
| `GAP-AUI-004` | `partially_resolved` | 正値の丸め誤表示は cost 非表示で回避したが user/unit/price/subtotal は未提供 | 根拠付き明細と precision rule を実装 |
| `GAP-AUI-005` | `open` | Usage/Cost panel に period/group/user/model/feature filter、比較、異常、drill-down がない | Usage/Cost task で実装 |
| `GAP-AUI-006` | `open` | export route はあるが Web control はなく、panel は未提供と表示 | 同一 query を使う export UI を追加 |
| `GAP-AUI-007` | `open` | audit export は `access:policy:read`、cost export は `cost:read:all` を再利用 | export 専用 permission/scope/audit を追加 |
| `GAP-AUI-008` | `partially_resolved` | PR #339 は open・未 merge・mergeable false のまま。現行の honest unavailable state が危険な固定概算を置換 | candidate を選択移植し migration/canary を実施 |
| `GAP-AUI-009` | `resolved` | `APPLICATION_ROLES` と `ROLE_CATALOG_VERSION` を contract、API、infra が共有し、`role-provisioning-contract.test.ts` が全 role を検証 | drift regression を維持 |
| `GAP-AUI-010` | `open` | `AdminUserPanel` は `selectedRole` から `nextGroups = [selectedRole]` を作る | multi-role grant/revoke delta UI を実装 |
| `GAP-AUI-011` | `open` | `AdminRolePanel` は raw role、permission 数、comma list の read-only 表示 | display metadata、risk、検索、比較を追加 |
| `GAP-AUI-012` | `open` | custom role editor は未提供と明記され、preset/custom 方針は未決定 | owner 決定後に contract を確定 |
| `GAP-AUI-013` | `resolved` | `ApplicationRoleMutationService` が reason、authoritative identity、same tenant/active/self/last-admin guard、fence、session revoke、audit outbox、rollback/reconciliation を実装 | UI を現行 service contract へ接続し regression 維持 |
| `GAP-AUI-014` | `partially_resolved` | backend は session revoke と current identity 再検証を行う。UI は self/付与不能 role の事前 capability と propagation 説明を持たない | server capability と UI state を追加 |
| `GAP-AUI-015` | `resolved` | `createManagedUser` は production で authoritative directory user/group を作成し、失敗時に compensation と audit result を残す | lifecycle integration test を維持 |
| `GAP-AUI-016` | `resolved` | account lifecycle は revocation registry、directory disable/enable/delete、session revoke、request/worker current identity、deny-first cleanup を使う | live identity acceptance は別 task で実施 |
| `GAP-AUI-017` | `partially_resolved` | directory sync は verified identity の status/groups を投影する。一方 `loadAdminLedger` の deleted actor active 化と version/as-of 欠落は残る | projection invariant と reconciliation version を修正 |
| `GAP-AUI-018` | `open` | user search/filter/detail/effective permission/cursor と管理画面の resource-group 導線がない | Access/Audit task で実装 |
| `GAP-AUI-019` | `open` | `useAdminData` は一つの `loading/error` を全 mutation/panel で共有 | query key / row 単位 state へ分離 |
| `GAP-AUI-020` | `open` | `useAppShellState` 初期 loader は admin failure を `console.warn` へ落とす | typed error と scoped retry を表示 |
| `GAP-AUI-021` | `open` | overview count は loader status/source/as-of を持たず、失敗と zero を一貫して分離できない | status-aware count contract を導入 |
| `GAP-AUI-022` | `open` | Web wrapper は nested runtime schema と unavailable/forbidden/error の判別が浅い | shared runtime schema を導入 |
| `GAP-AUI-023` | `open` | users 以外の refresh/as-of、URL 復元、alias の単一 refresh key がない | query/URL/cache key を正規化 |
| `GAP-AUI-024` | `open` | document/question/debug/benchmark は action card だが admin KPI は read-only で section/filter へ遷移しない | permission-aware deep link を追加 |
| `GAP-AUI-025` | `open` | quality action API は管理 UI から未使用 | overview へ統合または廃止決定 |
| `GAP-AUI-026` | `partially_resolved` | account/role mutation は共通 security audit outbox へ全 result/reason/policy を記録する。AdminAuditPanel は旧 ledger の成功操作だけを読む | 共通 audit read model へ接続 |
| `GAP-AUI-027` | `open` | admin audit 100、alias audit 200、UI alias audit 8 の silent slice が残る | cursor/total/truncation と全件 export を実装 |
| `GAP-AUI-028` | `partially_resolved` | role/account mutation は fence/outbox を持つが `AdminLedger` と alias ledger の JSON read-modify-write は version なし | projection/alias を conditional write または durable store へ移行 |
| `GAP-AUI-029` | `open` | alias reject は固定 `Rejected from UI`、client fallback state/time、version なし transition が残る | server-authoritative reason/version/state table を実装 |
| `GAP-AUI-030` | `open` | users/usage/audit/alias は cursor/index/load evidence を持たず固定 slice/client 集計が残る | tenant+period index、stable cursor、load test を追加 |
| `GAP-AUI-031` | `open` | 320px/400% reflow の実装・検証証跡は追加されていない | responsive gate を実施 |
| `GAP-AUI-032` | `open` | target size、semantic table、focus/live/error/contrast の統合証跡がない | a11y 実装・manual/automation gate を追加 |
| `GAP-AUI-033` | `open` | 英語 tab、raw role/permission、application role と resource group の用語混在が残る | display metadata と承認済み用語を適用 |
| `GAP-AUI-034` | `open` | admin の keyboard/screen-reader/contrast/zoom/row-error test は未追加 | release test matrix を追加 |
| `GAP-AUI-035` | `partially_resolved` | canonical docs root と validator は確立した。本 PR の旧 bundle は reports へ移し、stale baseline の規範化を防ぐ | live evidence と owner decision を後続 task で確定 |
| `GAP-AUI-036` | `open` | `usage:read:own` / `cost:read:own` の consumer と global/own 方針は未確定 | scope 方針を決定し route/store で強制 |

## PR #339 の扱い

2026-07-14 再確認時点で PR #339 は open、未 merge、head `e7654ad4bdf3b825557f4f1a503443638bf82325`、115 files、mergeable false である。UsageEvent、completeness、breakdown、export UI は再利用候補だが、tenant 固定経路、Scan 後 1,000 件上限、汎用固定価格、旧 main との差分、live AWS 未検証を残す。そのまま merge せず、`tasks/todo/20260714-1011-admin-usage-cost-integrity.md` の migration gate で選択移植する。

## Canonical docs への影響

本 PR は production behavior を変更せず、旧 proposed requirements も現行 owner decision を経ていない。したがって canonical REQ/ARC/DES/OPS は更新しない。確認済みの残余実装は `tasks/todo/` へ置き、初回 proposed requirements は履歴 bundle に留める。
