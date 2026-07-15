# 管理 UI の Alias governance・規模・responsive/a11y 品質を確立する

- 状態: in_progress
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
- `tasks/done/20260714-issue-345-shared-ui-state-contract.md`
- `tasks/done/20260714-issue-345-risky-operation-feedback.md`
- `tasks/todo/20260714-issue-345-cross-screen-a11y-responsive.md`
- 依存 draft PR: `#348`〜`#354`（stacked base: `902ad3f2`）

## 作業前チェックリスト

- [x] audit report、正規 FR/design、UI trace gap から admin persona/job/state/actor/next action を棚卸しする。
- [x] AdminWorkspace、admin hooks/API と alias/user/role/audit/usage/cost の server-authoritative field・pagination・URL state を確認する。
- [x] route-level permission、resource/tenant boundary、機微 field、audit/result evidence と access-control policy への影響を確認する。
- [x] No Mock Product UI、large dataset、retry/partial/stale、keyboard/responsive/a11y の実装・検証対象を確定する。
- [x] README、正規 docs、generated inventory、API/data/security docs と最小十分な test/build/docs gate を選定する。

## Done 条件

- [x] 下記受け入れ条件を満たす admin 固有の server-authoritative UI/API behavior が実装されている。
- [x] 管理 route/resource permission、tenant/owner boundary、audit/actor/result、機微情報、No Mock Product UI を弱めていない。
- [x] large dataset、pagination、URL restoration、stale/partial/error/retry、responsive/keyboard/a11y を false success なしで検証できる。
- [x] 関連 FR、design、traceability、generated inventory と必要な API/data/security docs が実装と同期している。
- [x] 選定した lint、typecheck、test、build、E2E、visual/axe、docs check が成功し、未実施 manual 検証は理由付きで記録されている。
- [ ] 日本語 commit、draft PR、受け入れ確認コメント、セルフレビュー、作業レポート、task の `done` 移動と lifecycle commit/push が完了している。

## 実行計画

1. server-authoritative data/state/version と client fallback を再棚卸しする。
2. list pagination、URL/context/source/as-of と operation feedback を実装する。
3. user vocabulary、high-density disclosure、responsive/a11y を修復する。
4. API/component/E2E/manual evidence を実行し、失敗を修復する。

作業前の仕様復元・検証選定は `reports/working/20260715-0007-issue-345-admin-ui-governance-spec-analysis.md` に記録する。正式な role 日本語用語、料金/閾値、audit retention/export、browser/AT matrix は owner 未決のため固定値で補わない。

## ドキュメントメンテナンス計画

admin API/data/UI design、`FR-095`〜`FR-098`、`DES_UI_UX_001`、generated inventory を同期する。API/schema/access-control を変更する場合は静的 policy と API test も更新する。

## 受け入れ条件

- [x] Alias transition は server-defined state/version、必須 reason、actor/result/audit を持ち、client の架空 status/time fallback を使わない。
- [x] Alias/audit list は stable cursor、total/truncation、filter を持ち、UI の 8 件切りや server の silent slice を廃止する。
- [x] section/filter/sort/selection は URL から復元でき、panel ごとの source/as-of/stale/refresh を表示する。
- [x] overview の permission-aware card は該当 section/filter/detail へ遷移し、根拠不明の zero/alert/threshold を表示しない。
- [x] role/permission/application role/resource group は canonical catalog metadata と用語で区別し、raw ID は補助情報にする。正式な全日本語用語は owner 未決として断定しない。
- [x] 320 CSS px と 375/768/1280px automated reflow で主要操作が horizontal page scroll に依存せず、情報優先度と detail disclosure を保つ。実 browser 400% zoom は未実施で、manual release gate へ残す。
- [x] semantic table/list、対象付き accessible name、focus return、live/error/busy、44px target と automated axe gate を満たす。
- [x] keyboard、screen reader、contrast、320px/400% zoom、row error/retry、large dataset の automated/manual evidence を release gate として trace する。screen reader・実 400% zoom・実端末は未実施のまま manual task を閉じない。
- [x] production UI の値は API/props/state または明示的 unavailable/loading/error/permission に由来し、demo fallback を使わない。

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

## 実施結果

- API/Web 実装、canonical docs、OpenAPI/API-code/Web inventory、E2E snapshot を同期した。
- `apps/api: npm test` 779/779、`apps/web: npm test -- --run` 384/384、Playwright smoke 15/15、typecheck、lint、build、`task docs:check`、semantic UI、Web trace、contract test、`git diff --check` を成功させた。
- 実 screen reader、実 browser 400% zoom、実端末/AT matrix は未実施であり、`tasks/todo/20260714-issue-345-manual-a11y-evidence.md` の release gate を閉じていない。
- alias multi-object publish atomicity、admin common audit/outbox、usage/cost evidence integrity は各 P0 task へ残し、本 task で完了扱いにしていない。
