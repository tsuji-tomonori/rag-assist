# Issue #345 Firefox／WebKit履歴状態required gate仕様分析

## Input inventory

| source | type | date | reliability |
|---|---|---|---|
| Issue #345 | issue / acceptance goals | 2026-08-15更新 | confirmed |
| Draft PR #462 head `4eeef71e` | implementation / CI evidence | 2026-08-15 | confirmed |
| `REQ_SERVICE_QUALITY_016.md` | canonical quality requirement | 2026-08-15更新 | confirmed |
| `REQ_NON_FUNCTIONAL_018.md` | canonical gate requirement | 2026-08-15更新 | confirmed |
| `DES_UI_UX_001.md` | canonical UI design / trace | 2026-08-15更新 | confirmed |
| `visual-regression.spec.ts` | Chromium state evidence | current branch | confirmed |
| open PR #461 | overlap boundary | 2026-08-16確認 | confirmed |

## Report facts

- current mainは`8e542b31`で、#462はbehind 0 / ahead 68、Draft、mergeableである。
- Firefox／WebKit requiredはkeyboard、semantic、reflow、content-extremeの14件である。
- 履歴のloading→500→retry→confirmed emptyとHTTP 403はChromium `E2E-UI-STATE-001`でrequiredだが、Firefox／WebKit requiredではない。
- #461はshared UI／production componentを変更する。本sliceは新規E2E、workflow contract、正本・生成物に限定できる。
- representative screen reader、実browser zoom、touch／実機はmanual evidence taskでblockedである。

## Candidate tasks

| candidate | priority | decision |
|---|---:|---|
| 履歴の代表状態2件をFirefox／WebKit requiredへ追加 | P0 | 採用。既存契約を再利用し、状態・browser gapを小さく閉じる |
| 全8画面の状態E2EをFirefox／WebKitへ追加 | P1 | 不採用。PR latencyと差分が大きく、1件原則に反する |
| manual screen reader／実zoomを実施 | P0 | 環境がないため未着手。blockedを維持 |
| FR-051永続化を実装 | P1 | owner判断待ちかつ別要件のため対象外 |

## Acceptance criteria

- `AC-20260816-001`: loading／500／retry／confirmed emptyをFirefox／WebKitで区別し、false zeroとprivate detailを防ぐ。
- `AC-20260816-002`: HTTP 403をpermission alertとして表示し、empty／zero／private detailを表示しない。
- `AC-20260816-003`: required追加は2 scenario×2 browserに限定し、manual statusをblockedのままにする。
- `AC-20260816-004`: historyから要件、受け入れ条件、E2E、browser gateまで追跡できる。
- `AC-20260816-005`: 最小検証、Draft PR、セルフレビュー、Issue進捗をfinal headで記録する。

## E2E and non-UI scenarios

- `E2E-UI-CROSS-BROWSER-STATE-001`: 履歴のloading→500→retry→confirmed emptyと403をFirefox／WebKitで検証し、browser別JSON evidenceを保存する。
- `NONUI-UI-TRACE-001/002`: authored traceの画面・要件・AC・E2E参照切れ／孤立を検出する。
- `NONUI-UI-MANUAL-EVIDENCE-001`: automationからmanual passを生成せず、blocked baselineを維持する。

## Operation and expectation groups

| group | operation | expectation |
|---|---|---|
| OP-STATE-READ | 履歴へ移動する | loadingを対象regionへ公開し、0件を先に出さない |
| OP-STATE-RETRY | error内の再試行を実行する | recovered status後にconfirmed emptyと0件を表示する |
| OP-STATE-DENIED | 403応答を受ける | permission alertを表示し、contentとprivate detailを隠す |
| OP-EVIDENCE | E2Eをbrowser projectで実行する | project、状態系列、boundaryをartifactへ残す |

## Requirement and specification synthesis

- 新規product requirementは作らない。既存`SQ-016 AC-SQ016-007`がlong／zero／loading／error／permission状態を要求する。
- 既存`NFR-018 AC-NFR018-004`がapproved Firefox／WebKit scopeとfailure handlingの明示を要求する。
- `DES_UI_UX_001`、machine-readable trace、quality matrixへ限定cross-browser state evidenceを追記する。
- API、authorization、RAG quality/security contractは変更しない。

## Traceability and gaps

`history → SQ-016 / NFR-018 → AC-SQ016-007 / AC-NFR018-004 → E2E-UI-CROSS-BROWSER-STATE-001 → Firefox/WebKit required`

Open gaps:

- representative screen reader
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- touch／real device
- Firefox／WebKit native accessibility tree debug evidence
- FR-051 owner判断、API C1、OQ-UI-002

## Security / RAG quality review

- private backend detailを画面／artifactの利用者向けstateへ露出させないassertionを維持する。
- permission denialをempty dataへ変換しない。
- fixtureはtest-only route interceptionであり、production API／RAG behaviorを変更しない。
- retrieval、grounding、citation、prompt、tenant境界は非変更である。

## Open questions

- `OQ-UI-002`: Firefox／WebKit required scopeの最終owner、cadence、承認済みmatrixは未確定。本sliceは既存required jobの限定拡張としてDraft内に保つ。
