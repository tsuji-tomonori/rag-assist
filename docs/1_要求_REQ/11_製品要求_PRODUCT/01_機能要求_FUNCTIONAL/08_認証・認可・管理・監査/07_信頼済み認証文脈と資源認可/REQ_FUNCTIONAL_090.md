# FR-090 長時間処理の current authorization 再評価

- 要件ID: `FR-090`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-090`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `3. RAG検索品質制御`, `7. 評価・debug・benchmark`

## 要件

- FR-090: システムは、queue 待機または長時間実行する処理について、開始時と保護対象の読み取り・外部副作用・永続 commit の直前に、authoritative な account、tenant、role、resource policy から current authorization を再構築し、submit 時 snapshot だけでは許可しないこと。

## 根拠と意図

submit 時に正当だった処理でも、開始・commit までに account suspension、role revoke、share revoke、resource delete が発生し得る。認可の鮮度を処理境界ごとに再確認し、失効後の本文取得や永続化を防ぐ。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-090` |
| 説明 | queued/long-running work の current authorization freshness invariant |
| 根拠 | submit 後の account/role/resource 変更を stale snapshot が迂回することを防ぐ |
| 源泉 | RAG ガイド §8.1.7（PDF pp.188–189）、`GAP-RD-011`、current worker audit |
| Actor / trigger | chat/ingest/benchmark/agent worker が開始、保護対象を読む、外部副作用または durable commit を行うとき |
| 種類 | 機能要求 / authorization / async lifecycle |
| 依存関係 | `FR-056`, `FR-057`, `FR-058`, `FR-060`, `FR-066`, `FR-079`, `FR-080`, `SQ-006` |
| 衝突 | 現行 worker は submit 時の `user.groups` snapshot を run payload から再利用する |
| 受け入れ基準 | `AC-FR090-001`, `AC-FR090-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / Worker Platform / RAG Platform |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR090-001 開始時の再評価

- Given: submit 後、worker 開始前に account、tenant membership、role、resource grant のいずれかが失効した run がある
- When: worker が run を開始する
- Then: current authoritative context と policy で拒否し、submit 時 snapshot を使って保護対象を読まず、非成功の `permission_revoked` 相当状態を記録する

### AC-FR090-002 実行中変更の再評価

- Given: worker 開始後、保護対象の追加読み取り、外部副作用、または durable commit 前に account/role/grant/delete state が変化する
- When: worker がその境界へ到達する
- Then: current authorization を再評価し、失効していれば本文追加・副作用・成功 commit を行わず、安全な中断と reconciliation を選ぶ

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | queue wait と長時間実行中の権限失効を強制するために必要 |
| 十分性 | OK | start、protected read、external side effect、durable commit の境界を含む |
| 理解容易性 | OK | submit snapshot 禁止と current source の再構築を明示した |
| 一貫性 | OK | account 変更は `FR-058`、resource revoke は `FR-066`、role mutation は `FR-080` に分離した |
| 標準・契約適合 | OK | complete mediation と time-of-check/time-of-use 対策の一つの invariant を規定する |
| 実現可能性 | OK | worker principal ID から identity/policy service を再照会して実現可能 |
| 検証可能性 | OK | submit/start/read/commit 間に各 revoke を挿入する race matrix で確認できる |
| ニーズ適合 | OK | 管理者・owner の失効操作が待機中処理にも実効的に反映される |
| 原子性 | OK | 長時間処理の認可鮮度という一つの判断を規定する |
| 実装適合 | NG | worker が submit 時の group snapshot を再利用する経路が残る |

## トレース

- 後方: `GAP-RD-001`, `GAP-RD-011`, RAG ガイド PDF pp.188–189。
- 前方: worker context resolver、start/read/commit reauthorization tests、`SQ-006`, `E2E-AUTH-003`, `E2E-SHARE-004`。
