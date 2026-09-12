# Issue #345: benchmarkのsemantic証跡をrequired gateへ追加する

保存先: `tasks/do/20260807-0812-issue-345-benchmark-semantic-required-gate.md`

状態: do

タスク種別: 修正

## 背景と原因分析

Issue #345 と Draft PR #462 は8 AppViewsのUI品質証跡をrequired Chromium gateへ収束している。benchmarkはreflow、keyboard scroll region、contrast、target、motion、loading/error/permission/retryの自動証跡を持つ一方、`AC-SQ016-003`だけが画面固有のaccessible name / role / value証跡を持たず`blocked`である。

確認済み事実:

- production `BenchmarkWorkspace` はregion、heading、label付きsuite / dataset / model / concurrency control、focus可能な実行履歴scroll region / tableを持つ。
- 既存`E2E-UI-SR-SEMANTICS-001`はChromium accessibility treeを検査するがbenchmarkを含まない。
- open PR #461 / #463 は`BenchmarkWorkspace.tsx`を変更するため、本taskでproduction componentを変更すると競合と重複が増える。
- current `main@0771521c`とDraft PR #462 `538db8dc`は前回実行後に変化していない。
- representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKitは未検証である。

根本原因は、画面横断AX baselineを各AppViewの受け入れ条件へ段階的に結ぶ作業がbenchmarkまで到達していなかったことにある。

## 目的と対象範囲

benchmarkの支援技術向けname / role / value / scroll-region契約をrequired Chromium E2Eで回帰検出し、`SQ-016`、UI正本、machine-readable trace / matrix、生成物を同じ証跡へ同期する。

- `apps/web/e2e/screen-reader-semantics.spec.ts` / README
- `REQ_SERVICE_QUALITY_016.md` / `DES_UI_UX_001.md`
- `tools/web-inventory/ui-traceability.json` / `ui-quality-matrix.json` と生成物
- task / report / completion status / Draft PR #462 / Issue #345

production component、API、permission、dataset selection、RAG挙動は変更しない。fixtureはPlaywright routeだけに置く。

## 実行計画

1. benchmarkのlandmark、heading、form control value、実行履歴scroll region / tableを既存AX E2Eへ追加する。
2. `SQ-016`、UI正本、trace、matrixを`AC-SQ016-003`と同じ証跡へ同期する。
3. generatorで派生文書を再生成し、lint / typecheck / unit / build / E2E / docs checksを実行する。
4. Draft PR #462とIssue #345へfinal-head結果と未完了事項を記録する。

## 受け入れ条件

- [x] Chromium AX treeでbenchmark region / headingを検証する。
- [x] suite / dataset / model / concurrency controlのname / role / valueを検証する。
- [x] 実行・更新・戻るbutton、実行履歴scroll region / tableを検証する。
- [x] fixtureをPlaywright routeへ限定し、production実装やAPI契約を変更しない。
- [x] benchmarkを`SQ-016 / AC-SQ016-003`と`E2E-UI-SR-SEMANTICS-001`へ追跡可能にする。
- [x] automatedだけを`pass`へ更新し、manual / overallは`blocked`を維持する。
- [x] 正本、machine-readable source、生成文書を同期する。
- [ ] 最小十分なlint / typecheck / unit / build / E2E / docs checksとfinal-head CIが成功するか、実行不能理由を未完了として記録する。
- [ ] Draft PR #462、セルフレビュー、Issue #345へfinal-head結果を記録する。

## 未決事項・リスク

- Chromium AX treeはrepresentative screen readerの読み上げ・操作結果を代替しない。
- 実browser 200% / 400% zoom、touch / real device、Firefox / WebKit、`OQ-UI-002`は未完了のまま維持する。
- `FR-051`永続化とprofile状態分類、API C1 85%目標は既存task / owner判断の対象であり、本taskに混ぜない。
- merge、deploy、release、force-push、破壊的変更は行わない。

## 2026-08-07 ローカル検証

- pass: targeted ESLint、repository lint、Web typecheck。
- pass: Web unit 62 files / 446 tests、Web production build（既存chunk-size advisoryのみ）。
- pass: UI trace 13 tests、semantic UI 5 tests、生成文書freshness、canonical docs、OpenAPI、API code docs、manual evidence structure、infra inventory、hidden Unicode、diff check。
- pass: targeted Playwright listing（Chromium 1件）。
- blocked: targeted Chromium E2E実走。sandboxがAPI server起動前の`tsx` IPC listenerを`listen EPERM`で拒否した。final-head GitHub Actionsで実走確認する。
- manual evidence recordは構造検証passだが、3 blocked / 1 not_runで`ready: false`を維持する。
