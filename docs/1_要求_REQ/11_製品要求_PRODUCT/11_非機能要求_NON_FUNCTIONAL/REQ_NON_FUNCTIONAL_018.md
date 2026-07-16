# 要件定義（1要件1ファイル）

- 要件ID: `NFR-018`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: A
- Confidence: confirmed

## 要件

- NFR-018: production UI またはその canonical contract を変更する pull request と release は、automated accessibility、required mobile browser、representative visual regression、approved cross-browser scope、および manual keyboard/screen-reader/zoom/real-device verification の実施結果と未検証事項を区別して記録し、required evidence の failure または欠落を merge/release gate として扱うこと。

## 受け入れ条件（この要件専用）

- `AC-NFR018-001`: representative login/chat/documents/admin/questions views の automated accessibility check は、serious/critical violation が 1 件以上なら非 0 終了し、0 件の場合だけ該当 check を pass とすること。
- `AC-NFR018-002`: mobile Chromium は PR required scope であり、320/375px の representative primary journeys を実行すること。
- `AC-NFR018-003`: visual baseline は representative viewport/state を deterministic fixture で検証し、意図しない mismatch を非 0 にすること。
- `AC-NFR018-004`: Firefox/WebKit の required/scheduled scope、owner、cadence、failure handling が明記され、実施していない browser を pass としないこと。
- `AC-NFR018-005`: manual keyboard、representative screen reader、320px/400% zoom、real-device result は environment、date、scope、pass/fail、defect/task を記録し、automation の結果で代替しないこと。
- `AC-NFR018-006`: UI 非変更 PR は unrelated expensive UI gate を不要に重複実行しない一方、shared Web/CI/docs contract change は対象から漏らさないこと。
- `AC-NFR018-007`: required check が skipped/blocked/pending の場合は理由と risk を PR に記載し、Issue #345 full completion または merge-ready evidence と扱わないこと。

## 測定・検証

- `NONUI-UI-GATE-001`: severe axe/mobile/visual/browser/trace fixtures fail required gate。
- `E2E-UI-A11Y-001`: keyboard and representative screen-reader journeys。
- `E2E-UI-RESPONSIVE-001`: viewport/zoom/motion/content extremes。
- CI branch-protection status and PR evidence audit。

## 要件の源泉・背景

- 源泉: GitHub Issue #345 の automated a11y、visual regression、mobile Chromium、Firefox/WebKit scope、manual evidence TODO。
- confirmed evidence: Playwright has one Desktop Chrome project; E2E workflow is `workflow_dispatch`; 390px chat snapshot exists but 320px/manual/cross-browser coverage is absent。

## 要件の目的・意図

- 目的: automatic and manual evidence のどちらか一方だけで release readiness を過大評価せず、regression を merge 前に検出する。
- 意図: browser matrix を無制限に増やさず、required/scheduled/manual scope と未検証を明示する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `NFR-018` |
| 説明 | explicit automated and manual UI release evidence gate |
| 根拠 | current E2E is optional single-browser and cannot prove WCAG/manual behavior |
| 源泉 | GitHub Issue #345、current Playwright/CI configuration |
| 種類 | 非機能要求（検証性・運用性） |
| 依存関係 | `SQ-016`, `NFR-016`, `NFR-017` |
| 衝突 | PR latency/flakiness and full browser/visual scope |
| 受け入れ基準 | `AC-NFR018-001`〜`AC-NFR018-007` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-07-14 Issue #345 から追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・十分性 | pass | automation/manual/skip semantics を分離する。 |
| 一貫性 | pass | existing repository reporting rule と一致する。 |
| 実現可能性 | pass with open scope | browser/visual required subset needs runtime measurement. |
| 検証可能性 | pass | each evidence class has observable pass/fail metadata. |

## 関連文書・task

- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/todo/20260714-issue-345-ui-automated-quality-gates.md`
- `tasks/todo/20260714-issue-345-manual-a11y-evidence.md`

## 自動品質 gate の実装（2026-07-16）

- pull request の required scope は Chromium とし、UI / shared contract / Web inventory / UI design・requirement / dependency / workflow 変更時だけ `.github/workflows/web-ui-quality.yml` を実行する。
- `E2E-UI-A11Y-GATE-001` は login、chat、documents、questions、admin の full-page axe 結果から serious / critical violation を抽出し、1件以上なら非0終了する。
- `E2E-UI-NAV-001` / `002` は 320 / 375px の permission-aware primary navigation、focus、reduced motion、overflow を Chromium required scope で検証する。
- `@visual` fixture は OS / browser の微小な anti-aliasing 差を最大300 pixelsまで許容し、それを超える deterministic screenshot mismatch を failure にする。HTML report、test-results、trace、screenshot、video を artifact として保持する。
- Firefox / WebKit は週次および手動 dispatch の scheduled scope とする。未実行・失敗は Chromium pass と混同せず、artifact と workflow result で追跡する。
- manual keyboard、representative screen reader、実 browser 200% / 400% zoom、touch / real-device evidence は本 gate で代替せず、`tasks/todo/20260714-issue-345-manual-a11y-evidence.md` の完了まで未達として扱う。

