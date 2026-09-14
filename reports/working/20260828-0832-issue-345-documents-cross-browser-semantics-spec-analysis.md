# Issue #345 documents cross-browser semantics spec analysis

## Input inventory

| source | type | reliability | finding |
|---|---|---|---|
| Issue #345 | authoritative issue | confirmed | documentsは132操作要素を持つ高密度画面。screen reader、keyboard、responsive、traceabilityを優先する |
| current `main@8e542b31` | git | confirmed | 前回から不変 |
| Draft PR #462 head `b06bff82` | implementation stack | confirmed | behind 0、required Firefox／WebKit semanticはlogin/chat/profile/assigneeまで |
| Draft PR #461 | parallel PR | confirmed | documents production sourceとgenerated inventoryを変更する |
| `screen-reader-semantics.spec.ts` | existing Chromium evidence | confirmed | workspace、breadcrumb、folder tree、filters、table、dialog、selected row、disclosure contractがある |
| `keyboard-navigation.spec.ts` | existing cross-browser evidence | confirmed | documents検索、filter、dialog focus journeyがFirefox／WebKit required |
| SQ-016 / DES_UI_UX_001 / authored trace and matrix | canonical / authored source | confirmed | documents AC-SQ016-003はChromium AXのみでFirefox／WebKit semantic gapを残す |

## Report facts

- `confirmed`: documentsのFirefox／WebKit keyboard journey、reflow、layout stressはrequiredである。
- `confirmed`: documentsのname / role / value / selected / expanded contractはChromiumのみである。
- `confirmed`: #461はproduction ownershipを持つため、独立production修正は競合リスクが高い。
- `confirmed`: test-only route fixtureは既存E2Eでproduction pathから分離されている。
- `open_question`: representative screen reader、native Firefox／WebKit AX tree、実400% zoomのowner / matrix / cadenceは未決。

## Candidate tasks

1. **採用:** documents Firefox／WebKit semantic required gate。高密度画面の既存contractをcross-browser化し、production競合を避けられる。
2. admin Firefox／WebKit semantic required gate。価値はあるがdocumentsの操作密度とdialog／table contractを優先する。
3. manual screen reader evidence。owner / environment / matrixが未決のため、安全にpass証跡を作れない。
4. 実browser 400% zoom。browser UI automationとowner-approved matrixが未整備のため今回の小単位では扱わない。

## Acceptance criteria

- normal: 許可されたdocuments画面でworkspace、breadcrumb、folder tree、検索、filter、table、detail dialogが意味を保つ。
- interaction: 文書選択後にrow selectedが真となり、detail dialogが名前付きで開く。
- state: technical disclosureがcollapsedからexpandedへ変化し、同じbrowser実走で観測できる。
- evidence: browser project / E2E ID / evidence boundaryをartifactへ保存する。
- permission: 今回は既存permission state gateを再実装せず、production authorizationを変更しない。
- boundary: Playwright snapshotをrepresentative screen reader / native AX / real zoomの代替としない。

## E2E and non-UI scenarios

### E2E-UI-CROSS-BROWSER-SEMANTICS-004

1. 権限を持つ利用者としてsign inする。
2. documentsへ移動する。
3. workspace / breadcrumb / folder tree / search / filter value / tableのARIA contractを確認する。
4. fixture文書のdetail actionを実行する。
5. selected rowと名前付きdialog、close／question action、technical disclosure collapsedを確認する。
6. technical disclosureを展開し、expanded stateを確認する。
7. Firefox／WebKitごとのsnapshot / state JSONをartifactへ保存する。

### Non-UI trace validation

- authored traceに新E2E IDが一意に存在する。
- documents / SQ-016 / AC-SQ016-003から新E2E IDへ到達できる。
- generator後のgenerated trace / inventory / matrixがfreshである。

## Operation and expectation groups

| group | operation | expectation |
|---|---|---|
| navigation | documentsへ移動 | 名前付きworkspace / breadcrumbが存在 |
| discovery | folder／filename検索、filter確認 | searchbox / comboboxのnameとvalueが安定 |
| inventory | 文書一覧確認 | 名前付きtableとdetail actionが存在 |
| detail | 文書detailを開く | row selectedと名前付きdialogが同期 |
| disclosure | technical detailを展開 | `aria-expanded`がfalseからtrueへ遷移 |
| evidence | browser別artifact保存 | project / E2E ID / boundaryを記録 |

## Requirement synthesis and gaps

- 新要件は作らず、既存`SQ-016 / AC-SQ016-003`の検証範囲をFirefox／WebKitへ拡張する。
- 画面固有contractは既存`DES_UI_UX_001.md`へ統合する。
- `representative screen reader`、`native AX tree`、`real browser 400% zoom`は`open_question / blocked`を維持する。
- #461統合後の再検証を残余riskとしてtask / PR / Issueへ記録する。
