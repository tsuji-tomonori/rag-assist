# Issue #345 お気に入り cross-browser semantic required gate

- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #462
- 作成日時: 2026-08-31 08:10 JST

## 背景

Draft PR #462 head `750ed0a5` は current `main@8e542b31` を祖先に含み、behind 0である。お気に入り画面は320px content stress、Chromium／Firefox／WebKit keyboard journey、Chromium AX tree、loading／error／permission／retryのrequired証跡を持つ。一方、region／heading／target type group／主要actionのname・roleをFirefox／WebKitで検証するsemantic gateがない。

並行Draft PR #461はshared UI primitiveと`FavoritesWorkspace.tsx`のIcon importを変更するため、今回sliceはproduction sourceを避け、既存DOM契約のrequired E2Eと正本／生成文書だけを更新する。

## 目的

お気に入り一覧を認識して会話・文書項目へ到達する支援技術向け契約をFirefox／WebKit required gateへ追加し、`favorites → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-007`を一意に追跡可能にする。

## スコープ

### 対象

- `apps/web/e2e/cross-browser-semantics.spec.ts`／README
- `REQ_SERVICE_QUALITY_016.md`／`DES_UI_UX_001.md`
- `tools/web-inventory/ui-traceability.json`／`ui-quality-matrix.json`
- repository generatorが更新する`docs/generated/`
- task／spec analysis／working report

### 対象外

- production component／CSS／API／authorization／RAG contract
- favorite resume／delete機能の実装
- representative screen reader、Firefox／WebKit native AX tree
- ブラウザUIを操作する実200%／400% zoom、text-only zoom、OS scaling
- touch／実機、manual keyboard／contrast
- #461統合後の最終DOM再検証
- FR-051、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 入力と確定事項

- `confirmed`: current `main@8e542b31`、#462 head `750ed0a5`、behind 0。
- `confirmed`: お気に入りはChromium AXとChromium／Firefox／WebKit keyboard、state、content stressのrequired証跡を持つ。
- `confirmed`: Firefox／WebKit semantic scopeはlogin／chat／profile／assignee／documents／admin／historyまでで、お気に入りを含まない。
- `confirmed`: #461はDraftで、今回更新するE2E sourceを変更しない。
- `open_question`: representative screen reader／OS／browser／device matrixとownerは`OQ-UI-002`未決。

## 実施計画

1. favorites fixtureをPlaywright routeに限定して追加する。
2. workspace／heading／項目一覧／会話・文書group、項目label／target ID／アクセス不可cue、back actionをFirefox／WebKitで検証する。
3. 現行UIに存在しないfavorite resume／delete actionを捏造せず、表示項目とback actionの状態をbrowser別artifactへ記録する。
4. SQ-016、UI正本、trace、quality matrixを新E2E IDとrequired件数へ同期する。
5. generatorでgenerated Web docsを更新する。
6. 最小十分なlint／typecheck／unit／build／E2E discovery／docs checksとfinal-head CIを実行する。
7. PR受け入れ確認、セルフレビュー、Issue #345進捗を記録する。

## ドキュメント保守計画

- 要件の正本は既存`SQ-016`へ集約し、並行要件文書を作らない。
- 画面固有契約は既存`DES_UI_UX_001.md`へ追加する。
- `tools/web-inventory/*.json`をauthored sourceとし、`docs/generated/`はgeneratorで更新する。
- Playwright ARIA snapshot／DOM stateをrepresentative screen readerやnative AX treeのpassへ読み替えない。

## 受け入れ条件

- [x] `E2E-UI-CROSS-BROWSER-SEMANTICS-007`がFirefox／WebKitでお気に入りregion／heading／項目一覧／会話・文書groupを検証する。
- [x] 会話・文書項目のlabel／target ID／アクセス不可cueとチャット復帰actionのname／roleを検証する。
- [x] browser project名、新E2E ID、Playwright ARIA snapshot／DOM stateの証跡境界をartifactへ記録する。
- [x] `favorites → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-007`が正本、authored trace／matrix、生成文書で一致する。
- [x] required Firefox／WebKit scopeの内訳がsemantic 14件／合計30件へ更新される。
- [x] production component／CSS／API／authorization／RAG contractを変更しない。
- [x] manual／overall statusは`blocked`を維持し、未実装のfavorite resume／deleteやmanual証跡をpass扱いしない。
- [x] 選定したlint、typecheck、unit、build、E2E discovery、docs／freshness checks、`git diff --check`が成功する。
- [ ] Draft PR #462、PR受け入れコメント、セルフレビュー、Issue #345進捗が更新される。

## 検証計画

- targeted ESLint／E2E TypeScript
- Web typecheck／unit／build
- targeted Firefox／WebKit discoveryとrequired全30件discovery
- trace／semantic UI／generated freshness／canonical docs／hidden Unicode
- authored JSON parse／Taskfile alias／`git diff --check`
- final-head Web UI Quality／MemoRAG CI／semver

local Playwright実走がAPI server／browser availabilityで実行不能な場合は理由を記録し、GitHub Actions required Firefox／WebKitを実走証跡として区別する。

## PRレビュー観点

- test fixtureがPlaywright routeだけに閉じているか。
- role／nameと主要actionに限定し、装飾文言を過剰固定していないか。
- favorite resume／delete未実装をsemantic証跡で完了扱いしていないか。
- #461のproduction ownershipを侵食していないか。
- authored sourceとgenerated docsがgeneratorで同期しているか。

## リスク

- Firefox／WebKitのARIA snapshot差がChromium AX baselineでは見えない差を検出する可能性がある。
- #461統合後は最終production DOMへの再検証が必要である。
- 本sliceがpassしても累積Draft PR #462全体はmerge-readyではない。
