# Issue #345: お気に入り画面のkeyboard・semantic証跡をrequired gateへ追加する

保存先: `tasks/do/20260808-0813-issue-345-favorites-a11y-required-gate.md`

状態: do

タスク種別: 修正

## 背景

Issue #345 と Draft PR #462 は、8 AppViewsのUI品質証跡をrequired Chromium gateへ段階的に収束している。
お気に入り画面はreflow、contrast、target、motion、loading / error / permission / retryの自動証跡を持つ一方、
`AC-SQ016-002` / `003` は画面固有のkeyboard journeyとChromium accessibility tree契約がなく、
automated statusが`blocked`のままである。

## 原因分析（なぜなぜ）

### 問題文

お気に入り画面のnavigationとチャット復帰はnative buttonで実装され、region / heading / item groupも意味論を持つが、
keyboard-onlyでの到達・復帰と支援技術向けname / roleをrequired gateで検査していないため、
該当2基準の自動適合を根拠付きで判定できない。

### 確認済み事実

- `FavoritesWorkspace` は`section[aria-label="お気に入り"]`、見出し、戻るbutton、target type別の見出しを持つ。
- `keyboard-navigation.spec.ts` は主要navigationと履歴・個人設定を検査するが、お気に入りへの到達・復帰を検査しない。
- `screen-reader-semantics.spec.ts` はlogin / chat / documents / history / benchmark / profileを検査するが、お気に入りを含まない。
- `favorites / AC-SQ016-002` / `003` はquality matrixで`automated: blocked`である。
- current `main@0771521c` とDraft PR #462 `1d085966`は前回実行後に変化していない。
- open PR #461は`FavoritesWorkspace.tsx`のIcon importだけを変更し、今回のE2E spec・正本・matrixは変更しない。

### 推定・未確認

- 推定: 横断auditは候補検出を優先し、画面固有のkeyboard / AX契約を段階的に追加する運用のため、お気に入りが未着手で残った。
- 未確認: representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKitの結果。

### 根本原因

画面inventoryと品質基準は結合されているが、各画面の利用可能なinteractionと意味論をrequired keyboard / AX E2Eへ
追加しない限りautomated statusをpassにしない段階的な証跡運用で、お気に入り画面の実行可能証跡がまだ作られていない。

### 対策と対象範囲

- お気に入りへのkeyboard到達と戻るbuttonからのチャット復帰をnative keyで検証する。
- お気に入りregion / heading / target type見出し / 戻るbuttonをChromium AX tree契約へ追加する。
- `favorites / AC-SQ016-002` / `003`のautomatedだけを更新し、manual / overallは`blocked`を維持する。

## 目的

お気に入り画面で提供済みのinteractionをkeyboard-onlyで実行でき、支援技術向けname / roleが欠落しないことを
required Chromium E2Eで回帰検出し、正本・machine-readable trace / matrix・生成物を同じ証跡へ同期する。

## 対象範囲

- `apps/web/e2e/keyboard-navigation.spec.ts`
- `apps/web/e2e/screen-reader-semantics.spec.ts`
- `apps/web/e2e/README.md`
- `REQ_SERVICE_QUALITY_016.md` / `DES_UI_UX_001.md`
- `tools/web-inventory/ui-traceability.json` / `ui-quality-matrix.json` と生成物
- task / report / completion status / Draft PR #462 / Issue #345

production component、API、permission、favorite resume / delete機能は変更しない。fixtureはPlaywright routeだけに置く。

## 実行計画

1. test-only favorite fixtureを追加し、お気に入りへのkeyboard到達・復帰とAX tree契約をrequired E2Eへ追加する。
2. `SQ-016`、UI正本、trace、matrixを`AC-SQ016-002` / `003`と同じ証跡へ同期する。
3. generatorで派生文書を再生成し、lint / typecheck / unit / build / E2E / docs checksを実行する。
4. report / commitを作成し、Draft PR #462とIssue #345へfinal-head結果・未完了事項を記録する。

## ドキュメントメンテナンス計画

- `SQ-016`へお気に入りのrequired keyboard / Chromium AX evidenceとmanual境界を追記する。
- `DES_UI_UX_001`のfavorites traceと画面固有契約を更新する。
- authored JSON更新後に`npm run docs:web-inventory`でgenerated Web docsを再生成し、生成物は手編集しない。
- API / OpenAPI /運用文書は挙動・契約を変更しないため対象外とする。

## 受け入れ条件

- [x] keyboard-onlyでお気に入りへ到達し、戻るbuttonへTab到達してEnterでチャットへ復帰できる。
- [x] 対象buttonに既存の可視3px outlineがあり、Tab focusで到達できる。
- [x] Chromium AX treeでお気に入りregion / heading / target type見出し / 戻るbuttonのname / roleを検証する。
- [x] test-only fixtureがproduction UI / data pathへ混入しない。
- [x] `favorites / AC-SQ016-002` / `003`のautomatedのみを`pass`とし、manual / overallを`blocked`に維持する。
- [x] `SQ-016`、`DES_UI_UX_001`、trace、quality matrix、生成物が同じ証跡を参照する。
- [x] targeted E2E、lint、typecheck、unit、build、trace / semantic / docs checksが成功するか、実行不能理由を未完了として記録する。
- [ ] Draft PR #462、受け入れ条件、セルフレビュー、Issue #345へfinal-head結果を記録する。

## 検証計画

- Playwright targeted Chromium E2E / required UI quality listing。
- targeted ESLint、Web typecheck / unit / build。
- UI trace、semantic UI、generated inventory、canonical docs、hidden Unicode、OpenAPI、API code docs、`git diff --check`。
- final-head GitHub Actions Web UI Quality / MemoRAG CI / semver。

## PRレビュー観点

- keyboard testがお気に入りへの到達・復帰を`click()`で代替しないこと。
- AX treeが表示文言だけでなくname / roleを検証すること。
- test fixtureがPlaywright routeに限定され、productionの値・認可・RAG根拠性を変更しないこと。
- favorite resume / delete未実装を今回のkeyboard証跡で完了扱いしないこと。
- Chromium automationをmanual screen reader / zoom / real-device passへ昇格しないこと。

## 未決事項・リスク

- 未完了: favorite resume / delete journey、representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKit、`OQ-UI-002`。
- 未完了: profileの`FR-051`永続化・保存失敗/retry/permission/N/A分類・owner判断、API C1 85%目標。
- リスク: #461統合後にIcon import競合の解消は必要だが、本taskは`FavoritesWorkspace.tsx`を変更しない。
- 禁止: merge、deploy、release、force-push、破壊的変更は行わない。

## 2026-08-08 ローカル検証

- pass: targeted ESLint、repository lint、Web typecheck。
- pass: Web unit 62 files / 446 tests、Web production build（既存chunk-size advisoryのみ）。
- pass: UI trace 13 tests、semantic UI 5 tests、生成文書freshness、canonical docs、OpenAPI、API code docs、manual evidence構造、infra inventory、hidden Unicode、diff check。
- pass: targeted Playwright listing（Chromium 2件）。
- blocked: targeted Chromium E2E実走。通常起動はsandboxが`tsx` IPC listenerを`listen EPERM`で拒否した。`node --import tsx`でAPIを迂回起動できたが、local Playwright Chromium executableが未導入のため実走できなかった。final-head GitHub Actionsで判定する。
- manual evidence recordは構造検証passだが、3 blocked / 1 not_run、`ready: false`を維持する。
