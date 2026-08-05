# Issue #345: 履歴画面のkeyboard・semantic証跡をrequired gateへ追加する

保存先: `tasks/do/20260806-0815-issue-345-history-a11y-required-gate.md`

状態: do

タスク種別: 修正

## 背景

Issue #345 と Draft PR #462 は、8 AppViews のUI品質証跡をrequired Chromium gateへ収束している。
履歴画面はloading / error / permission / retry、responsive、target sizeの自動証跡を持つ一方、
`AC-SQ016-002` / `003` は画面固有のkeyboard journeyとChromium accessibility tree契約がなく、
automated statusが`blocked`のままである。

## 原因分析（なぜなぜ）

### 問題文

履歴画面の検索、並び替え、お気に入り絞り込み、会話選択はnative controlで実装されているが、
keyboard-onlyでの到達・操作と支援技術向けname / role / valueをrequired gateで検査していないため、
該当2基準の自動適合を根拠付きで判定できない。

### 確認済み事実

- `HistoryWorkspace` は`section[aria-label="履歴"]`、見出し、label付きsearch / select / checkbox、会話操作buttonを持つ。
- `keyboard-navigation.spec.ts` は主要navigationと個人設定を検査するが、履歴toolbarと会話操作を検査しない。
- `screen-reader-semantics.spec.ts` はlogin / chat / documents / profileだけをChromium AX treeで検査する。
- `history / AC-SQ016-002` / `003` はquality matrixで`automated: blocked`である。
- current `main@0771521c` とDraft PR #462のbase/headは前回実行後に変化していない。
- open PR #461は`HistoryWorkspace.tsx`を変更するが`apps/web/src/styles/features/history.css`と今回のE2E specは変更していない。

### 推定・未確認

- 推定: 横断auditは候補検出を優先し、画面固有の操作・AX契約を段階的に追加する計画のため履歴が未着手で残った。
- 未確認: representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKitの結果。

### 根本原因

画面 inventory と品質基準は結合されているが、各画面の主要controlをrequired keyboard / AX E2Eへ追加しない限り
automated statusをpassにしない段階的な証跡運用で、履歴画面の実行可能証跡がまだ作られていない。

### 対策と対象範囲

- 履歴toolbarと主要会話操作へ3px `:focus-visible`を局所適用する。
- 履歴へのkeyboard到達、検索・並び替え・絞り込み・会話選択へのTab到達とnative key操作を検証する。
- 履歴region / heading / textbox / combobox / checkbox / buttonをChromium AX tree契約へ追加する。
- `history / AC-SQ016-002` / `003`のautomatedだけを更新し、manual / overallは`blocked`を維持する。

## 目的

履歴画面の主要jobをkeyboard-onlyで実行でき、支援技術向けname / role / valueが欠落しないことを
required Chromium E2Eで回帰検出し、正本・machine-readable matrix・生成物を同じ証跡へ同期する。

## 対象範囲

- `apps/web/e2e/keyboard-navigation.spec.ts`
- `apps/web/e2e/screen-reader-semantics.spec.ts`
- `apps/web/src/styles/features/history.css`
- `apps/web/e2e/README.md`
- `REQ_SERVICE_QUALITY_016.md` / `DES_UI_UX_001.md`
- `tools/web-inventory/ui-quality-matrix.json` と生成物
- task / report / completion status / Draft PR #462 / Issue #345

## 方針

- test-only fixtureで履歴を明示注入し、productionに固定の会話・件数・fallbackを追加しない。
- native search / select / checkbox / buttonの意味論とkey操作を検査し、テスト都合のARIAを追加しない。
- #461が変更する`HistoryWorkspace.tsx`には触れず、CSS・E2E・正本だけの局所差分にする。
- Chromium AX treeをrepresentative screen readerの実測へ読み替えない。

## 実行計画

1. taskとRCA、受け入れ条件を確定する。
2. 履歴controlの可視focusとkeyboard / AX E2Eを追加する。
3. `SQ-016`、UI正本、quality matrixを更新し、generatorで生成物を同期する。
4. 最小十分なlint / typecheck / unit / build / E2E / docs checksを実行する。
5. report / commitを作成し、Draft PR #462とIssue #345へ結果・blockerを記録する。

## ドキュメントメンテナンス計画

- `SQ-016`へ履歴のrequired keyboard / Chromium AX evidenceとmanual境界を追記する。
- `DES_UI_UX_001`のhistory traceと画面固有契約を更新する。
- authored JSON更新後に`npm run docs:web-inventory`でgenerated Web docsを再生成し、生成物は手編集しない。
- README / API / OpenAPI /運用文書はAPI・運用契約を変更しないため対象外とする。

## 受け入れ条件

- [ ] keyboard-onlyで履歴へ到達し、検索、並び順、お気に入り絞り込み、会話選択へ順に到達・操作できる。
- [ ] 対象controlに可視3px outlineがあり、Tab focus順で到達できる。
- [ ] Chromium AX treeで履歴region / heading / searchbox / combobox / checkbox /主要buttonのname / role / valueを検証する。
- [ ] test-only fixtureがproduction UI/data pathへ混入しない。
- [ ] `history / AC-SQ016-002` / `003`のautomatedのみを`pass`とし、manual / overallを`blocked`に維持する。
- [ ] `SQ-016`、`DES_UI_UX_001`、quality matrix、生成物が同じ証跡を参照する。
- [ ] targeted E2E、lint、typecheck、unit、build、trace / semantic / docs checksが成功するか、実行不能理由を未完了として記録する。
- [ ] Draft PR #462、受け入れ条件、セルフレビュー、Issue #345へfinal-head結果を記録する。

## 検証計画

- Playwright targeted Chromium E2E / required UI quality listing。
- targeted ESLint、Web typecheck / unit / build。
- UI trace、semantic UI、generated inventory、canonical docs、hidden Unicode、`git diff --check`。
- final-head GitHub Actions Web UI Quality / MemoRAG CI / semver。

## PRレビュー観点

- keyboard testが`click()` / `fill()` / `selectOption()`で履歴の主要操作を代替しないこと。
- AX treeが表示文言だけでなくname / role / valueを検証すること。
- production値がAPI/state以外のfixtureで埋められていないこと。
- Chromium automationをmanual screen reader / zoom / real-device passへ昇格しないこと。
- 認可、RAG根拠性、benchmark dataset固有分岐を変更しないこと。

## 未決事項・リスク

- 未完了: representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKit、`OQ-UI-002`。
- 未完了: profileの`FR-051`永続化・保存失敗/retry/permission/N/A分類・owner判断。
- リスク: #461が後から履歴DOMを変更する場合、required E2Eが意味論の回帰を検出し、必要な調整が発生する。
- 禁止: merge、deploy、release、force-push、破壊的変更は行わない。

## 2026-08-06 ローカル検証

- pass: `npx eslint apps/web/e2e/keyboard-navigation.spec.ts apps/web/e2e/screen-reader-semantics.spec.ts --max-warnings=0`
- pass: `npm run lint`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`（62 files / 446 tests）
- pass: `npm run build -w @memorag-mvp/web`（既存chunk-size advisoryのみ）
- pass: targeted Playwright listing（2 spec）
- pass: `npm run docs:web-trace:test`（13 tests）
- pass: `npm run test:web-semantic-ui`（5 tests）
- pass: canonical docs、generated inventory、manual evidence構造、infra inventory、hidden Unicode、OpenAPI、API code docs、`git diff --check`
- blocked: targeted Chromium E2E実走。sandboxの`tsx` IPCが`listen EPERM`となりAPI server起動前に停止した。final-head GitHub Actionsで実走する。
- unavailable: `task docs:check`は`task` CLI未導入。確認済みTaskfileの下位コマンドを直接実行した。

final-head CI、Draft PR本文・受け入れ条件・セルフレビュー、Issue #345コメントは未完了のため、状態は`do`を維持する。
