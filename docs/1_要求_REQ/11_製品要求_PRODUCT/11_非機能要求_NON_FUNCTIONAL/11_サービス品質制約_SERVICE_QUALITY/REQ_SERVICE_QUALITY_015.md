# SQ-015 単位処理コスト上限

- 要件ID: `SQ-015`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（閾値未承認）
- 優先度: A

## 要件

- SQ-015: システムは、承認済み workload と品質 profile における request、run、document 当たりの model・storage・worker コストを、承認済み単位コスト上限内に保つこと。

## 品質尺度

- measure: request/run/document 当たり model token、embedding、storage、worker、egress の推定または実績コスト。
- fail point/target: workload/region/price version ごとに `OQ-RD-006` と `Q-005` で決定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-015` |
| 説明 | quality-preserving unit cost ceiling |
| 根拠 | 品質・安全制御を維持した運用可能性を判定する |
| 源泉 | RAG ガイド §8.6（PDF pp.201–203） |
| Actor / trigger | benchmark、cost review、promotion |
| 種類 | サービス品質制約 / cost efficiency |
| 依存関係 | `SQ-005`, `SQ-007`–`SQ-014`, price profile |
| 衝突 | コスト削減で品質・安全制御を落としてはならない |
| 受け入れ基準 | `AC-SQ015-001`, `AC-SQ015-002` |
| 優先度 | A |
| 安定性 | Low |
| Confidence | inferred |
| 所有者 | Product / FinOps / RAG Ops |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ015-001 単位コスト

- Given: approved workload、quality profile、region、price version がある
- When: representative run を評価する
- Then: component 別と合計の単位コストを算出し、approved ceiling 以下である

### AC-SQ015-002 安全・品質との同時合格

- Given: 低コスト candidate が単位上限を満たす
- When: promotion を評価する
- Then: `SQ-005`, `SQ-007`–`SQ-014` の必須 gate も満たす場合だけ cost 合格を採用し、制御省略による削減を認めない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 継続運用可能な費用境界が必要 |
| 十分性 | OK | 単位、component、workload、price version を含む |
| 理解容易性 | OK | latency/reliability から分離した |
| 一貫性 | OK | 安全・品質 gate を前提にして競合を解く |
| 標準・契約適合 | OK | 1 要求 1 cost characteristic |
| 実現可能性 | OK | usage trace と price profile で算出可能 |
| 検証可能性 | OK | representative workload の cost report |
| ニーズ適合 | OK | 品質を犠牲にせず予算内運用を判断できる |
| 実装適合 | partial | usage は一部あるが価格 version と gate が不足 |

## トレース

- 後方: `FR-019`, RAG ガイド §8.6。
- 前方: cost profile/report、`OQ-RD-006`, promotion gate。
