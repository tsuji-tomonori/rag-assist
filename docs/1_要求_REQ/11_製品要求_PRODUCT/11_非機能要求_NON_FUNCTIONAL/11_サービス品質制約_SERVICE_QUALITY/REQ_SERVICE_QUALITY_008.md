# SQ-008 応答時間 SLO

- 要件ID: `SQ-008`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（閾値未承認）
- 優先度: A

## 要件

- SQ-008: システムは、承認済み workload profile における chat、search、ingest の stage 別応答時間 percentile を、承認済み SLO 内に保つこと。

## 品質尺度

- measure: first token、final response、search stage、ingest stage の p50/p95/p99。
- workload: corpus size、ACL distribution、concurrency、document size、dependency latency を version 固定する。
- fail point/target: workload profile ごとに `OQ-RD-006` と既存 `Q-005` で決定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-008` |
| 説明 | workload profile 別の stage latency SLO |
| 根拠 | 利用者待ち時間と取り込み所要時間を再現可能に管理する |
| 源泉 | RAG ガイド §8.5–8.6（PDF pp.198–203） |
| Actor / trigger | production request、load/soak test |
| 種類 | サービス品質制約 / performance |
| 依存関係 | workload profile, observability, `FR-089` |
| 衝突 | authorization prefilter は latency を増やし得るが省略不可 |
| 受け入れ基準 | `AC-SQ008-001`, `AC-SQ008-002` |
| 優先度 | A |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | SRE / Product / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ008-001 workload 測定

- Given: production 相当の corpus、ACL 分布、concurrency、document size、dependency latency profile がある
- When: load/soak/failure test を行う
- Then: stage 別 p50/p95/p99 と sample count を report し、approved latency SLO と比較する

### AC-SQ008-002 profile 不一致

- Given: corpus、ACL 分布、concurrency、document size、dependency latency のいずれかが approved workload profile と異なる
- When: latency 結果を公開判定へ使う
- Then: profile 不一致を明示し、承認済み SLO を満たした結果として扱わない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | chat と ingest の待ち時間を運用品質として管理する |
| 十分性 | OK | stage、percentile、sample、workload version を含む |
| 理解容易性 | OK | reliability、cost、安全縮退を別要求へ分離した |
| 一貫性 | OK | `SQ-014`, `SQ-015`, `FR-089` と重複しない |
| 標準・契約適合 | OK | 1 要求 1 latency characteristic と専用 AC を満たす |
| 実現可能性 | OK | load/soak suite と stage trace で測定可能 |
| 検証可能性 | OK | approved/mismatched workload の比較試験 |
| ニーズ適合 | OK | 利用者の対話待ち時間と運用者の取り込み計画に対応する |
| 実装適合 | OK（measurement contract、閾値未承認） | corpus/ACL/concurrency/document-size/dependency-latency dimensions と chat/search/ingest stage 別 p50/p95/p99/sample gate を実装し、dimension/stage 欠損を unavailable にする |

## トレース

- 後方: `NFR-001`, `SQ-001`, RAG ガイド PDF pp.198–203。
- 前方: latency dashboard/alarm、load suite、`OQ-RD-006`, `FR-075`。
