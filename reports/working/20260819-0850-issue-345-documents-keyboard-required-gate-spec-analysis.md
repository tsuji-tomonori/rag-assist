# Issue #345 documents keyboard required gate 仕様分析

## Input inventory

| source | date | type | reliability |
|---|---|---|---|
| Issue #345 | 2026-08-19確認 | issue正本 | confirmed |
| current `main@8e542b31` | 2026-08-19確認 | repository base | confirmed |
| Draft PR #462 `779a1076` | 2026-08-18 | 実装・正本・生成物 | confirmed |
| open PR #461 | 2026-08-19確認 | 並行UI変更 | confirmed |
| `REQ_SERVICE_QUALITY_016.md` | PR #462 head | 品質要求正本 | confirmed |
| `DES_UI_UX_001.md` | PR #462 head | UI設計正本 | confirmed |
| `ui-quality-matrix.json` | PR #462 head | machine-readable evidence | confirmed |
| `keyboard-navigation.spec.ts` | PR #462 head | required E2E | confirmed |
| `screen-reader-semantics.spec.ts` | PR #462 head | documents fixture／semantic contract | confirmed |

## Report facts

- `documents / AC-SQ016-002`だけがautomated `blocked`で、理由はfocus candidate auditとkeyboard journey evidence待ちである。`confirmed`
- 既存keyboard E2Eはdocumentsへのnavigation到達だけを検査し、画面内controlやdialogを検査しない。`confirmed`
- 既存documents semantic E2EにはGET限定fixtureと安定したaccessible name／roleがある。`confirmed`
- production `DocumentDetailDrawer`は初期focus、Tab focus trap、Escape、trigger focus restoreを実装済みである。`confirmed`
- 初回required CIはfolder searchのfocusが移動した一方、computed outlineが3pxではなく失敗し、documents主要controlのvisible focus欠落を検出した。`confirmed`
- 3px修復後のCIはkeyboard変更とURL state echoが落ち着く前に次のkey／controlへ進むengine差を検出したため、各controlのkeyboard変更後にvalueと正規URLの両方を待つsequenceへ変更した。`confirmed`
- #461は`DocumentWorkspace`配下を変更する。`confirmed`
- browser自動検査はrepresentative screen reader／manual keyboard／実browser zoomを代替しない。`confirmed`

## Candidate tasks

| candidate | priority | duplication／conflict | decision |
|---|---:|---|---|
| documents keyboard journey／focus indicator | P0 | #461が変更しないfeature CSSへ限定して競合を抑える | 採用 |
| documents contrast | P1 | AC-SQ016-004全画面の横断方針が必要 | 次候補 |
| #461 production component修正 | P0 | open PRのscopeと直接重複 | 不採用 |
| manual screen reader／実zoom | P0 | 現環境で代表機器・読み上げ確認ができない | blocked維持 |

## Acceptance criteria

1. 検索・5種control・document detail triggerへTabで到達し、3px focusと値変更を検証する。
2. dialogの初期focus、Tab／Shift+Tab trap、Escape close、trigger restoreを検証する。
3. `documents → SQ-016 → AC-SQ016-002 → E2E-UI-KEYBOARD-NAV-001`を正本・matrix・生成文書で追跡する。
4. automatedだけpassへ変更し、manual／overallとcontrastをblockedに保つ。

## E2E and non-UI scenarios

### E2E-UI-KEYBOARD-NAV-001 documents scenario

1. keyboardでサインインし、画面navigationからドキュメントへ到達する。
2. folder searchへTab移動して文字列を入力する。
3. filename search、type/status/folder/sort/page-sizeへTab移動し、keyboardで値を変える。
4. detail triggerへTab移動し、Enterでdialogを開く。
5. close buttonの初期focusと3px indicatorを確認する。
6. Shift+Tabで末尾action、Tabで先頭へ循環することを確認する。
7. Escapeで閉じ、triggerへfocusが戻ることを確認する。

### Non-UI trace scenario

- authored matrixからgenerated matrixを生成し、documentsの`AC-SQ016-002`だけがautomated passへ変わることを検査する。
- canonical docs validationとmachine-readable trace testsを実行する。

## Operation and expectation groups

| group | operation | expectation |
|---|---|---|
| discovery | Tab／入力／select keyboard | controlへ到達し、値が更新される |
| selection | detail triggerでEnter | 対象dialogが開きclose buttonへfocus |
| containment | Tab／Shift+Tab | focusがdialog内で循環する |
| recovery | Escape | dialogを閉じてtriggerへ復帰する |
| trace | matrix generator／docs check | requirement／AC／E2Eが一意に同期する |

## Requirement synthesis

- 新規要求IDは作らない。既存`SQ-016 / AC-SQ016-002`の未結線自動証跡を補う。
- `E2E-UI-KEYBOARD-NAV-001`を共有E2E IDとして維持し、documents専用IDを重複作成しない。
- 画面操作は要求そのものではなく、keyboard／focus契約の検証例として扱う。

## Traceability gap

| requirement | design | implementation | test | gap before | intended state |
|---|---|---|---|---|---|
| SQ-016 / AC-SQ016-002 | DES_UI_UX_001 documents row | existing DocumentWorkspace／DocumentDetailDrawer＋documents focus CSS | E2E-UI-KEYBOARD-NAV-001 | screen-level journey／3px focusなし | automated pass、manual／overall blocked |

## Open questions

- `open_question`: #461統合後にDOM順序・accessible nameが変わるか。統合後に再実走する。
- `open_question`: representative screen readerと実browser 200%／400% zoomの実施owner／環境。
- `open_question`: AC-SQ016-004を全画面横断でpassへ進めるcomputed／axe contrast evidenceの承認境界。

## 正本レビュー判定

- 判定: **不合格（今回scope着手前）**。`documents / AC-SQ016-002`は実装契約が存在する一方、required keyboard journeyとmachine-readable合否が欠落しているため。
- 実行可否: test-only fixtureと既存accessible contractで自動証跡まで実装可能。manual evidenceと#461統合後再検証はこの資料だけでは完了不可。
