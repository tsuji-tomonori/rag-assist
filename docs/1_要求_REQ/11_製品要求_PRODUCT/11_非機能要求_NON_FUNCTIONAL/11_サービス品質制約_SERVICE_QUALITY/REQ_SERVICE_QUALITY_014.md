# SQ-014 可用性・復旧 SLO

- 要件ID: `SQ-014`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（閾値未承認）
- 優先度: A

## 要件

- SQ-014: システムは、chat、search、ingest の成功率、timeout/error rate、復旧時間および backlog age を、承認済み可用性・復旧 SLO 内に保つこと。

## 品質尺度

- measure: availability、success/timeout/error rate、retry exhaustion、MTTR、backlog age。
- fail point/target: workload/dependency profile ごとに `OQ-RD-006` と `Q-005` で決定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-014` |
| 説明 | RAG service availability and recovery SLO |
| 根拠 | 一時的成功だけでなく依存障害からの復旧を管理する |
| 源泉 | RAG ガイド §8.5（PDF pp.198–200） |
| Actor / trigger | production monitoring、soak/chaos test |
| 種類 | サービス品質制約 / reliability |
| 依存関係 | `FR-083`, `FR-089`, observability |
| 衝突 | retry 強化は latency/cost を増やし得る |
| 受け入れ基準 | `AC-SQ014-001`, `AC-SQ014-002` |
| 優先度 | A |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | SRE / Product |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ014-001 定常可用性

- Given: approved workload/dependency profile がある
- When: observation window の chat/search/ingest を集計する
- Then: success、timeout、error、backlog age を endpoint/stage 別に報告し、approved SLO 内である

### AC-SQ014-002 復旧

- Given: vector、LLM、OCR、queue の承認済み failure scenario が発生する
- When: dependency が復旧する
- Then: retry exhaustion、reconciliation、MTTR を測定し、重複・消失なく approved recovery SLO 内へ戻る

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 継続利用と障害復旧を保証する |
| 十分性 | OK | availability、error、recovery、backlog を含む |
| 理解容易性 | OK | latency と cost から分離した |
| 一貫性 | OK | ingest recovery と safe degradation を品質面で補完する |
| 標準・契約適合 | OK | 1 要求 1 reliability characteristic |
| 実現可能性 | OK | monitoring と failure injection で測定可能 |
| 検証可能性 | OK | soak/chaos/recovery test |
| ニーズ適合 | OK | 利用者と運用者が予測可能にサービスを利用できる |
| 実装適合 | partial | timeout はあるが versioned SLO と recovery gate が不足 |

## トレース

- 後方: `NFR-001`, RAG ガイド §8.5。
- 前方: availability dashboard、chaos suite、`OQ-RD-006`。
