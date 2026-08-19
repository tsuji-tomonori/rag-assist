# Issue #345 管理者設定keyboard required gate 作業記録

- 日時: 2026-08-20 08:25 JST
- task: `tasks/do/20260820-0825-issue-345-admin-keyboard-required-gate.md`
- Draft PR: #462
- base: `main@8e542b31`
- scope: `admin / AC-SQ016-002`

## 選定理由

current main、Draft PR #462、open PR #461／#464、`tasks/todo/`／`tasks/do/`、UI正本・authored matrix・生成文書を確認した。adminは320 CSS px reflow、contrast、touch target、loading／error／permission／retryまでrequired gate化済みだが、keyboard journeyだけがautomated `blocked`だった。open PR #461が`AdminWorkspace`と配下componentを変更中のため、production componentと競合しないtest-only GET fixture、既存DOM contract、admin固有CSSを最小増分に選んだ。

## 根本原因と実装

- 既存`E2E-UI-KEYBOARD-NAV-001`は管理者設定への到達だけを検査し、画面内の代表管理jobを呼んでいなかった。
- admin固有CSSは44px targetを持つ一方、required contractの3px `:focus-visible`を定義していなかった。
- GET限定のusers／roles／audit／aliases fixtureをkeyboard E2Eへ追加した。usage／costは取得値なしを明示し、mutation requestはfallbackする。
- overviewのユーザー管理card、概要／ユーザーsection tab、ユーザー検索、状態、並び順、検索buttonへTabで到達し、native keyboard操作、3px focus、URL stateを検証する。
- `.admin-workspace`内のnative button／input／select／textareaへ3px primary outlineと2px offsetを追加した。
- production component、API、permission、管理mutationは変更していない。

## 正本・生成物同期

- `REQ_SERVICE_QUALITY_016.md`へ2026-08-20の管理keyboard証跡を追記した。
- `DES_UI_UX_001.md`のadmin行とAdmin keyboard contractを更新した。
- `ui-traceability.json`で`admin → SQ-016 → AC-SQ016-002`を追加し、横断`E2E-UI-KEYBOARD-NAV-001`を重複登録しない一意なtraceにした。
- `ui-quality-matrix.json`でadminの`AC-SQ016-002`だけをautomated `pass`へ更新し、manual／overallと`AC-SQ016-003`は`blocked`を維持した。
- 正規generatorの既存inventory再利用経路で`web-screens.md`、`web-traceability.md`、`web-ui-inventory.json`を、quality matrix generatorで`web-ui-quality-matrix.md`を同期した。

## ローカル検証

| 検証 | 結果 | 備考 |
| --- | --- | --- |
| UI trace／quality matrix／semantic／manual evidence tests | pass | 25 tests |
| `python3 scripts/validate_docs.py` | pass | canonical docs |
| `git diff --check` | pass | whitespace errorなし |
| Web inventory生成 | pass | `typescript` package不在のため、正規generatorのrender／trace検証関数へ既存inventoryを入力。production sourceは未変更 |
| Web lint／typecheck／unit／build | GitHub Actions待ち | isolated worktreeに依存packageがなく、network取得を伴うnpm実行はruntimeに拒否された |
| Chromium／Firefox／WebKit E2E | GitHub Actions待ち | PR required workflowを正本証跡とする |

## 受け入れ判定（CI前）

- `AC-20260820-001`: 実装済み／CI待ち。overview cardとsection tabのkeyboard journeyを追加した。
- `AC-20260820-002`: 実装済み／CI待ち。検索・status・sort・submitのkeyboard操作とURL stateを追加した。
- `AC-20260820-003`: pass。adminだけを更新し、manual／overallとsemanticはblockedを維持した。
- `AC-20260820-004`: pending。ローカル依存不要検査はpass、GitHub Actionsは未実行。

## 未完了・blocker

- final headのWeb UI Quality、MemoRAG CI、semverは未実行。
- representative screen reader、manual keyboard、実browser 200%／400% zoom、touch／実機、Firefox／WebKit native accessibility treeは未実施。
- adminの`AC-SQ016-003` semantic evidenceはblockedのまま。
- `FR-051`永続化・owner判断とAPI C1 80.48%の既知gapは今回のscope外で未完了。
- #461統合後は最終DOMでaccessible nameとTab順を再実走する必要がある。

## 指示へのfit評価

総合fit: 4.0 / 5.0（約80%）

理由: 一意な小改善、task、実装、正本・生成物、依存不要検査まで完了したが、required CI、PRコメント、Issueコメントが未完了である。CI結果を反映するまでtaskとPRは`do`／Draftを維持する。

## 次の作業

Draft PR #462へ実装headを追加してrequired CIを実走し、失敗を修復する。final head成功後に受け入れ確認・セルフレビュー・Issue #345進捗を記録する。
