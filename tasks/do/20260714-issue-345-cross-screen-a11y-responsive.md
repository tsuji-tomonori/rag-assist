# Issue #345 全画面 WCAG 2.2 AA・responsive remediation を完了する

状態: do

タスク種別: 修正

## 背景

8 AppViews 横断の 320〜1280px、200%/400% zoom、keyboard、screen reader、touch、reduced motion、extreme content evidence がなく、inventory には missing/warning の静的指摘が残る。

## 目的・対象範囲

全 production Web screen の主要 journey を `SQ-016` に適合させ、semantic HTML、name/role/state、focus、contrast、target、reflow、orientation、motion、content extremes を修復する。

## 必要情報

- 要件: `SQ-016`, `FR-094`〜`FR-098`, `NFR-017`, `NFR-018`
- gap: `GAP-UI-007`
- automation/manual task と evidence matrix を共有する

## 原因分析（RCA）

### 問題文

2026-07-16 時点で、8 AppViews の主要 journey を `SQ-016` の viewport、input、content state、WCAG 条件へ対応付けた一つの baseline と、source / computed DOM から再現可能に defect を検出する横断 audit がない。そのため、feature 単位の実装・テストが存在しても、対象外画面や未検証品質軸を識別できず、全画面適合を根拠付きで判定できない。

### 確認済み事実

- `docs/generated/web-screens.md` は chat、assignee、history、favorites、benchmark、admin、documents、profile の8画面を列挙するが、`SQ-016` の品質軸別 pass / fail / blocked evidence matrix ではない。
- `REQ_SERVICE_QUALITY_016.md` は viewport、keyboard、screen reader、contrast、target、motion、content extremes、manual evidence を要求する。
- PR #361 は representative Chromium axe / mobile / visual と scheduled Firefox / WebKit を追加したが、全画面のtarget、focus、reflow、content extremesを監査するharnessではない。
- representative screen reader、実browser zoom、touch / real-deviceはmanual evidence taskに残っている。

### 推定・未確認

- 推定: feature taskごとに局所検証を追加したため、画面×品質軸の所有者と証跡形式が分散し、横断 gap が機械的に可視化されなかった。
- 未確認: source / computed DOM audit で検出されるdefect件数とseverity、manual環境でのみ再現するdefectはPhase A実行結果と後続manual evidenceで確定する。

### 根本原因と対策

根本原因は、canonicalなscreen inventoryを `SQ-016` の検証軸へ結合するmachine-readable contractと、未検証をpassにしないaudit / report契約が存在しないことである。Phase Aでmatrixとaudit harnessを追加し、Phase B以降は検出結果をseverity順に修復する。manual-only条件は自動passへ読み替えずblocked / pendingとして保持する。

## Phase A: matrix・automated audit harness（2026-07-16）

### 対象

- PR #361 final head `44464bdfb6e072793ffb0b16f14058217b4b1e96` をbaseにする。
- 8 AppViews × persona / journey × `AC-SQ016-001`〜`008` のevidence matrixを作る。
- source / computed DOMで再現可能なname / role / state、focus、target、reflow、overflow、motion、content-stateのaudit harnessを追加する。
- Phase Aはbaselineと検出契約に限定し、AppShell、RailNav、feature component、CSSのremediationはPhase B以降へ分離する。
- auth関連production fileはTC-003 stage 4との競合回避のため変更しない。

### Phase A Done 条件

- [x] 8 AppViewsが漏れなくmatrixへ含まれ、persona、primary journey、route、permission、quality axis、automated / manual ownership、evidence状態を追跡できる。
- [x] audit harnessがcanonical screen inventoryとのdrift、24×24未満target候補、focus / overflow / motion / state semanticsの機械検証可能範囲をdeterministicに報告する。
- [x] audit結果がpass / fail / blocked / not_applicableを区別し、manual-only条件をpassへ読み替えない。
- [x] harnessのunit testと代表Playwright auditを追加し、既存PR #361 UI quality gateと共存する。
- [x] `SQ-016`、`DES_UI_UX_001`、task、作業レポートがPhase境界とevidence ownershipを同期する。
- [x] targeted test、Web typecheck、docs check、pre-commit、`git diff --check`がpassする。
- [x] PR #361にstackしたdraft PRを作成し、日本語の受け入れ条件commentとセルフレビューcommentを残す。

### Phase A 検証状況

- `npm ci`: pass。lockfile無変更。
- targeted ESLint: 初回はhelperをESLint project範囲外の `e2e/support/` に置いたため解析failure。既存許可範囲の `apps/web/e2e/cross-screen-audit.ts` へ移動後pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm run docs:web-trace:test`: 12 tests pass。
- `npm run docs:web-inventory:check`: pass。
- `task docs:check`: 初回は新規generated fileのprovenance marker不足を検出。generatorへ登録markerを追加・再生成後、全段pass。
- `npm test -w @memorag-mvp/web`: 61 files / 442 tests pass。
- targeted Playwright `E2E-UI-CROSS-SCREEN-AUDIT-001`: local実行はsandboxが `tsx` IPCとlocalhost `0.0.0.0:8787` listenを `EPERM` で拒否したため権限昇格せず、`--list` でChromium 1 testとして解決できることを確認した。draft PR #381のWeb UI CI run `29510297571`では23,294msでpassし、artifact `8380363474` に32 entries（8画面×320/375/768/1280px）のbaselineを保存した。
- CI baselineはcomputed serious 1件（assignee 768px root overflow）、axe serious rule 5件（history/favorites/benchmark/adminのcolor contrastとbenchmarkのscrollable region focus）を検出した。matrixの該当ACをfailへ更新し、Phase B/Cのremediation対象として残した。
- candidate 64件（target-size 4件、nested overflow 60件）はWCAG例外または意図的scroll/truncationの分類前であり、blockedを維持した。
- PR #381へ受け入れ条件comment `4993651815` とセルフレビューcomment `4993652363` をGitHub Appsで記録した。
- MemoRAG CI run `29510297527` はAPI branch coverage 80.42%（目標85%）のみfailure。Phase AでAPI fileは変更しておらず、既存改善task `tasks/todo/20260712-coverage-api-c1-recovery.md` の未解決事項として記録し、PR全体をgreenとは扱わない。

## 2026-07-19 current main 収束

### 問題文と確認済み事実

- PR #361 は2026-07-18に merge commit `b7cc067c` として main へ統合済みだが、PR #381 は #361 の旧 head `44464bdf` に Phase A を積んだ状態で残っている。
- current `origin/main@fbd7e7c3` に対して PR #381 head `b6acb24f` は behind 20 / ahead 32 で、GitHub 上は merge 不可である。
- current main との差分には、mainへ統合済みの `.github/workflows/web-ui-quality.yml`、NFR-018、contrast remediation、UI quality task/reportが再表示されている。
- #381 は後続 PR #385 の base であるため、未収束のままでは #385 の差分・競合判定も古い基準を引き継ぐ。

### 根本原因と対策

根本原因は、Phase Aを未統合の #361 branchへstackした後、#361のmain統合とmain側の継続変更を #381 へ取り込んでいないことである。published historyは書き換えずcurrent mainをmergeし、競合時はcurrent mainの実装・一意な正本文書を基準にPhase A固有のmatrix / audit / traceだけを再適用する。生成文書は手編集で解消せず、generatorから再生成する。

### 受け入れ条件

- [x] `origin/main@fbd7e7c3` を published history の書き換えなしで PR #381 branchへ統合し、内容競合を解消する。
- [x] current mainとの差分から#361の既統合差分を除き、Phase Aのmatrix / audit harness / trace / task / reportに限定する。
- [x] `SQ-016`、`DES_UI_UX_001`、machine-readable matrixを一意な正本として維持し、生成文書をgeneratorと同期する。
- [ ] `git diff --check`、Web lint / typecheck / unit、matrix / UI trace、representative Chromium cross-screen E2E、docs checkが成功する。
- [ ] draft PR #381本文・受け入れ条件・セルフレビューとIssue #345を更新し、#385の再統合、既知defect、manual screen reader / real-browser 200%・400% zoom / touch・real-device、`OQ-UI-002`を未完了として残す。

### 検証結果

- merge commit `5e92f22c` で `origin/main@fbd7e7c3` を非破壊に統合した。競合は `visual-regression.spec.ts`、`DES_UI_UX_001.md`、UI automated quality taskの3件で、mainの#361確定内容を維持しつつPhase A固有のaudit / matrixだけを残した。
- current mainとの差分は18 files / 1,185 additions / 81 deletions。#361のworkflow、contrast remediation、NFR-018、automation task/reportは差分から除外された。
- `npm run docs:web-inventory`: generatorを再実行し、生成結果は追加差分なし。
- `npm run lint`: pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `TZ=UTC npm test -w @memorag-mvp/web`: 61 files / 441 tests pass。
- `npm run docs:web-trace:test`: matrix / trace 12 tests pass。
- `npm run test:web-semantic-ui`: 4 tests pass。
- canonical docs、OpenAPI、API code 98 APIs / 588 documents、Web / infra inventory、hidden Unicode、`git diff --check`: pass。
- `E2E-UI-CROSS-SCREEN-AUDIT-001`: `--list`でChromium 1 testへの解決を確認。ローカルChromium取得は配布元の0 byte応答で失敗したため、実行はlatest headのGitHub Actions判定待ちであり、本受け入れ条件は未完了のままとする。
- Phase A baselineに残るcomputed serious 1件、axe serious 5件、未分類candidate 64件、manual evidence、`OQ-UI-002`があるため、task全体の状態は`do`を維持する。

## 実行計画

1. Phase A: view/persona/journey × WCAG/viewport/input/content-state matrix とautomated audit harnessをbaseline化する。
2. Phase B: AppShell / RailNavを中心にmissing name/role/state、focus、target、reflowを修復する。
3. Phase C以降: feature batchごとにdefect ownerを一意化し、severity順に修復する。
4. automatedとmanual evidenceを結合して未達を再修復する。

## ドキュメントメンテナンス計画

`SQ-016`, `DES_UI_UX_001`、generated accessibility inventory、defect/task/evidence report を同期する。適合を自動 check だけから断定しない。

## 受け入れ条件

- [ ] relevant WCAG 2.2 A/AA 条件を主要 journey ごとに pass/NA/blocked と根拠付きで記録する。
- [ ] 320/375/768/1280px と 200%/400% zoom で content/function/focus を失わない。
- [ ] keyboard/touch/screen reader で primary journey を完了できる。
- [ ] normal/long/many/zero/loading/error/permission/partial/stale/reduced-motion を確認する。
- [ ] serious/critical defect と journey blocker を未解決のまま完了扱いしない。

## 検証計画

- component/unit、axe、Playwright responsive/visual
- contrast/target/focus computed inspection
- keyboard/screen reader/zoom/real-device manual evidence
- Web quality checks と docs/inventory freshness

## PR レビュー観点

CSS の局所 fix が別 viewport/input を壊さないか、semantic/a11y 名が利用者語彙か、permission/RAG behavior を変えていないか確認する。

## 未決事項・リスク

代表 screen reader/browser/device matrix は `OQ-UI-002` の承認まで blocked と明記し、未実施を pass にしない。
