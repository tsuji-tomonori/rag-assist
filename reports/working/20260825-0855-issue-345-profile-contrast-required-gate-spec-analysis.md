# Issue #345 個人設定 contrast required gate 仕様分析

## Input inventory

| source | type | reliability | finding |
| --- | --- | --- | --- |
| Issue #345と2026-08-24までの進捗コメント | issue / evidence | confirmed | profile contrast、manual screen reader、実browser zoom、実機、owner判断が未完了 |
| Draft PR #462 head `7efd0457` | implementation stack | confirmed | current `main@8e542b31`に対してbehind 0 / ahead 117 |
| PR #461 changed files | parallel PR boundary | confirmed | shared UIと複数画面を所有するがprofile component / `layout.css`は非対象 |
| PR #341〜#344 | historical parallel PR | confirmed | すべてclosed |
| `REQ_SERVICE_QUALITY_016.md` | canonical requirement | confirmed | `AC-SQ016-004`はtext / focus contrastと非色依存cueを要求 |
| `DES_UI_UX_001.md` | canonical design | confirmed | profile keyboard / AX / state証跡はあるがcontrast固有証跡がない |
| `ui-traceability.json` / `ui-quality-matrix.json` | authored machine-readable source | confirmed | profile `AC-SQ016-004 automated`は`blocked` |
| `PersonalSettingsView.tsx` / `layout.css` | production implementation | confirmed | 3px focus、visible polite status、session-only説明が実装済み |
| `visual-regression.spec.ts` | required E2E | confirmed | cross-screen negative baselineはあるがprofile固有positive contractがない |

## Report facts

- confirmed: profileは全personaのauthenticated shellで到達できる。
- confirmed: 送信キーselectはnative label / help associationと3px focus indicatorを持つ。
- confirmed: 変更結果はvisible text、`role=status`、`aria-live=polite`を持つ。
- confirmed: `AC-SQ016-004`だけがscreen固有positive evidence不足でautomated blockedである。
- confirmed: `FR-051`の永続化・失敗・permission契約は未決である。
- open_question: representative screen reader、実browser zoom、real deviceのmanual結果。

## Candidate tasks

1. 採用: profile contrastを`E2E-UI-CONTRAST-004`へ接続する。
2. 非採用: `FR-051`永続化を実装する。owner判断とAPI/store設計が未確定で本taskの安全な範囲を超える。
3. 非採用: manual screen reader / real zoomを合格扱いする。承認済み実行環境と人手証跡がない。

## Acceptance criteria

- 正常・境界: 320 / 1280 CSS pxでprofile regionのaxe `color-contrast`違反が0件である。
- focus: 送信キーselectのcomputed outlineがsolid、3px以上、背景比3:1以上である。
- state: 送信キー変更時に可視text、status role、polite live semanticsを同時に観測できる。
- trace: profile / SQ-016 / AC-SQ016-004 / E2E-UI-CONTRAST-004が正本・authored source・generated docsで一致する。
- boundary: manual / real zoom / real deviceと`AC-SQ016-007`をblockedのまま維持する。

## E2E and non-UI scenarios

### E2E-UI-CONTRAST-004

1. 認証済み利用者として個人設定を320 CSS pxで開く。
2. 個人設定regionのtext contrast違反が0件であることを確認する。
3. 送信キーselectへfocusし、computed outline幅・色・背景から3:1以上を確認する。
4. 同じ確認を1280 CSS pxで行う。
5. 送信キーを変更し、可視status、`role=status`、`aria-live=polite`とstatus text contrast違反0件を確認する。
6. browser project、viewport、computed値、axe結果、境界をJSON artifactへ記録する。

### Non-UI verification

- authored trace / quality matrix schema test。
- generated inventory差分check。
- canonical docs validation。

## Operation and expectation groups

| group | operation | observable expectation |
| --- | --- | --- |
| viewport contrast | profileを320 / 1280pxで表示 | `color-contrast` violation 0 |
| focus contrast | 送信キーselectをfocus | solid 3px以上、背景比3:1以上 |
| non-color state | 送信キーを変更 | visible status + status role + polite live |
| trace sync | generator / docs checksを実行 | ACとE2E IDが正本・生成物で一致 |

## Requirement synthesis

- 新規要求は作らない。既存`SQ-016 / AC-SQ016-004`の検証証跡をprofileへ追加する。
- `FR-051`の意味、永続化、permission contractは変更しない。

## Traceability gap

| view | requirement | acceptance | current evidence | gap | planned evidence |
| --- | --- | --- | --- | --- | --- |
| profile | SQ-016 | AC-SQ016-004 | cross-screen negative baseline | positive screen contract欠落 | E2E-UI-CONTRAST-004 |
| profile | SQ-016 | AC-SQ016-007 | session-only限定state E2E | persistence / failure / permission未決 | 本taskではblocked維持 |

## Review judgment

- 判定: 不合格（着手前）。Major: profile `AC-SQ016-004`の正本→E2E追跡が欠落している。
- 実装可否: 本taskのcontrast証跡は追加判断なしで実装・検証可能。
- 全体完了可否: manual evidenceと`FR-051` owner判断がないためIssue #345全体は完了不可。
