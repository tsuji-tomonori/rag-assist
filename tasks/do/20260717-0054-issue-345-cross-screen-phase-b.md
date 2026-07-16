# Issue #345 Phase B: AppShell・横断a11y/responsive defectを修復する

状態: do

タスク種別: 修正

## 背景

Phase A PR #381は8 AppViews × 4 viewportのcomputed DOM / axe baselineを作成し、assignee 768pxのroot overflow、history / favorites / benchmark / adminのcontrast、benchmark tableのkeyboard focusabilityをfailとして確定した。target-size 4件とnested overflow 60件はWCAG例外や意図的scroll/truncationを含み得るため、未分類のままblockedとしている。

## 目的・対象範囲

- PR #381 final head `b6acb24ff81acd08981ada8ebb3df63810f6d57b` をbaseに、AppShell / RailNavとPhase A確定failを修復する。
- primary navigationのtarget、focus visible/recovery、responsive reflowを維持・強化する。
- target-size / nested overflow candidateを要素単位に再収集し、意図、owner、代替操作、WCAG例外根拠を記録したうえで修正またはblockedに分類する。
- Login / auth production fileはPR #382との競合回避のため変更しない。
- screen reader、実browser zoom、touch / real-deviceは未検証のままmanual evidence taskへ残す。

## 原因分析（RCA）

### 問題文

Phase A CI baselineで、assigneeは768px viewportに対してroot scrollWidth 810pxとなり横方向へreflowせず、4画面のsmall textはaxe color-contrast serious、benchmarkの横scroll tableはkeyboard focus不能と判定された。加えて64件のcandidateは合否根拠とownerが未確定である。

### 確認済み事実

- `.assignee-kanban` は4列それぞれ`minmax(190px, 1fr)`と10px gapを要求し、1列へ落とすruleは`max-width: 720px`にしかない。768pxでは4列minimumがcontainerを超える。
- muted small textは`#68758f`を白または淡色背景で使用し、history / favoritesの`p`、benchmark mode label、admin performance action labelでaxe seriousを再現した。
- `.benchmark-table-wrap` は`overflow: auto`だがfocusable elementではなく、keyboard利用者が横scroll領域へ到達できない。
- RailNavはdesktop / mobileを分け、mobile menuのopen時focus移動、Escape close、triggerへのfocus recoveryをすでに実装している。
- Phase Aのcandidate collectorはWCAG 2.5.8例外や意図的scroll/truncationを自動判定しない。

### 推定・未確認

- target-size 4件の要素identityと、nested overflow 60件のうち意図的scroll、single-line truncation、実害のあるcontent clippingの内訳はPhase A artifact再解析で確定する。
- contrast failは共通muted tokenの値と一部hard-coded値がsmall textの4.5:1を満たす契約を持たないことが流出原因と推定する。変更前後のcomputed/axe結果で検証する。

### 根本原因と対策

- 発生原因: responsive breakpointとminimum column幅がviewport contractに結合されていない。assigneeの列数をavailable widthに合わせ、root horizontal overflowを禁止する。
- 発生原因: muted foreground token / hard-coded色にsmall-text contrast下限がない。AAを満たすtokenへ集約し、semantic UI contract testで再発を防ぐ。
- 発生原因: scroll containerがmouse/touch依存でkeyboard entry pointを持たない。説明付きfocusable regionとして実装し、focus visibleとscroll代替をE2Eで確認する。
- 流出原因: candidate reportがelement identity / intended behavior / owner / alternative operationをdurable evidenceへ結合していない。Phase B evidenceをmatrixとartifactへ記録し、未分類をpassへ昇格しない。

## 実行計画

1. PR #381 artifactを要素単位に集計し、target / overflow candidateを分類する。
2. AppShell / RailNav、assignee reflow、muted contrast、benchmark scroll focusabilityを最小のproduction変更で修復する。
3. component / semantic contract / Playwright auditを更新し、既知defectが再発する場合にfailureとなるassertionを追加する。
4. matrix、`SQ-016` / `DES_UI_UX_001`、generated inventory、task、作業レポートを同期する。
5. targeted check、Web test/typecheck/build、docs check、pre-commit、draft PR CIを確認する。

## ドキュメントメンテナンス計画

- `SQ-016`の要求値は変更せず、Phase Bのautomated evidenceと残余manual scopeを追記する。
- `DES_UI_UX_001`へbreakpoint、target、keyboard-scroll、candidate分類の実装判断を記録する。
- generated quality matrixはsource JSONから再生成し、実装と証跡を同期する。
- README、API、OpenAPI、運用手順は契約変更がないため原則非該当とし、差分後に再確認する。

## 受け入れ条件

- [ ] assigneeが320/375/768/1280pxでroot horizontal overflowを発生させず、content/functionを失わない。
- [ ] history / favorites / benchmark / adminのPhase A color-contrast seriousが0件になる。
- [ ] benchmark tableのhorizontal scroll領域へkeyboardでfocusでき、focus indicatorと利用目的のaccessible nameがある。
- [ ] RailNav / AppShellのprimary controlsが24×24 minimumを満たし、primary targetは44〜48px classを維持する。例外は要素、意図、代替操作、ownerを証跡化する。
- [ ] target-size / nested overflow candidateを機械的にpassへ変えず、修正済みまたは根拠付きblockedへ分類する。
- [ ] Login / auth production file、API、permission、RAG behavior、benchmark dataset固有分岐を変更しない。
- [ ] unit / semantic contract / Playwright audit、Web typecheck/test/build、docs check、pre-commit、`git diff --check`がpassする。
- [ ] PR #381へstackした日本語draft PR、受け入れ条件comment、セルフレビューcommentを作成し、final-head CIを確認する。

## 検証計画

- Phase A artifact JSONのcandidate / serious要素集計
- RailNav / affected workspace component test
- semantic UI contrast contract test
- `E2E-UI-CROSS-SCREEN-AUDIT-001` + Phase B regression assertion
- `npm run typecheck -w @memorag-mvp/web`
- `npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `task docs:check`
- changed files pre-commit / `git diff --check`

## PRレビュー観点

- breakpoint fixが320/375/1280px、keyboard focus、content orderを壊さないか。
- contrast token変更が状態意味やvisual hierarchyを色だけへ依存させないか。
- scroll focusabilityが余計なtab stopや二重操作を作らず、mouse/touchも維持するか。
- candidate例外を便宜的にpassへ昇格していないか。
- docsと実装、matrixとartifact、test assertionが同じ判定を示すか。

## 未決事項・リスク

- screen reader、200%/400% zoom、touch / real-deviceはmanual evidence taskの未完了scopeであり、自動検証だけから適合を宣言しない。
- PR #382がLogin/authを変更するため、競合回避だけでなくauthorization境界を弱めないことをdiffで確認する。
- Phase Aで既知のMemoRAG CI API branch coverage failureは本PhaseのAPI変更では解消しない。Web scopeの結果と分離して報告する。
