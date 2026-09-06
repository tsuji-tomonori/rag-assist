# Issue #345 性能テスト cross-browser state 必須証跡

- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #470
- 作成日時: 2026-09-07 08:13 JST

## 背景

Draft PR #470 head `4663f24f` は current `main@8e542b31` を祖先に含み、behind 0である。性能テスト画面は Chromium required `E2E-UI-STATE-001` で loading、実行履歴取得500によるpartial、retry、confirmed empty、全resource 403を検証済みである。一方、Firefox／WebKit required gateはbenchmarkのsemantic contractまでで、同じresource state契約を検証していない。

並行PR #341〜#344はmerge済みであり、Draft PR #461はshared UI primitiveと`BenchmarkWorkspace.tsx`を変更する。今回sliceはproduction sourceを避け、既存DOM契約のrequired E2Eと正本／生成文書だけを更新する。

## 目的

性能テストの未確認dataをempty／zeroへ変換しない状態契約をFirefox／WebKit required gateへ追加し、`benchmark → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-007`を一意に追跡可能にする。

## スコープ

### 対象

- `apps/web/e2e/cross-browser-state.spec.ts`／README
- `REQ_SERVICE_QUALITY_016.md`／`REQ_NON_FUNCTIONAL_018.md`／`DES_UI_UX_001.md`
- `tools/web-inventory/ui-traceability.json`／`ui-quality-matrix.json`
- repository generatorが更新する`docs/generated/`
- task／spec analysis／working report

### 対象外

- production component／CSS／API／authorization／RAG／benchmark dataset contract
- benchmark start／cancel／downloadの実AWS E2E
- representative screen reader、Firefox／WebKit native AX tree
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- touch／実機、manual keyboard／contrast
- #461統合後の最終DOM再検証
- FR-050／FR-051、TC-003、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 入力と確定事項

- `confirmed`: current `main@8e542b31`、#470 head `4663f24f`、behind 0。
- `confirmed`: Chromium `E2E-UI-STATE-001` はbenchmarkのloading／partial／retry／confirmed empty／permissionを検証する。
- `confirmed`: Firefox／WebKit required scopeはbenchmarkのstateを含まず、cross-browser state IDは`006`までである。
- `confirmed`: #461はDraftで`BenchmarkWorkspace.tsx`を変更するが、今回更新するE2E sourceを変更しない。
- `open_question`: representative screen reader／OS／browser／device matrixとownerは`OQ-UI-002`未決。

## 実施計画

1. benchmark run／suite fixtureをPlaywright routeに限定して追加する。
2. loading→run取得500 partial→retrying→confirmed empty recoveryと、全resource 403 permissionをFirefox／WebKitで検証する。
3. false zero、未確認history region／control、private detailの非表示とresource read countを固定する。
4. browser project名、状態系列、test-only fixture境界をartifactへ記録する。
5. SQ-016、NFR-018、UI正本、trace、quality matrixを新E2E IDとrequired件数へ同期する。
6. generatorでgenerated Web docsを更新し、最小十分な検証とfinal-head CIを実行する。
7. PR受け入れ確認、セルフレビュー、Issue #345進捗を記録する。

## ドキュメント保守計画

- 要件の正本は既存`SQ-016`へ集約し、並行要件文書を作らない。
- 画面固有契約は既存`DES_UI_UX_001.md`へ追加する。
- `tools/web-inventory/*.json`をauthored sourceとし、`docs/generated/`はgeneratorで更新する。
- Playwright route fixtureを実API／認可／支援技術／実zoomのpassへ読み替えない。

## 受け入れ条件

- [x] `E2E-UI-CROSS-BROWSER-STATE-007`がFirefox／WebKitで性能テストのloading→実行履歴500 partial→retrying→confirmed empty recoveryを検証する。
- [x] partial中は取得済みテスト定義を保持し、未確認の実行履歴件数／history regionを表示せず、private detailを隠す。
- [x] retry後だけrecovered status、`0 件の実行履歴`、明示的empty stateを表示し、run／suite read countを2回に固定する。
- [x] 全resource HTTP 403をpermissionとして表示し、empty／zero、test definition、history region、private detailを公開しない。
- [x] browser project名、状態系列、read count、test-only fixture境界をartifactへ記録する。
- [x] `benchmark → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-007`が正本、authored trace／matrix、生成文書で一致する。
- [x] required Firefox／WebKit scopeの内訳が56件から60件へ更新される。
- [x] production component／CSS／API／authorization／RAG／dataset contractを変更しない。
- [x] manual／overall statusは`blocked`を維持し、実AWS benchmarkやmanual証跡をpass扱いしない。
- [x] 選定したlint、typecheck、unit、build、E2E discovery、docs／freshness checks、`git diff --check`が成功するか、実行不能理由を未完了として記録する。
- [ ] Draft PR #470、PR受け入れコメント、セルフレビュー、Issue #345進捗を更新する。

## 検証結果

- PASS: targeted ESLint、Web typecheck、Web unit 473件、Web build。
- PASS: required Firefox／WebKit 60件のdiscovery（新規IDは2 browser×2 scenario）。
- PASS: trace 13件、semantic UI 5件、generated freshness、canonical docs、hidden Unicode、authored JSON parse、Taskfile alias、`git diff --check`。
- BLOCKED: ローカル実行は`tsx` IPCの`EPERM`を回避して4件を起動したが、Firefoxの`browserContext.newPage`が60秒でtimeoutした。assertion実行前のbrowser context起動失敗であり、pass扱いしない。最終判定はGitHub ActionsのFirefox／WebKit required gateで行う。

## 未完了

- final-head GitHub ActionsとPR／Issue証跡の確定。
- representative screen reader／native AX tree、実ブラウザ200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrast。
- 実API／AWS認可、benchmark start／cancel／download、#461統合後の再検証。
- FR-050／FR-051、TC-003、OQ-UI-002、API C1 85%のowner判断または解消。

## 検証計画

- targeted ESLint／E2E TypeScript
- Web typecheck／unit／build
- targeted Firefox／WebKit discoveryとrequired全60件discovery
- trace／semantic UI／generated freshness／canonical docs／hidden Unicode
- authored JSON parse／Taskfile alias／`git diff --check`
- final-head Web UI Quality／MemoRAG CI／semver

## PRレビュー観点

- partialが成功したsuiteと失敗したrunを区別し、runを0件と見せていないか。
- permissionでprotected content／control／raw response detailを表示していないか。
- fixtureがPlaywright routeだけに閉じ、production behaviorを変更していないか。
- automated passをmanual／overall passへ昇格していないか。
- #461のproduction ownershipを侵食していないか。

## リスク

- required UI gateが2 scenario×2 browser増え、実行時間が増える。
- route gateの解放漏れはtest hangを起こすため、loading／retrying assertion後に解放する。
- #461統合後は最終production DOMへの再検証が必要である。
- 本sliceがpassしても累積Draft PR #470全体はmerge-readyではない。
