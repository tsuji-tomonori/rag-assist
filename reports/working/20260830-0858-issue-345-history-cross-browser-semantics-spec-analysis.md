# Issue #345 履歴 cross-browser semantics spec analysis

## Input inventory

| source | type | reliability | finding |
|---|---|---|---|
| Issue #345 | authoritative issue | confirmed | 履歴のscreen reader、keyboard、state、responsive、traceabilityを優先する |
| current `main@8e542b31` | git | confirmed | 前回から不変 |
| Draft PR #462 head `bed8f493` | implementation stack | confirmed | behind 0、required Firefox／WebKit semanticはlogin/chat/profile/assignee/documents/adminまで |
| Draft PR #461 | parallel PR | confirmed | `HistoryWorkspace.tsx`を含むproduction sourceとgenerated inventoryを変更する |
| `screen-reader-semantics.spec.ts` | existing Chromium evidence | confirmed | 履歴region、検索、sort value、favorites checked、主要actionのcontractがある |
| `keyboard-navigation.spec.ts` | existing cross-browser evidence | confirmed | 履歴の検索・sort・favorites filter・会話選択がFirefox／WebKit required |
| `cross-browser-state.spec.ts` | existing cross-browser evidence | confirmed | loading／500／retry／confirmed empty／403がFirefox／WebKit required |
| SQ-016 / DES_UI_UX_001 / authored trace and matrix | canonical / authored source | confirmed | 履歴AC-SQ016-003はChromium AXのみでFirefox／WebKit semantic gapを残す |

## Report facts

- `confirmed`: 履歴のFirefox／WebKit keyboard journey、resource state、layout stressはrequiredである。
- `confirmed`: 履歴のname / role / value / checked contractはChromiumのみである。
- `confirmed`: #461はproduction ownershipを持つため、独立production修正は競合リスクが高い。
- `confirmed`: test-only route fixtureは既存E2Eでproduction pathから分離されている。
- `open_question`: representative screen reader、native Firefox／WebKit AX tree、実400% zoomのowner / matrix / cadenceは未決。

## Candidate tasks

1. **採用:** 履歴Firefox／WebKit semantic required gate。既存state／keyboard証跡をname・role・value・checkedへ接続し、production競合を避けられる。
2. お気に入りFirefox／WebKit semantic gate。履歴より先にcross-browser state gateがなく、履歴の既存required journeyとの接続を優先する。
3. benchmark Firefox／WebKit semantic gate。権限fixtureと広いcontrol setを含み、今回の小単位より大きい。
4. manual screen reader evidence。owner / environment / matrixが未決のため、安全にpass証跡を作れない。
5. 実browser 400% zoom。browser UI automationとowner-approved matrixが未整備のため今回の小単位では扱わない。

## Acceptance criteria

- normal: 取得済み履歴でregion、heading、会話一覧、検索／sort／favorites filter、主要actionが意味を保つ。
- interaction: query入力、sort変更、favorites filter切替後にvalue / checked stateが同期する。
- state: loading／error／retry／empty／permissionは既存cross-browser state gateを正とし、今回fixtureで再定義しない。
- evidence: browser project / E2E ID / evidence boundaryをartifactへ保存する。
- boundary: Playwright snapshotをrepresentative screen reader / native AX / real zoomの代替としない。

## E2E and non-UI scenarios

### E2E-UI-CROSS-BROWSER-SEMANTICS-006

1. sign inし、履歴へ移動する。
2. 履歴region、heading、会話一覧、検索／sort／favorites filter、favorite／delete／back actionを確認する。
3. queryを入力し、sortを古い順へ変更し、お気に入りfilterをcheckedへ変更する。
4. Firefox／WebKitごとのsnapshot / state JSONをartifactへ保存する。

### Non-UI trace validation

- authored traceに新E2E IDが一意に存在する。
- history / SQ-016 / AC-SQ016-003から新E2E IDへ到達できる。
- generator後のgenerated trace / inventory / matrixがfreshである。

## Operation and expectation groups

| group | operation | expectation |
|---|---|---|
| navigation | 履歴へ移動 | 名前付きregion / heading / 会話一覧が存在 |
| filtering | query／sort／favorites filterを変更 | controlのname、value、checkedが同期 |
| item actions | favorite／delete actionを確認 | 対象を識別できるaccessible nameを持つ |
| exit | チャットへ戻るactionを確認 | 名前付きbuttonとして到達可能 |
| evidence | browser別artifact保存 | project / E2E ID / boundaryを記録 |

## Requirement synthesis and gaps

- 新要件は作らず、既存`SQ-016 / AC-SQ016-003`の検証範囲をFirefox／WebKitへ拡張する。
- 画面固有contractは既存`DES_UI_UX_001.md`へ統合する。
- `representative screen reader`、`native AX tree`、`real browser 400% zoom`は`open_question / blocked`を維持する。
- #461統合後の再検証を残余riskとしてtask / PR / Issueへ記録する。
