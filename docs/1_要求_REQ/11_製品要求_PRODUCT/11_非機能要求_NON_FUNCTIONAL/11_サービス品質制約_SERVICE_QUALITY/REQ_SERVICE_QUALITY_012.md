# SQ-012 回答可能性判断品質

- 要件ID: `SQ-012`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（閾値未承認）
- 優先度: S

## 要件

- SQ-012: システムは、回答可能・回答保留・確認質問・人手委譲の判断について、false answer と false refusal を承認済み上限内に保つこと。

## 品質尺度

- measure: correct answer/refusal/clarification/handoff、false answer、false refusal。
- fail point/target: answerability と severity 別に `OQ-RD-005` で決定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-012` |
| 説明 | answerability classification quality |
| 根拠 | 根拠不足時の誤回答と、根拠十分時の過剰拒否を両方防ぐ |
| 源泉 | RAG ガイド §7.5（PDF pp.175–179） |
| Actor / trigger | answerability decision の評価 |
| 種類 | サービス品質制約 / answerability |
| 依存関係 | `FR-005`, `FR-015`, `FR-016`, `FR-075` |
| 衝突 | 安全側の拒否強化は false refusal を増やし得る |
| 受け入れ基準 | `AC-SQ012-001`, `AC-SQ012-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | Business owner / RAG Quality |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ012-001 回答不能

- Given: 正解 label が refusal、clarification、handoff のいずれかである dataset がある
- When: candidate response を評価する
- Then: false answer が approved 上限以下で、正しい非回答行動を選ぶ

### AC-SQ012-002 回答可能

- Given: 許可済みで十分な根拠がある answerable case がある
- When: candidate response を評価する
- Then: false refusal が approved 上限以下である

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 誤回答と過剰拒否を両面管理する |
| 十分性 | OK | answer/refusal/clarification/handoff を含む |
| 理解容易性 | OK | retrieval と generation の尺度から分離した |
| 一貫性 | OK | 回答保留要求を定量化する |
| 標準・契約適合 | OK | 1 要求 1 answerability characteristic |
| 実現可能性 | OK | answerability label 付き dataset で測定可能 |
| 検証可能性 | OK | answerable/unanswerable confusion matrix |
| ニーズ適合 | OK | 答えられる質問を拒否せず、不明を断定しない |
| 実装適合 | OK（confirmed、閾値未承認） | versioned expected/actual answerability/response type から false-answer/false-refusal を導出し、answer/refusal/clarification/handoff の mandatory gate と direct tests を持つ |

## トレース

- 後方: `FR-005`, RAG ガイド §7.5。
- 前方: answerability evaluator、`SQ-007`, `OQ-RD-005`。
