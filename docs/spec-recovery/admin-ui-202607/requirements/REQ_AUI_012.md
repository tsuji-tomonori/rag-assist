# REQ-AUI-012: 端末・支援技術非依存の管理操作

## 要件

管理画面は、主要管理taskを320px viewport、400% zoom、keyboard、承認済みscreen reader、touchで完了可能にしなければならない。

## 要求属性

- 識別子: `REQ-AUI-012`
- 説明: reflow、focus、accessible name/semantics、live status/error、target size、contrast、用語をWCAG 2.2 AA基準で検証する
- 根拠:現行は920px固定行、4列alias、狭いcontrol、不完全table/name/statusと検証欠落がある
- 源泉: `FACT-AUI-003`, `FACT-AUI-065`–`074`; repository UI/a11y policy
- Actor / trigger: admin sectionの閲覧・filter・row action・dialog・mutation
- 種類: service quality / accessibility / usability
- 依存関係:最終panel情報設計、browser/AT support matrix
- 衝突: current horizontal-scroll依存、32–38px controls、mixed/raw labels
- 受け入れ基準: `AC-AUI-135`–`146`
- 優先度: P1
- 安定性: WCAG 2.2 AAと主要taskはstable、support matrixはopen_question
- Confidence: confirmed evidence gap / open_question
- 所有者: Web / Product / Accessibility QA
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-135`: 320pxで二方向scrollなしに主要taskを完了する。
- `AC-AUI-137`: keyboardだけで操作と取消を完了する。
- `AC-AUI-139`: row action名にactionと対象を含める。
- `AC-AUI-141`: loading/error/successを適切に通知する。
- `AC-AUI-145`:承認browser/AT matrixの証跡を残す。

## 妥当性確認

- 必要性:管理権限保持者が端末・障害特性で排除されないために必要
- 十分性: reflow/zoom/input/focus/name/semantics/status/size/contrast/localizationを含む
- 一貫性: WCAG例外を使う場合は根拠と代替を記録する
- 標準・契約適合: WCAG 2.2 AAとrepository mobile-first policy
- 検証可能性:自動scan、browser E2E、manual keyboard/screen reader/zoom evidenceで判定する

## トレース

- Task: `TASK-AUI-012`
- E2E: `E2E-AUI-014`, `E2E-AUI-015`
- Gap: `GAP-AUI-031`, `GAP-AUI-032`, `GAP-AUI-033`, `GAP-AUI-034`, `GAP-AUI-035`
- Specification: `SPEC-AUI-012`
