# Issue #345: 個人設定のkeyboard・semantic証跡をrequired gateへ追加する

保存先: `tasks/do/20260803-0839-issue-345-profile-a11y-required-gate.md`

状態: do

タスク種別: 修正

## 背景

Issue #345 と Draft PR #462 は、8 AppViews のUI品質証跡をrequired Chromium gateへ収束している。
個人設定は `E2E-UI-KEYBOARD-NAV-001` と `E2E-UI-SR-SEMANTICS-001` の既存自動検査に含まれていない、
または検査自体がrequired UI quality selectorに含まれていないため、`AC-SQ016-002` / `003` の
automated statusが`blocked`のままである。

## 原因分析（なぜなぜ）

### 問題文

個人設定のnavigation、送信キー、戻る操作はkeyboardで利用でき、region / heading / form controlも
semantic HTMLを持つ一方、画面固有のkeyboard journeyとChromium accessibility tree契約が
required gateで実走しないため、該当2基準の自動証跡を合格判定できない。

### 確認済み事実

- `PersonalSettingsView` は`section[aria-label="個人設定"]`、見出し、label付きselect、戻る・sign out buttonを持つが、個人設定内controlには共通navigationの3px `:focus-visible`が適用されていない。
- `keyboard-navigation.spec.ts` は個人設定へのkeyboard到達を検査するが、個人設定内のcontrol操作を検査しない。
- `screen-reader-semantics.spec.ts` はlogin / chat / documentsのChromium AX tree契約のみを検査する。
- 上記2 specは`test:e2e:ui-quality`の明示対象に含まれず、PR required gateで実走しない。
- current `main@0771521c`、Draft PR #462のbase、open PR構成は前回実行後に変化していない。
- open PR #461はshared UI production component、#458はdocuments production codeを変更するが、どちらも`layout.css`を変更していないため、個人設定固有focus styleを競合しない局所差分にできる。

### 推定・未確認

- 推定: keyboard / AX tree検査を独立PRで追加した後、required selectorと画面単位matrixへの収束が未実施だった。
- 未確認: representative screen reader、実browser 200%/400% zoom、touch / real device、Firefox / WebKitの結果。

### 根本原因

自動検査の存在とrequired gate登録、画面固有journey、machine-readable statusを一つの完了条件として
結ぶ検出規則がなく、個人設定のsemantic controlまで証跡範囲を拡張しないまま検査が任意実行に留まった。

### 対策と対象範囲

- 個人設定内controlへ3px `:focus-visible`を適用し、送信キー変更とチャット復帰をkeyboard-onlyで検証する。
- 個人設定のregion / heading / combobox / buttonをChromium AX tree契約へ追加する。
- 両specをrequired UI quality selectorへ登録する。
- この証跡だけで`profile / AC-SQ016-002` / `003` automatedを更新し、manual / overallは`blocked`を維持する。

## 目的

個人設定のkeyboard-only操作と支援技術向けname / role / value契約をrequired Chromium E2Eで回帰検出し、
正本・machine-readable trace・生成物を同じ証跡へ同期する。

## 対象範囲

- `apps/web/e2e/keyboard-navigation.spec.ts`
- `apps/web/e2e/screen-reader-semantics.spec.ts`
- `apps/web/src/styles/layout.css`
- `apps/web/package.json`
- `REQ_SERVICE_QUALITY_016.md` / `DES_UI_UX_001.md`
- `tools/web-inventory/ui-quality-matrix.json` / `ui-traceability.json` と生成物
- task / report / completion status / Draft PR #462 / Issue #345

## 方針

- 個人設定controlのfocus indicatorだけを局所修正し、auth、API、認可、RAG挙動は変更しない。
- native `select` とbuttonの既存意味論を実DOM / Chromium AX treeで検証し、テスト用ARIAは追加しない。
- Chromium AX treeは実screen readerの代替ではないことを証跡と文書に残す。

## 必要情報

- Issue #345、Draft PR #462、current main、open PR / Issue。
- `SQ-016`、`DES_UI_UX_001`、UI quality matrix / traceability、既存E2E。
- `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`。

## 実行計画

1. 個人設定controlの可視focusを修正し、keyboard journeyとAX tree契約を既存E2Eへ追加する。
2. 両specをrequired UI quality commandへ追加する。
3. 正本、trace、quality matrixを同じ証跡へ更新し、generatorで生成物を同期する。
4. 最小十分なlint / typecheck / unit / build / E2E / docs checksを実行する。
5. report / commitを作成し、Draft PR #462とIssue #345へ結果・blockerを記録する。

## ドキュメントメンテナンス計画

- `SQ-016`へ個人設定のkeyboard / Chromium AX tree required evidenceとmanual境界を追記する。
- `DES_UI_UX_001`へrequired selectorと画面固有契約を追記する。
- authored JSONを更新後、`npm run docs:web-inventory`でgenerated Web docsを再生成し、生成物は手編集しない。
- README / API / OpenAPI /運用文書はproduct/API/運用契約を変更しないため対象外とする。

## 受け入れ条件

- [x] keyboard-onlyで個人設定へ到達し、送信キーのvalueを変更し、チャットへ戻れる。
- [x] focus対象に可視3px outlineがあり、個人設定内のfocus順でtargetへ到達できる。
- [x] Chromium AX treeで個人設定region、heading、送信キーcombobox、戻る・sign out buttonのname / roleを検証する。
- [x] `test:e2e:ui-quality`がkeyboard / AX treeの2 specをrequired Chromium対象として列挙する。
- [x] `profile / AC-SQ016-002` / `003`のautomatedのみを`pass`とし、manual / overallを`blocked`に維持する。
- [x] `SQ-016`、`DES_UI_UX_001`、traceability、quality matrix、生成物が同じ証跡を参照する。
- [x] targeted E2E、lint、typecheck、unit、build、trace / semantic / docs checksが成功するか、実行不能理由を未完了として記録する。
- [x] Draft PR #462、受け入れ条件、セルフレビュー、Issue #345へfinal-head結果を記録する。

## 検証計画

- Playwright test listing / targeted Chromium E2E / required UI quality E2E。
- targeted ESLint、Web typecheck / unit / build。
- UI trace、semantic UI、generated inventory、canonical docs、hidden Unicode、`git diff --check`。
- final-head GitHub Actions Web UI Quality / MemoRAG CI / semver。

## PRレビュー観点

- keyboard testが`click()`や`selectOption()`で主要操作を代替せず、実key inputを使うこと。
- AX treeが表示文言ではなく支援技術向けname / roleを検証すること。
- Chromium automationをmanual screen reader / zoom / real-device passへ昇格しないこと。
- production変更が個人設定controlのfocus indicatorに限定され、認可、RAG根拠性、benchmark dataset固有分岐を変更しないこと。

## 未決事項・リスク

- 決定事項: `profile / AC-SQ016-007`は状態契約のowner判断が必要なため、本taskでは`blocked`を維持する。
- リスク: required gateが2 spec増えるため実行時間が増える。
- リスク: native selectのkeyboard挙動はOS/browser差があるため、PR required Chromiumだけを合格範囲とする。
- 未完了: representative screen reader、実browser 400% zoom、touch / real device、Firefox / WebKit、`OQ-UI-002`。
- 禁止: merge、deploy、release、force-push、破壊的変更は行わない。

## 2026-08-03 ローカル検証

- pass: `npm run lint`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`（61 files / 443 tests）
- pass: `npm run build -w @memorag-mvp/web`（既存chunk-size advisoryのみ）
- pass: `npm run docs:web-trace:test`（13 tests）
- pass: `npm run test:web-semantic-ui`（5 tests）
- pass: `npm run docs:web-inventory:check`、`python3 scripts/validate_docs.py`、manual evidence / infra / hidden Unicode checks
- pass: `node --import tsx src/validate-openapi-docs.ts`とAPI code docs check
- pass: required UI quality Playwright listing（33件、追加2 specを検出）
- blocked: targeted Chromium E2E実走。sandboxの`tsx` IPCが`listen EPERM`となりAPI server起動前に停止した。final-head GitHub Actionsで実走する。
- unavailable: `task docs:check`は`task` CLI未導入。確認済みTaskfileの下位コマンドを直接実行した。

## 2026-08-03 GitHub Actions

- pass: [Web UI Quality run 30773229830](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30773229830)（33 / 33）
- pass: [MemoRAG CI run 30773229895](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30773229895)
- pass: [Validate Semver Label run 30773229841](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30773229841)
- quality gap: API C1は80.48%で85%目標未達。既存`tasks/todo/20260712-coverage-api-c1-recovery.md`で追跡し、本taskの完了根拠にはしない。

本taskの自動受け入れ条件は満たしたが、Issue #345全体のmanual evidenceとowner判断が未完了のため、状態は`do`を維持する。
