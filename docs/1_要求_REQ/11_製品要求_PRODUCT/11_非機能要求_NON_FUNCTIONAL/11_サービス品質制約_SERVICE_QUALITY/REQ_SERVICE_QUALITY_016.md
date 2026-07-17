# 要件定義（1要件1ファイル）

- 要件ID: `SQ-016`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft
- 優先度: S
- Confidence: confirmed

## 要件

- SQ-016: 権限別の主要 user journey は、WCAG 2.2 Level AA を基準として、320〜1280 CSS px、200%/400% zoom、keyboard、representative screen reader、touch、reduced motion、および long/many/zero/error content state で content または function を失わず完了できること。

## 受け入れ条件（この要件専用）

- `AC-SQ016-001`: 320/375/768/1280px と 200%/400% zoom で、normal page flow が two-dimensional scroll を必要とせず、permitted content/action/focus を loss/overlap/clip しないこと。
- `AC-SQ016-002`: 全 interaction は keyboard-only で操作でき、focus order/visible/obscured、dialog trap/restore、Escape、skip/recovery が relevant WCAG condition を満たすこと。
- `AC-SQ016-003`: controls/status/media expose correct accessible name, role, state, value, description, current/busy/live/error semantics to representative screen readers。
- `AC-SQ016-004`: normal text 4.5:1、large text 3:1、meaningful non-text UI/focus indicator 3:1 の relevant contrast を満たし、color alone で state を伝えないこと。
- `AC-SQ016-005`: interaction target は 24×24 CSS px minimum を満たし、primary/icon actions は layout が許す範囲で 44〜48px class target を提供すること。
- `AC-SQ016-006`: reduced motion preference で non-essential animation を抑え、orientation、safe area、virtual keyboard、fixed navigation が primary input/action/status を隠さないこと。
- `AC-SQ016-007`: long text/file names、多数件、0件、loading/error/permission/partial/stale state でも reading/operation order and target context remain intact。
- `AC-SQ016-008`: automated check だけで合格とせず、`NFR-018` の manual evidence が required scope を満たすこと。

## 品質条件と測定

| 条件 | 水準 | 測定 |
| --- | --- | --- |
| Conformance | relevant WCAG 2.2 A/AA; Japan-facing reference JIS X 8341-3:2016 AA | criteria review + automated/manual evidence |
| Reflow | 320/375/768/1280px, 200%/400% zoom without content/function loss | Playwright + browser zoom/manual |
| Input | keyboard/touch/pointer/screen reader primary journeys | E2E + manual |
| Contrast | text/UI/focus/state relevant ratios | token/tool/manual review |
| Target size | WCAG 2.2 24px minimum; 44–48px primary target where practical | computed/layout inspection |
| Content extremes | long/many/zero/error/stale/reduced motion | deterministic fixtures |

## 要件の源泉・背景

- 源泉: GitHub Issue #345 accessibility/responsive TODO and full completion conditions。
- standard: WCAG 2.2 Level AA; JIS X 8341-3:2016 Level AA reference for Japan-facing service。
- confirmed evidence: mobile profile link is hidden at <=720px, inventory has 18 missing and 22 warning items, 390px chat visual exists but full matrix/manual evidence does not。

## 要件の目的・意図

- 目的: disability、input modality、viewport、zoom、motion preference、content volume により permitted primary journey が利用不能になることを防ぐ。
- 意図: automated violation count ではなく journey completion and measurable UI conditions を quality level とする。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-016` |
| 説明 | cross-screen accessible and responsive primary-journey quality |
| 根拠 | current source/test cannot prove permitted journeys from 320px through desktop |
| 源泉 | GitHub Issue #345、WCAG 2.2、JIS X 8341-3:2016 reference |
| 種類 | サービス品質制約（accessibility/responsive usability） |
| 依存関係 | `FR-094`〜`FR-098`, `NFR-017`, `NFR-018` |
| 衝突 | information density, target size, and fixed navigation require feature-specific tradeoffs without losing function |
| 受け入れ基準 | `AC-SQ016-001`〜`AC-SQ016-008` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-07-14 Issue #345 から追加。2026-07-17 `AC-SQ016-002` の shell skip link と login 前 keyboard-only journey の自動証跡を追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・十分性 | pass | viewport/input/a11y/content states in Issue are represented. |
| 一貫性 | pass | existing chat-only `SQ-004` remains a narrower condition. |
| 実現可能性 | pass with manual dependency | code/test fixes are feasible; screen-reader/real-device evidence requires the named environments. |
| 検証可能性 | pass | numeric thresholds and journey evidence are explicit. |

## 現在の自動証跡（2026-07-17）

- `E2E-UI-SKIP-001`: 認証後 shell の最初の keyboard focus で skip link を表示し、desktop 1280×720 / mobile 320×720 の双方で反復 navigation を越えて一意な `main` landmark へ focus を移す。
- `E2E-UI-LOGIN-KEYBOARD-001`: login 前の email から secondary action までの DOM 順 Tab order、3px outline、native required validation、Space による remember 切替、password 上の Enter submit、認証後 chat 到達、horizontal containment を 1280×720 / 320×720 で検証する。rejected authentication の alert/form description/focus/retry は component test で検証する。
- 上記は Chromium keyboard automation であり、representative screen reader、実 browser の 200%/400% zoom、real device、Firefox、WebKit の手動・browser evidence を代替しない。

## 関連文書・task

- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/todo/20260714-issue-345-cross-screen-a11y-responsive.md`
- `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`
