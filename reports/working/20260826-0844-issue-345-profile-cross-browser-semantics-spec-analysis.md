# Issue #345 個人設定 cross-browser semantics 仕様分析

## Input inventory

| source | type | reliability | finding |
| --- | --- | --- | --- |
| Issue #345 / Draft PR #462 | issue / implementation stack | confirmed | profile contrast完了後も代表screen reader・native AX・実browser zoomは未完了 |
| current `main@8e542b31` | base | confirmed | 前回から変更なし |
| PR #341〜#344 / #461 | parallel work | confirmed | #341〜#344はclosed、#461はshared production UIを所有 |
| `REQ_SERVICE_QUALITY_016.md` | canonical requirement | confirmed | Firefox／WebKit semantic required scopeはlogin / chat限定 |
| `DES_UI_UX_001.md` | canonical design | confirmed | profileはChromium AX、3-browser keyboard、contrast証跡を持つ |
| authored trace / quality matrix | machine-readable source | confirmed | profile AC-SQ016-003はChromium AXだけをscreen固有証跡として記載 |
| profile component / E2E | implementation / verification | confirmed | label/valueとvisible polite statusはproduction実装済み |

## Facts and boundary

- confirmed: production変更なしでFirefox／WebKitのprofile semantic回帰検出を追加できる。
- confirmed: statusは変更後だけ出現し、visible text、`role=status`、`aria-live=polite`を持つ。
- confirmed: Playwright ARIA snapshotはnative browser AX treeや代表screen readerの実測ではない。
- open question: representative screen reader、実browser zoom、実機、FR-051 owner判断。

## Candidate selection

1. 採用: profileのrequired cross-browser semantic contractを1件追加する。
2. 非採用: 残り全画面を一括追加する。小さな1件という範囲を超え、fixture・競合面が広い。
3. 非採用: FR-051永続化を実装する。owner判断とAPI/store contractが未確定。
4. 非採用: 自動ARIA snapshotをmanual screen reader合格へ読み替える。証跡境界に反する。

## Acceptance criteria and E2E

### E2E-UI-CROSS-BROWSER-SEMANTICS-002

1. Firefox／WebKitで認証し、個人設定へ到達する。
2. profile regionのheading、送信キーcombobox name/value、戻る・sign out buttonをARIA snapshotで確認する。
3. 送信キーをCtrl+Enterへ変更し、combobox value、visible status text、status role、polite live propertyを確認する。
4. project名、E2E ID、snapshot、state、native AX／代表screen readerではない境界をartifactへ記録する。

## Traceability gap

| view | requirement | acceptance | current evidence | gap | planned evidence |
| --- | --- | --- | --- | --- | --- |
| profile | SQ-016 | AC-SQ016-003 | Chromium `E2E-UI-SR-SEMANTICS-001` | Firefox／WebKit screen固有semantic contractなし | `E2E-UI-CROSS-BROWSER-SEMANTICS-002` |
| profile | SQ-016 | AC-SQ016-007 | session-only限定state | persistence / failure / permission未決 | 本taskではblocked維持 |

## Review judgment

- 判定: 着手前は部分不合格。Major gapはprofileのrequired cross-browser semantic証跡欠落。
- 実装可否: production挙動を変更せず安全に検査追加可能。
- Issue全体完了可否: representative screen reader、実browser zoom、実機、owner判断がないため不可。
