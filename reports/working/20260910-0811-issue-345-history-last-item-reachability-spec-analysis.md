# Issue #345 履歴末尾viewport到達 specification analysis

## Inventory

- Source: Issue #345、Draft PR #470、current `main@8e542b31`
- Canonical requirement: `REQ_SERVICE_QUALITY_016.md`
- Design: `DES_UI_UX_001.md`
- Authored trace metadata: `tools/web-inventory/ui-quality-matrix.json`
- Generated evidence: `docs/generated/web-ui-quality-matrix.md`
- Implementation evidence: `apps/web/e2e/layout-stress.spec.ts`
- Parallel change boundary: PR #461の`HistoryWorkspace.tsx`

## Facts

| ID | 状態 | 事実 |
| --- | --- | --- |
| FACT-001 | confirmed | `E2E-UI-LAYOUT-STRESS-001`は320×720 CSS pxで履歴35件を返す。 |
| FACT-002 | confirmed | 1件目と35件目のtitleは長文fixtureである。 |
| FACT-003 | confirmed | 現行testは35件目へ`toBeVisible()`を実行するが、viewport内の上下端を測定しない。 |
| FACT-004 | confirmed | お気に入り末尾は`scrollIntoViewIfNeeded()`後に`top >= 0`、`bottom <= 720`を測定する。 |
| FACT-005 | confirmed | #461は`HistoryWorkspace.tsx`を変更するため、本sliceで同fileを変更すると競合が増える。 |
| FACT-006 | inferred | 現行production UIは末尾へ到達可能と見込むが、3-browser required evidenceで未証明である。 |
| FACT-007 | open_question | 実browser 400% zoom、代表screen reader、touch／実機で同じ到達性が成立するかは未検証である。 |

## Gap analysis

| ID | Category | Related | Severity | Confidence | Evidence | Impact | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-001 | missing_boundary_case | SQ-016, AC-SQ016-001/006/007, E2E-UI-LAYOUT-STRESS-001 | medium | confirmed | 35件目はDOM visibilityのみ | 320pxで多数件の末尾へ実際に到達できない退行をrequired gateが見逃す | 末尾へscrollし、viewport矩形とoverflowを3 browserで測定する |

## Acceptance criteria

- AC-1: 35件目へscroll後、長いtitleの`top >= 0`かつ`bottom <= 720`。
- AC-2: 到達後もdocument root／履歴regionの`scrollWidth <= clientWidth`。
- AC-3: browser project、viewport、history count、末尾title長、末尾矩形、dimensionsをJSON evidenceへ保存。
- AC-4: `history → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`の双方向traceを維持。
- AC-5: production component／API／認可は変更しない。

## E2E and non-UI scenario

### E2E-UI-LAYOUT-STRESS-001: 履歴35件の末尾へ320pxで到達する

- Acceptance Criteria: AC-1、AC-2、AC-3
- Target screen: 履歴
- Actor: ログイン済み利用者
- Priority: high
- Confidence: confirmed
- Test data: test-only routeの履歴35件、1件目／35件目に長いtitle

#### 前提条件

- CSS viewportは320×720である。
- reduced motionを有効にする。
- 履歴API routeは35件を返す。

#### 画面操作

1. モバイルnavigationから「履歴」を開く。
2. 35件と長い先頭／末尾titleを確認する。
3. 35件目のtitleへスクロールする。

#### 期待値

- 35件目のtitleの上下端がviewport内に収まる。
- document rootと履歴regionに水平overflowがない。
- browser別JSON artifactにfixture量、末尾title長、末尾矩形、dimensionsが残る。

#### 非UI検証

- 正本、設計、authored matrix、generated matrixのE2E IDとAC参照が一致する。
- test-only fixtureがproduction fallbackへ混入しない。

## Traceability

| Source | Fact | Task | AC | E2E | Requirement | Specification | Confidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Issue #345 / PR #470 | FACT-001〜006 | TASK-20260910-HISTORY-LAST | AC-1〜5 | E2E-UI-LAYOUT-STRESS-001 | SQ-016 / AC-SQ016-001, 006, 007 | DES_UI_UX_001 / quality matrix | confirmed | 実browser・支援技術はFACT-007として未完了 |

## Review decision

- 判定: 条件付き実装可能。
- Major以上: 0件。本sliceは既存正本とE2E IDを再利用できる。
- 残余リスク: 実browser zoom、代表screen reader、native AX、touch／実機、実APIは本E2Eで代替しない。
