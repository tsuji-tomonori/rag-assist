# FR-074 再現可能な versioned trace

- 要件ID: `FR-074`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-074`
- 関連カテゴリ: `7. 評価・debug・benchmark`, `8. 認証・認可・管理・監査`

## 要件

- FR-074: システムは、一つの request/run を認証から回答・操作結果まで相関し、同じ条件を再現するために必要な version と判断を記録すること。

## 根拠と意図

RAG の失敗は検索・認可・生成・引用のどこでも起きる。認可 decision、除外件数、policy/model/prompt/index version を同じ trace ID で相関し、データ最小化は `FR-088` の独立制約として適用する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-074` |
| 説明 | RAG decision を再現する versioned trace |
| 根拠 | RAG failure の工程と設定差を特定する |
| 源泉 | RAG ガイド §8.4（PDF pp.195–197）、SWEBOK trace §7.3（PDF pp.60–61） |
| Actor / trigger | API/worker が ingest/search/generation/authorization を実行するとき |
| 種類 | 機能要求 / observability |
| 依存関係 | `FR-056`–`FR-073`, `FR-088`, `FR-092` |
| 衝突 | 現行 debug trace は redactedFields metadata と実データ sanitize が一致しない |
| 受け入れ基準 | `AC-FR074-001`, `AC-FR074-002` |
| 優先度 | A |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | RAG Ops / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR074-001 再現情報

- Given: ingest/search/answer run が完了・拒否・失敗する
- When: authorized operator が trace を確認する
- Then: traceId、actor/tenant の非機微識別、source snapshot、parser/OCR、chunker/chunking-policy、embedding、policy/index/model/prompt/pipeline version、query transformation、candidate/deny counts、decision/reason、latency を相関できる

### AC-FR074-002 version 固定

- Given: 同じ dataset と入力で candidate pipeline の挙動を再現する
- When: trace を replay 用 manifest として参照する
- Then: source snapshot、parser/OCR、chunker/chunking-policy、embedding、policy、index、model、prompt、pipeline、dataset の各 version と非決定要因を識別でき、不明な version を黙って current に置換しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | RAG failure の工程と設定を再現するために必要 |
| 十分性 | OK | request 相関と ingest/retrieval/generation/evaluation を再現する主要 version を含む |
| 理解容易性 | OK | redaction は `FR-088` へ分離した |
| 一貫性 | OK | `FR-046` の trace artifact を詳細化する |
| 標準・契約適合 | OK | SWEBOK の双方向 trace と1主判断に適合 |
| 実現可能性 | OK | 既存 trace schema の version fields を拡張可能 |
| 検証可能性 | OK | replay manifest と missing-version 否定試験 |
| ニーズ適合 | OK | 運用者が再現不能な品質劣化を調査できる |
| 実装適合 | OK（confirmed） | replay manifest が source/parser/OCR/chunker/embedding/auth/index/model/prompt/pipeline/dataset version と missing/nondeterminism を保持し、unknown を current default で補完しない |

## トレース

- 後方: `FR-017`, `FR-046`, `NFR-015`, debug reports。
- 前方: trace schema/replay tests、`FR-075`, `FR-088`。
