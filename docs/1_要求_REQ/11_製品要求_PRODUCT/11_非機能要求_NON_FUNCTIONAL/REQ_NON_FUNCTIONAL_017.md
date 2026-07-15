# 要件定義（1要件1ファイル）

- 要件ID: `NFR-017`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: A
- Confidence: confirmed

## 要件

- NFR-017: navigation、status、form、dialog、high-impact action、および feedback の同等な UI semantics は、承認された利用者語彙、semantic design token、common primitive、および実データ由来の state を用いて feature 間で一貫して表現すること。

## 受け入れ条件（この要件専用）

- `AC-NFR017-001`: 同じ status/intent/risk は feature ごとの任意色・文言だけに依存せず、共通 semantic token と text/icon/shape の複数 cue で表すこと。
- `AC-NFR017-002`: equivalent navigation、form、dialog、status、retry、risky action は native semantics を優先した common primitive または同一 contract を使うこと。
- `AC-NFR017-003`: 利用者向け label は approved display metadata から取得し、raw enum、opaque ID、internal module/service 名を ordinary task の主要語彙にしないこと。
- `AC-NFR017-004`: production UI の count、date、capacity、user/group、cost、status は props/API/persisted state/config または explicit unavailable/loading/error/permission state に由来し、demo fallback を使わないこと。
- `AC-NFR017-005`: common primitive の変更は representative feature tests、generated accessibility inventory、および contrast/state review で回帰を確認すること。

## 測定・検証

- common primitive component tests and feature integration tests。
- generated Web inventory accessibility/state metadata review。
- production source No Mock Product UI scan/review。
- token contrast review for text/UI/focus/state combinations。

## 実装状況（2026-07-14）

- 共通 `ResourceStateBoundary` / `ResourceStatePanel` と semantic state token は、同じ状態を feature 固有色だけに依存せず marker、見出し、説明、native semantics、action で表す。
- `displayMetadata.ts` は domain union を source of truth とした exhaustive な approved display metadata を所有し、`StatusBadge` は semantic tone、可視日本語 label、色に依存しない marker を同時に表示する。
- `--status-{neutral,info,success,warning,danger}-{foreground,background,border}` と共通 `Button` の warning/danger variant を定義し、2 種類の確認 dialog は同じ button intent contract を使う。
- benchmark、非同期エージェント、documents/share/reindex、admin user/用語展開、debug の主要 status/permission/mode/runner/action を approved metadata へ移行し、opaque ID は必要な管理・技術詳細へ限定した。API に名称解決機能がない共有先は「管理者向け識別子」と明示し、架空名称へ置換しない。
- production の count/empty 表示は取得確認済み part に限定し、documents、questions、debug、benchmark、admin の未取得値を `null` または明示的 state として扱う。
- metadata/primitive/representative feature tests、semantic token contrast test、`E2E-UI-SEMANTIC-001` axe、`E2E-UI-STATE-001`、generated Web inventory で primitive と feature integration を検証する。
- 今回の対象外である全 feature の brand/layout arbitrary color、全ブラウザ、screen reader、実 browser zoom、real device の横断確認は cross-screen/manual/quality-gate task に残り、本要件全体の release 適合を自動検証だけから宣言しない。

## 要件の源泉・背景

- 源泉: GitHub Issue #345 の token/common primitive、user vocabulary、state expression TODO。
- repository rule: `skills/no-mock-product-ui/SKILL.md`。
- current state: globals/shared primitives exist, but feature CSS and labels have not been audited as one semantic contract。

## 要件の目的・意図

- 目的: feature が増えても同じ状態・操作・危険度が異なる意味に見えず、maintainer が一箇所の contract から改善できるようにする。
- 意図: visual uniformity alone ではなく semantic consistency と honest data provenance を要求する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `NFR-017` |
| 説明 | consistent user vocabulary, semantic tokens, primitives, and honest UI state |
| 根拠 | feature-specific colors/labels/fallbacks は理解・a11y・保守性を損なう |
| 源泉 | GitHub Issue #345、No Mock Product UI policy |
| 種類 | 非機能要求（ユーザビリティ・保守性） |
| 依存関係 | `FR-095`, `FR-096`, `FR-098`, `SQ-016` |
| 衝突 | feature-specific domain terminology must remain precise rather than forced into an incorrect generic label |
| 受け入れ基準 | `AC-NFR017-001`〜`AC-NFR017-005` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-07-14 Issue #345 から追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・ニーズ適合 | pass | Issue が求める cross-feature consistency/no internal vocabulary を扱う。 |
| 一貫性 | pass | domain-specific terminology remains allowed when approved. |
| 実現可能性 | pass | token/primitive migration can be incremental. |
| 検証可能性 | pass | component/inventory/contrast/no-mock evidence can be inspected. |

## 関連文書・task

- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/done/20260714-issue-345-ui-language-primitives.md`
