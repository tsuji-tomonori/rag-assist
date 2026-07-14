# 管理 UI の Alias governance・規模・responsive/a11y 品質を確立する

- 状態: todo
- 優先度: P1
- 種別: 実装 / UX / accessibility / governance
- 起票日: 2026-07-14
- 参照: `reports/working/admin-ui-audit-202607/30_admin_ui_revalidation_20260714.md`
- 関連 issue: `#345`
- 関連要件: `FR-095`, `FR-096`, `FR-097`, `FR-098`, `NFR-017`, `SQ-016`
- trace gap: `GAP-UI-003`〜`GAP-UI-008` の admin scope

## 目的

Alias review/publish と管理 dashboard を server-authoritative で説明可能な導線にし、規模増加、URL 復元、狭幅・高 zoom、keyboard/screen reader で管理 task を完了できる品質 gate を設ける。

## 対象範囲

`AdminWorkspace`、admin feature hooks/API、alias/user/role/audit/usage/cost panel、URL state、responsive/a11y test を対象とする。Issue #345 の共通 primitive/gate task と重複する横断実装は参照し、本 task は admin 固有 behavior と evidence の owner とする。

## 必要情報

- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/todo/20260714-issue-345-shared-ui-state-contract.md`
- `tasks/todo/20260714-issue-345-risky-operation-feedback.md`
- `tasks/todo/20260714-issue-345-cross-screen-a11y-responsive.md`

## 実行計画

1. server-authoritative data/state/version と client fallback を再棚卸しする。
2. list pagination、URL/context/source/as-of と operation feedback を実装する。
3. user vocabulary、high-density disclosure、responsive/a11y を修復する。
4. API/component/E2E/manual evidence を実行し、失敗を修復する。

## ドキュメントメンテナンス計画

admin API/data/UI design、`FR-095`〜`FR-098`、`DES_UI_UX_001`、generated inventory を同期する。API/schema/access-control を変更する場合は静的 policy と API test も更新する。

## 受け入れ条件

- [ ] Alias transition は server-defined state/version、必須 reason、actor/result/audit を持ち、client の架空 status/time fallback を使わない。
- [ ] Alias/audit list は stable cursor、total/truncation、filter を持ち、UI の 8 件切りや server の silent slice を廃止する。
- [ ] section/filter/sort/selection は URL から復元でき、panel ごとの source/as-of/stale/refresh を表示する。
- [ ] overview の permission-aware card は該当 section/filter/detail へ遷移し、根拠不明の zero/alert/threshold を表示しない。
- [ ] role/permission/application role/resource group は承認済み display metadata と用語で区別し、raw ID は補助情報にする。
- [ ] 320px と 400% zoom で主要操作が horizontal page scroll に依存せず、情報優先度と detail disclosure を保つ。
- [ ] semantic table/list、対象付き accessible name、focus return、live/error/busy、target size、contrast を満たす。
- [ ] keyboard、screen reader、contrast、320px/400% zoom、row error/retry、large dataset の automated/manual evidence を release gate にする。
- [ ] production UI の値は API/props/state または明示的 unavailable/loading/error/permission に由来し、demo fallback を使わない。

## 検証

- alias state/version/reason API・component test
- URL restoration と panel refresh test
- responsive visual regression（320px/400%）
- keyboard/focus/live region/screen-reader/contrast evidence
- pagination/load test と No Mock Product UI review

## PR レビュー観点

docs と実装、server-authoritative state、管理 route/resource permission、対象付き audit/result、large dataset、a11y/responsive の同期を確認する。

## 未決事項・リスク

API が pagination/source/as-of/audit reference を返さない領域は UI だけで推定せず、API gap として同一または dependent task に分離する。
