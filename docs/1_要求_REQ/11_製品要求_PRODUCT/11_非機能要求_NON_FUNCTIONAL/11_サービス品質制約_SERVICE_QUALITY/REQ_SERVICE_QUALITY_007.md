# SQ-007 工程別 RAG 品質プロファイル

- 要件ID: `SQ-007`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（閾値未承認）
- 優先度: S

## 要件

- SQ-007: RAG の各公開候補は、承認済みで versioned な品質プロファイルが参照する必須の原子的品質制約を、重要 slice ごとにすべて満たすこと。

## 品質尺度

- profile: profile ID/version、dataset version、必須 `SQ-009`–`SQ-013`、slice、重大度、閾値、承認者。
- conjunction: 必須制約の一件でも fail または未測定なら profile 全体を pass にしない。
- fail point/target: use case と重大度 slice ごとに `OQ-RD-005` で決定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-007` |
| 説明 | 原子的品質制約を束ねる versioned promotion profile |
| 根拠 | 総合平均で一工程または重要 slice の失敗を隠さない |
| 源泉 | RAG ガイド §7.1–7.6（PDF pp.156–185） |
| Actor / trigger | RAG candidate の evaluation/promotion |
| 種類 | サービス品質制約 / RAG quality |
| 依存関係 | `FR-075`, `SQ-005`, `SQ-009`–`SQ-013` |
| 衝突 | 既存 `SQ-001` は複数尺度を一要求に集約する |
| 受け入れ基準 | `AC-SQ007-001`, `AC-SQ007-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | Business owner / RAG Quality / QA |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ007-001 完全な profile

- Given: approved dataset version と品質 profile version がある
- When: candidate pipeline を評価する
- Then: profile が参照する各 SQ、question type、tenant/role、OCR/language、multi-evidence、answerability、severity の必須 slice を同じ run で報告する

### AC-SQ007-002 non-regression

- Given: 全体平均は改善したが、必須 SQ/slice が fail point 未満、未測定、または閾値未承認である
- When: promotion gate を評価する
- Then: 平均で相殺せず不合格にし、閾値未承認なら合格済みと記録しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 工程別失敗を総合平均で相殺させない |
| 十分性 | OK | profile、dataset、slice、閾値、承認を参照する |
| 理解容易性 | OK | 個別尺度を `SQ-009`–`SQ-013` へ分離した |
| 一貫性 | OK | `FR-075` の promotion gate を定量化する |
| 標準・契約適合 | OK | 品質 profile という1つの合否 decision を規定する |
| 実現可能性 | OK | versioned benchmark manifest で評価可能 |
| 検証可能性 | OK | missing metric、failed slice、unapproved threshold の否定試験 |
| ニーズ適合 | OK | 利用者が必要とする検索・根拠・引用・回答判断を同時に守る |
| 実装適合 | partial | 一部 metric はあるが executable gate/slice 完備ではない |

## トレース

- 後方: `SQ-001`, RAG ガイド §7。
- 前方: benchmark profile、`FR-075`, `SQ-009`–`SQ-013`, `OQ-RD-005`。
