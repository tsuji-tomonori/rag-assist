# Issue #345 admin cross-browser semantics spec analysis

## Input inventory

| source | type | reliability | finding |
|---|---|---|---|
| Issue #345 | authoritative issue | confirmed | adminは権限状態、screen reader、keyboard、responsive、traceabilityを優先する |
| current `main@8e542b31` | git | confirmed | 前回から不変 |
| Draft PR #462 head `5f13cbc3` | implementation stack | confirmed | behind 0、required Firefox／WebKit semanticはlogin/chat/profile/assignee/documentsまで |
| Draft PR #461 | parallel PR | confirmed | production sourceとgenerated inventoryを変更する |
| `screen-reader-semantics.spec.ts` | existing Chromium evidence | confirmed | admin overview、active section、user filters、create form、table contractがある |
| `keyboard-navigation.spec.ts` | existing cross-browser evidence | confirmed | adminのsection移動と主要control journeyがFirefox／WebKit required |
| SQ-016 / DES_UI_UX_001 / authored trace and matrix | canonical / authored source | confirmed | admin AC-SQ016-003はChromium AXのみでFirefox／WebKit semantic gapを残す |

## Report facts

- `confirmed`: adminのFirefox／WebKit keyboard journey、reflow、layout stressはrequiredである。
- `confirmed`: adminのname / role / value / current / live status contractはChromiumのみである。
- `confirmed`: #461はproduction ownershipを持つため、独立production修正は競合リスクが高い。
- `confirmed`: test-only route fixtureは既存E2Eでproduction pathから分離されている。
- `open_question`: representative screen reader、native Firefox／WebKit AX tree、実400% zoomのowner / matrix / cadenceは未決。

## Candidate tasks

1. **採用:** admin Firefox／WebKit semantic required gate。権限依存画面の既存contractをcross-browser化し、production競合を避けられる。
2. admin loading / permission / retry cross-browser state gate。既存state gateとの重複確認とfixture拡張が大きいため、semantic gapを先に閉じる。
3. manual screen reader evidence。owner / environment / matrixが未決のため、安全にpass証跡を作れない。
4. 実browser 400% zoom。browser UI automationとowner-approved matrixが未整備のため今回の小単位では扱わない。

## Acceptance criteria

- normal: 許可されたadmin画面でworkspace、section navigation、overview、ユーザー管理が意味を保つ。
- interaction: section navigationでユーザーへ移動すると`aria-current`がoverviewからユーザーへ移る。
- state: ユーザー一覧の取得statusはpolite live regionで、filter／sort／roleのcurrent valueを観測できる。
- evidence: browser project / E2E ID / evidence boundaryをartifactへ保存する。
- permission: 今回は既存permission state gateを再実装せず、production authorizationを変更しない。
- boundary: Playwright snapshotをrepresentative screen reader / native AX / real zoomの代替としない。

## E2E and non-UI scenarios

### E2E-UI-CROSS-BROWSER-SEMANTICS-005

1. 管理権限を持つ利用者としてsign inする。
2. adminへ移動する。
3. workspace / heading / section navigationとoverviewのcurrent stateを確認する。
4. section navigationからユーザー管理へ移動する。
5. users current state、名前付きregion／search／create form／table、filter／sort／role value、取得statusを確認する。
6. Firefox／WebKitごとのsnapshot / state JSONをartifactへ保存する。

### Non-UI trace validation

- authored traceに新E2E IDが一意に存在する。
- admin / SQ-016 / AC-SQ016-003から新E2E IDへ到達できる。
- generator後のgenerated trace / inventory / matrixがfreshである。

## Operation and expectation groups

| group | operation | expectation |
|---|---|---|
| navigation | adminへ移動 | 名前付きworkspace / section navigationが存在 |
| section state | overviewを確認しユーザーへ移動 | `aria-current=page`が選択sectionと同期 |
| filtering | query／status／sortを確認 | textbox / comboboxのnameとvalueが安定 |
| creation | user create formを確認 | email / display name / initial roleが名前付きcontrolとして存在 |
| inventory | user listを確認 | 名前付きtableと取得statusが存在 |
| evidence | browser別artifact保存 | project / E2E ID / boundaryを記録 |

## Requirement synthesis and gaps

- 新要件は作らず、既存`SQ-016 / AC-SQ016-003`の検証範囲をFirefox／WebKitへ拡張する。
- 画面固有contractは既存`DES_UI_UX_001.md`へ統合する。
- `representative screen reader`、`native AX tree`、`real browser 400% zoom`は`open_question / blocked`を維持する。
- #461統合後の再検証を残余riskとしてtask / PR / Issueへ記録する。
