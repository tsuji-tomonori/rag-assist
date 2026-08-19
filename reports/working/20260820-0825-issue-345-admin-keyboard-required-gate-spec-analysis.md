# Issue #345 admin keyboard required gate 仕様分析

## Input inventory

| source | date | type | reliability |
|---|---|---|---|
| Issue #345 | 2026-08-20確認 | issue正本 | confirmed |
| current `main@8e542b31` | 2026-08-20確認 | repository base | confirmed |
| Draft PR #462 `8c308d29` | 2026-08-19 | 実装・正本・生成物 | confirmed |
| open PR #461／#464 | 2026-08-20確認 | 並行変更 | confirmed |
| `REQ_SERVICE_QUALITY_016.md` | PR #462 head | 品質要求正本 | confirmed |
| `DES_UI_UX_001.md` | PR #462 head | UI設計正本 | confirmed |
| `ui-quality-matrix.json` | PR #462 head | machine-readable evidence | confirmed |
| `ui-traceability.json` | PR #462 head | screen／requirement trace | confirmed |
| `keyboard-navigation.spec.ts` | PR #462 head | required E2E | confirmed |
| `AdminWorkspace.tsx`／`AdminUserPanel.tsx` | PR #462 head | production semantic contract | confirmed |

## Report facts

- `admin / AC-SQ016-002`はautomated `blocked`で、理由はfocus candidate auditとkeyboard journey evidence待ちである。`confirmed`
- 既存keyboard E2Eはadminへのnavigation到達だけを検査し、画面内controlを検査しない。`confirmed`
- production admin UIはnative button／input／select、`管理セクション`navigation、`aria-current`を実装済みである。`confirmed`
- admin固有CSSには44px targetがある一方、3px `:focus-visible`契約がない。`confirmed`
- #461は`AdminWorkspace`配下を変更するが、admin CSSとkeyboard E2Eは変更しない。`confirmed`
- browser自動検査はrepresentative screen reader／manual keyboard／実browser zoomを代替しない。`confirmed`

## Candidate tasks

| candidate | priority | duplication／conflict | decision |
|---|---:|---|---|
| admin keyboard journey／focus indicator | P0 | #461が変更しないE2E／feature CSSへ限定して競合を抑える | 採用 |
| admin semantic AX contract | P0 | 別の`AC-SQ016-003`で一意な小作業として分離可能 | 次候補 |
| #461 production component修正 | P0 | open PRのscopeと直接重複 | 不採用 |
| manual screen reader／実zoom | P0 | 現環境で代表機器・読み上げ確認ができない | blocked維持 |

## Acceptance criteria

1. overviewのユーザー管理cardへTabで到達し、3px focusとEnterによるsection遷移を検証する。
2. ユーザー検索、状態、並び順、検索buttonへTabで到達し、keyboard入力とURL stateを検証する。
3. `admin → SQ-016 → AC-SQ016-002 → E2E-UI-KEYBOARD-NAV-001`を正本・trace・matrix・生成文書で追跡する。
4. automatedだけpassへ変更し、manual／overallとsemanticをblockedに保つ。

## E2E and non-UI scenarios

### E2E-UI-KEYBOARD-NAV-001 admin scenario

1. keyboardでサインインし、画面navigationから管理者設定へ到達する。
2. overviewの`ユーザー管理を開く`へTab移動し、3px focusを確認してEnterで開く。
3. ユーザー検索へTab移動して検索語を入力する。
4. 状態／並び順selectへTab移動し、ArrowDownで値を変更する。
5. 検索buttonへTab移動し、Enterで送信する。
6. `section=users`、検索語、status、sortがURL stateへ反映されることを確認する。

### Non-UI trace scenario

- authored trace／matrixからgenerated Web docsを生成し、adminの`AC-SQ016-002`だけがautomated passへ変わることを検査する。
- canonical docs validationとmachine-readable trace testsを実行する。

## Operation and expectation groups

| group | operation | expectation |
|---|---|---|
| discovery | Tab | representative admin controlへ順に到達し3px focusを表示する |
| navigation | overview cardでEnter | users sectionとURL stateへ遷移する |
| filtering | input／select keyboard | controlled valueとURL stateが一致する |
| submission | 検索buttonでEnter | 検索queryをURLへ確定する |
| trace | generator／docs check | requirement／AC／E2Eが一意に同期する |

## Requirement synthesis

- 新規要求IDは作らない。既存`SQ-016 / AC-SQ016-002`の未結線自動証跡を補う。
- `E2E-UI-KEYBOARD-NAV-001`を共有E2E IDとして維持し、admin専用IDを重複作成しない。
- 画面操作は要求そのものではなく、keyboard／focus契約の検証例として扱う。

## Traceability gap

| requirement | design | implementation | test | gap before | intended state |
|---|---|---|---|---|---|
| SQ-016 / AC-SQ016-002 | DES_UI_UX_001 admin row | existing AdminWorkspace／AdminUserPanel＋admin focus CSS | E2E-UI-KEYBOARD-NAV-001 | screen-level journey／3px focusなし | automated pass、manual／overall blocked |

## Open questions

- `open_question`: #461統合後にDOM順序・accessible nameが変わるか。統合後に再実走する。
- `open_question`: representative screen readerと実browser 200%／400% zoomの実施owner／環境。
- `open_question`: admin `AC-SQ016-003`をrequired AX E2Eへ進める代表semantic scope。

## 正本レビュー判定

- 判定: **不合格（今回scope着手前）**。`admin / AC-SQ016-002`はnative semanticsが存在する一方、required keyboard journeyとmachine-readable合否が欠落しているため。
- 実行可否: test-only GET fixtureと既存accessible contractで自動証跡まで実装可能。manual evidenceと#461統合後再検証はこの資料だけでは完了不可。
