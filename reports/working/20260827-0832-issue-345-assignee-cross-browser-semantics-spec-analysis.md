# Issue #345 担当者対応 cross-browser semantic required gate 仕様分析

## Input inventory

| source | type | date / revision | reliability |
|---|---|---|---|
| Issue #345 | issue / authoritative task boundary | 2026-08-26更新 | confirmed |
| current `main` | repository base | `8e542b31` | confirmed |
| Draft PR #462 | cumulative UI evidence stack | `eb4343f6` | confirmed |
| Draft PR #461 | parallel shared UI production owner | `67a49173`, mergeable false | confirmed |
| `REQ_SERVICE_QUALITY_016.md` | canonical requirement | #462 head | confirmed |
| `DES_UI_UX_001.md` | canonical UI design | #462 head | confirmed; required件数1箇所は実装とconflict |
| `ui-traceability.json` / `ui-quality-matrix.json` | authored machine-readable source | #462 head | confirmed |
| generated Web inventory / quality matrix | generated evidence | #462 head | derived |
| Chromium AX / keyboard / contrast E2E | existing automation | #462 head | confirmed |

## Report facts

- `confirmed`: assigneeはChromium AX treeでname / role / value / pressed / checked / live stateを検証する。
- `confirmed`: assigneeはFirefox／WebKit required keyboard journeyとreflow proxyを持つ。
- `confirmed`: assigneeはFirefox／WebKit required semantic snapshotを持たない。
- `confirmed`: profile semantic追加後のrequired gateは20件だが、UI正本の内訳に18件と残る箇所がある。
- `confirmed`: #461は`AssigneeWorkspace.tsx`を変更するため、このsliceではproduction sourceを避ける。
- `open_question`: representative screen readerとnative browser AX treeのowner / environment。

## Candidate tasks

| candidate | priority | overlap | decision |
|---|---:|---|---|
| assignee Firefox／WebKit semantic required gate | P0 | production sourceを触らず#461と境界分離可能 | 採用 |
| E2E tsconfig `DOM.Iterable`正規化 | P1 | 独立したtooling task | 後続 |
| representative screen reader実測 | P0 | environment / owner未決 | blocked維持 |
| #461との最終DOM再検証 | P0 | #461未収束 | blocked維持 |

## Acceptance criteria

1. Firefox／WebKitでassigneeのprimary semantic structureを検証する。
2. filter value、selected pressed state、notify checked state、draft status live stateを検証する。
3. browser別artifactにE2E ID、project、証跡境界を残す。
4. SQ-016 / UI design / trace / quality matrix / generated docsを同期する。
5. required scope件数の既存conflictを解消する。
6. manual / native / real zoom / device evidenceはblockedを維持する。

## E2E and non-UI scenarios

### E2E-UI-CROSS-BROWSER-SEMANTICS-003

- Given: SYSTEM_ADMINのtest-only local sessionと1件の問い合わせfixtureがある。
- When: Firefox／WebKitでサインインし「担当者対応」へ移動する。
- Then: workspace、問い合わせ一覧、filter、kanban、選択card、回答form、notify checkbox、statusのname / role / state / valueが取得できる。
- When: 回答内容をkeyboard入力する。
- Then: statusが「未送信の変更があります」と可視表示され、`role=status` / `aria-live=polite`を維持する。
- And: browser project、E2E ID、Playwright evidence boundaryをartifactに残す。

### Non-UI trace validation

- Given: SQ-016とUI trace / quality matrixのauthored sourceがある。
- When: generator / trace validatorを実行する。
- Then: `assignee → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-003`が孤立・参照切れ・重複なしで生成文書へ反映される。

## Operation and expectation groups

| group | operation | observable expectation |
|---|---|---|
| navigation | 担当者対応へ移動 | region / headingが一意なnameで公開される |
| filtering | status / search controlを確認 | combobox / searchbox nameとvalueが公開される |
| selection | 問い合わせcardを選択状態で表示 | buttonのpressed stateがtrue |
| drafting | 回答内容を変更 | visible polite statusが未送信変更を通知 |
| provenance | evidenceを保存 | E2E ID / project / boundaryが一致 |

## Traceability and gaps

`assignee → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-003 → Firefox/WebKit required`

残すgap:

- representative screen reader
- Firefox／WebKit native AX tree debug output
- 実browser 200%／400% zoom、text-only zoom、OS scaling
- manual keyboard / contrast、touch／real device
- #461統合後のfinal DOM再検証
- `OQ-UI-002`、API C1 85%
