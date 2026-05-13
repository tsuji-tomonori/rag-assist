# 要件定義（1要件1ファイル）

- 要件ID: `SQ-004`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft
- 優先度: B

## 要件

- SQ-004: チャット画面は、回答、引用、debug panel、loading 表示が互いに重ならない状態を維持すること。

## 受け入れ条件（この要件専用）

- AC-SQ004-001: 回答本文と引用表示は、通常表示時に互いの内容を読めない形で重ならないこと。
- AC-SQ004-002: loading または streaming 表示は、既存回答や入力欄の操作対象を覆い続けないこと。
- AC-SQ004-003: debug panel が表示される場合、回答本文と引用表示の主要情報を隠さず確認できること。
- AC-SQ004-004: 画面幅が変わっても、主要操作の button text、icon、状態表示が親要素からはみ出さないこと。

## 要件の源泉・背景

- 源泉: `docs/spec-recovery/06_requirements.md` の `REQ-UI-001`
- 源泉: `docs/spec-recovery/03_acceptance_criteria.md` の `AC-UI-001`
- 源泉: `docs/spec-recovery/07_specifications.md` の `SPEC-UI-001`
- 背景: 復元条件では、回答、引用、debug panel、loading 表示が互いに重ならないことが求められている。

## 要件の目的・意図

- 目的: chat UI の状態表示が重なって、回答確認や操作を妨げることを防ぐ。
- 意図: UI 操作そのものは機能要求へ、表示安定性はサービス品質制約へ分けて管理する。
- 区分: サービス品質制約。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `SQ-004` |
| 説明 | chat UI の表示要素非重なり |
| 根拠 | RAG 回答、引用、debug 情報を同時に扱う画面では layout 破綻が検証性と利用性を下げる |
| 源泉 | `REQ-UI-001`, `AC-UI-001`, `SPEC-UI-001` |
| 種類 | サービス品質制約 |
| 依存関係 | `FR-003`, `FR-004`, `FR-009`, `FR-041`, `FR-042` |
| 衝突 | 情報量が多い debug 表示では画面密度との調整が必要 |
| 受け入れ基準 | `AC-SQ004-001` から `AC-SQ004-004` |
| 優先度 | B |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/07_チャットUI操作性/REQ_FUNCTIONAL_041.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/07_チャットUI操作性/REQ_FUNCTIONAL_042.md`
