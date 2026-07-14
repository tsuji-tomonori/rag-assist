# SQ-011 引用品質

- 要件ID: `SQ-011`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（閾値未承認）
- 優先度: S

## 要件

- SQ-011: システムは、回答引用の precision と、支持が必要な claim に対する citation completeness を、承認済み引用品質閾値内に保つこと。

## 品質尺度

- measure: citation precision、citation completeness、locator validity。
- fail point/target: use case と重大度別に `OQ-RD-005` で決定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-011` |
| 説明 | claim と citation の対応品質 |
| 根拠 | 引用が存在するだけで支持根拠として正しいとは限らない |
| 源泉 | RAG ガイド §7.4（PDF pp.168–174） |
| Actor / trigger | answer/citation candidate の評価 |
| 種類 | サービス品質制約 / citation |
| 依存関係 | `FR-004`, `FR-073`, `FR-075` |
| 衝突 | 引用数の増加は precision を下げ得る |
| 受け入れ基準 | `AC-SQ011-001`, `AC-SQ011-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | RAG Quality / Product |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ011-001 precision

- Given: claim と正解 span/locator を注釈した dataset がある
- When: 出力 citation を評価する
- Then: citation precision と locator validity が approved fail point 以上である

### AC-SQ011-002 completeness

- Given: 外部根拠を必要とする複数 claim を含む回答がある
- When: claim ごとの citation coverage を評価する
- Then: citation completeness が approved fail point 以上で、無関係な引用で未支持 claim を埋めない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 利用者が根拠を検証できる品質を保証する |
| 十分性 | OK | 正確さ、網羅性、locator を含む |
| 理解容易性 | OK | answer faithfulness と引用対応を分離した |
| 一貫性 | OK | `FR-004`, `FR-073` を定量化する |
| 標準・契約適合 | OK | 1 要求 1 citation quality characteristic |
| 実現可能性 | OK | claim/span annotation で測定可能 |
| 検証可能性 | OK | missing/wrong/valid citation fixture |
| ニーズ適合 | OK | 回答根拠を原文へ遡れる |
| 実装適合 | OK（measurement/gate contract、閾値未承認） | claim↔citation ID、relevance/support/locator から precision/completeness/validity と required-claim miss zero-tolerance count を導出し、無関係 citation の代用を拒否する |

## トレース

- 後方: `FR-004`, RAG ガイド §7.4。
- 前方: citation evaluator、`SQ-007`, `OQ-RD-005`。
