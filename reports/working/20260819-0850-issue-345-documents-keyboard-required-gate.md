# Issue #345 文書画面keyboard required gate 作業記録

- 日時: 2026-08-19 08:50 JST
- task: `tasks/do/20260819-0850-issue-345-documents-keyboard-required-gate.md`
- Draft PR: #462
- base: `main@8e542b31`
- scope: `documents / AC-SQ016-002`

## 選定理由

current main、Draft PR #462、open PR #461／#464、`tasks/todo/`／`tasks/do/`、UI正本・authored matrix・生成文書を確認した。documentsは320 CSS px reflow、loading／error／permission／retry、Chromium semantic contractまでrequired gate化済みだが、keyboard journeyだけがautomated `blocked`だった。open PR #461が`DocumentWorkspace`と配下componentを変更中のため、production codeと競合しないtest-only GET fixtureと既存DOM contractの検証を最小増分に選んだ。

## 実装

- `E2E-UI-KEYBOARD-NAV-001`へdocuments journeyを追加した。
- Tabでfolder search、filename search、type／status／folder／sort／page-size、document detail triggerへ到達し、native keyboard入力と3px focus indicatorを検証する。
- Enterでdetail dialogを開き、close buttonへの初期focus、Shift+Tab／Tabのfocus trap、Escape close、trigger focus restoreを検証する。
- 初回required CIがfolder searchの3px outline欠落をChromium／Firefox／WebKitで再現したため、folder search、filter controls、detail trigger、drawer actionへ3px／2px offsetの`:focus-visible`を追加した。
- fixtureはPlaywright route内のGET `/documents`、`/document-groups`、`/documents/reindex-migrations`だけに限定し、production component、API、permission、mutation契約は変更していない。

## 正本・生成物同期

- `REQ_SERVICE_QUALITY_016.md`へ2026-08-19の証跡とcross-browser required境界を追記した。
- `DES_UI_UX_001.md`のdocuments行とkeyboard／semantic contractを更新した。
- `ui-traceability.json`で`documents → SQ-016 → AC-SQ016-002`を追加した。
- `ui-quality-matrix.json`でdocumentsの`AC-SQ016-002`だけをautomated `pass`へ更新し、manual／overallは`blocked`を維持した。
- 正規generatorで`web-screens.md`、`web-traceability.md`、`web-ui-inventory.json`、`web-ui-quality-matrix.md`を同期した。

## ローカル検証

| 検証 | 結果 | 備考 |
| --- | --- | --- |
| UI trace／quality matrix／semantic／manual evidence tests | pass | 25 tests |
| `node tools/web-inventory/generate-ui-quality-matrix.mjs --check` | pass | staleなし |
| `python3 scripts/validate_docs.py` | pass | canonical docs |
| `git diff --check` | pass | whitespace errorなし |
| Web lint／typecheck／unit／build | CIで検証 | ローカルworktreeに依存packageがなく、取得を伴うnpm操作は実行環境に拒否された |
| Chromium／Firefox／WebKit E2E | CIで検証 | PR required workflowを正本証跡とする |

## CI修復ループ

1. 実装head `4cdbae8c`のWeb UI Quality run `32199927920`はChromiumとFirefox／WebKitの全projectでdocuments folder searchのcomputed outlineが3pxにならず失敗した。focus自体は対象へ到達していた。
2. keyboard検査を緩めず、documentsの主要control／detail actionへ3px `:focus-visible`と2px offsetを追加した。
3. 修復head `2b9c4bde`のChromium jobはoutline検査を通過した後、zero-delay複数key送出とroute同期の間でcontrolled valueが`k`だけになり失敗した。
4. click／programmatic focusへ置換せず、各keyの後にprefix valueとfocus保持を検証するsequenceへ変更した。次のkeyを送る前にReact／URL stateの反映を待つため、入力欠落もfocus逸脱も検出できる。
5. 再修復head `db068114`はさらに先へ進み、engineごとのURL state echo前にselect操作へ進むraceと、footer page-size selectの3px outline欠落を検出した。
6. test-only fixtureに一致する1文字をkeyboard入力し、各search／select変更後にvalueと正規URLの両方を待つsequenceへ変更した。page-size selectにも同じ3px focus indicatorを追加した。
7. 再々修復head `46eb7a15`でWeb UI Quality run `32201210544`が成功した。Chromium required、Firefox／WebKit requiredの両jobでretry／失敗なくkeyboard journeyを完走した。

## GitHub Actions

| workflow | run | 結果 |
| --- | --- | --- |
| Web UI Quality | `32201210544` | pass。Chromium／Firefox／WebKit required成功 |
| MemoRAG CI | `32201210548` | pass。lint、typecheck、unit、build、正本・生成物check成功 |
| Validate Semver Label | `32201210497` | pass |

## 受け入れ判定

- `AC-20260819-001`: pass。keyboard入力、各controlの3px focus、値／URL state反映、detail openをcross-browser requiredで確認した。
- `AC-20260819-002`: pass。dialog初期focus、両方向focus trap、Escape、trigger restoreをcross-browser requiredで確認した。
- `AC-20260819-003`: pass。documentsだけを更新し、manual／overallとcontrastはblockedを維持した。
- `AC-20260819-004`: pass。ローカル依存不要検査とfinal implementation headのWeb UI Quality、MemoRAG CI、semverが成功した。

## セルフレビュー観点

- clickや`locator.focus()`でkeyboard journeyを代替していない。
- dialog境界は最初→最後と最後→最初の循環、Escape、trigger復帰を検証する。
- test-only dataはGET routeに閉じ、非GETはfallbackする。
- #461と重なるproduction componentを変更していない。
- browser automationをmanual keyboard、代表screen reader、実browser zoom、touch／実機のpassへ読み替えていない。

## 未完了・blocker

- representative screen reader、manual keyboard、実browser 200%／400% zoom、touch／実機、Firefox／WebKit native accessibility treeは未実施。
- documentsの`AC-SQ016-004` contrastはblockedのまま。
- `FR-051`永続化・owner判断とAPI C1 80.48%の既知gapは今回のscope外で未完了。
- #461統合後は最終DOMでaccessible nameとTab順を再実走する必要がある。

## 次の作業

Draft PR #462へ受け入れ確認・セルフレビューを追加し、Issue #345へ成功証跡と未完了を記録する。#461統合後はdocuments最終DOMのaccessible name、Tab順、focus indicatorを再実走する。
