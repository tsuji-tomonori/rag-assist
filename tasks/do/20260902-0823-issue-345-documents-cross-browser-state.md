# Issue #345 documents cross-browser state required gate

- 保存先: `tasks/do/20260902-0823-issue-345-documents-cross-browser-state.md`
- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #462
- 作成日時: 2026-09-02 08:23 JST

## 背景

Draft PR #462 head `edd62fe6` は current `main@8e542b31` を祖先に含み、behind 0である。文書画面は required Chromium `E2E-UI-STATE-001` で catalog／reindex の loading、部分500、retry、confirmed empty、全resource 403を区別している。一方、Firefox／WebKit required state gate は履歴画面だけであり、操作密度が最大の文書画面ではbrowser engine差によるfalse zero、retry操作欠落、private detail露出を検出できない。

並行Draft PR #461は`DocumentWorkspace.tsx`と文書UI部品を変更するため、今回sliceはproduction sourceを避け、既存DOM契約のrequired E2Eと正本／生成文書だけを更新する。

## 目的

文書画面の代表resource状態をFirefox／WebKit required gateへ追加し、`documents → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-002`を一意に追跡可能にする。

## 対象範囲

### 対象

- `apps/web/e2e/cross-browser-state.spec.ts`／README
- `REQ_SERVICE_QUALITY_016.md`／`DES_UI_UX_001.md`
- `tools/web-inventory/ui-traceability.json`／`ui-quality-matrix.json`
- repository generatorが更新する`docs/generated/`
- task／spec analysis／working report

### 対象外

- production component／CSS／API／authorization／RAG contract
- 文書upload／share／move／delete／reindex mutationの実AWS E2E
- representative screen reader、Firefox／WebKit native AX tree
- 実browser 200%／400% zoom、text-only zoom、OS scaling
- touch／実機、manual keyboard／contrast
- #461統合後の最終DOM再検証
- FR-051、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 方針

- test fixtureはPlaywright routeだけに閉じ、production挙動を変更しない。
- loading／partial／retrying／recovered／confirmed emptyとpermissionをrole、state、safe text、false-zero suppressionで検証する。
- browser project名とevidence boundaryをJSON artifactへ記録し、representative screen readerやnative AX treeの証跡へ読み替えない。
- 正本は既存`SQ-016`と`DES_UI_UX_001`へ集約し、並行要件文書を作らない。

## 必要情報

- `confirmed`: current `main@8e542b31`、#462 head `edd62fe6`、behind 0。
- `confirmed`: documentsのChromium state契約は`visual-regression.spec.ts`でrequired検証済み。
- `confirmed`: Firefox／WebKit state scopeはhistoryの`E2E-UI-CROSS-BROWSER-STATE-001`だけである。
- `confirmed`: #461は文書production componentを変更するが、今回更新する`cross-browser-state.spec.ts`を所有しない。
- `open_question`: representative screen reader／OS／browser／device matrixとownerは`OQ-UI-002`未決。

## 実行計画

1. 文書resourceのPlaywright route fixtureをcross-browser state specへ追加する。
2. loading→partial 500→retrying→recovered→confirmed emptyと全resource 403をFirefox／WebKitで検証する。
3. browser project名、新E2E ID、state sequence、false-zero／private-detail境界をartifactへ記録する。
4. SQ-016、UI正本、trace、quality matrixを新E2E IDとrequired件数へ同期する。
5. generatorでgenerated Web docsを更新する。
6. 最小十分なlint／typecheck／unit／build／E2E discovery／docs checksとfinal-head CIを実行する。
7. PR受け入れ確認、セルフレビュー、Issue #345進捗を記録する。

## ドキュメントメンテナンス計画

- 要件の正本は既存`REQ_SERVICE_QUALITY_016.md`へ証跡を追加する。
- 画面固有契約は既存`DES_UI_UX_001.md`へ追加する。
- `tools/web-inventory/*.json`をauthored sourceとし、`docs/generated/`はgeneratorで更新する。
- READMEはFirefox／WebKit required state対象をhistory＋documentsへ更新する。
- API／OpenAPI／運用／deploy文書はproduction契約を変更しないため対象外とする。

## 受け入れ条件

- [x] `E2E-UI-CROSS-BROWSER-STATE-002`がFirefox／WebKitで文書resourceのloading中に`aria-busy=true`と文脈付きloadingを検証し、未確認catalog／zero／emptyを表示しない。
- [x] 文書APIの部分500で安全なpartial state、取得済み／未更新の区別、private detail非表示を検証する。
- [x] retrying後にrecovered status、confirmed empty、0件表示、resource再取得回数を検証する。
- [x] 全resource HTTP 403をpermission alertとして表示し、private detail／catalog／zero／emptyを隠す。
- [x] browser project名、state sequence、新E2E ID、evidence boundaryをartifactへ記録する。
- [x] `documents → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-002`が正本、authored trace／matrix、生成文書で一致する。
- [x] required Firefox／WebKit scopeの内訳と合計件数が実test discoveryと一致する。
- [x] production component／CSS／API／authorization／RAG contractを変更しない。
- [x] manual／overall statusは`blocked`を維持し、実AWS操作やmanual証跡をpass扱いしない。
- [x] 選定したlint、typecheck、unit、build、E2E discovery、docs／freshness checks、`git diff --check`が成功する。
- [x] Draft PR #462、PR受け入れコメント、セルフレビュー、Issue #345進捗が更新される。

## 検証計画

- targeted ESLint／E2E TypeScript
- Web typecheck／unit／build
- targeted Firefox／WebKit discoveryとrequired全件discovery
- trace／semantic UI／generated freshness／canonical docs／hidden Unicode
- authored JSON parse／Taskfile alias／`git diff --check`
- final-head Web UI Quality／MemoRAG CI／semver

local Playwright実走がAPI server／browser availabilityで実行不能な場合は理由を記録し、GitHub Actions required Firefox／WebKitを実走証跡として区別する。

## PRレビュー観点

- test fixtureがPlaywright routeだけに閉じ、private detailやfalse zeroの期待値を緩めていないか。
- partialの成功partと失敗part、retry対象がproduction契約に一致するか。
- 実AWS、representative screen reader、native AX treeをautomationで完了扱いしていないか。
- #461のproduction ownershipを侵食していないか。
- authored sourceとgenerated docsがgeneratorで同期しているか。

## 未決事項・リスク

- Firefox／WebKitでrequest順序やARIA state更新timingの差が検出される可能性がある。
- #461統合後は最終production DOMとgenerated inventoryに対して再検証が必要である。
- 本sliceがpassしても累積Draft PR #462全体はmerge-readyではない。
