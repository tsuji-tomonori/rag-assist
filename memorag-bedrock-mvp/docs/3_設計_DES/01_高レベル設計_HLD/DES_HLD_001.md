# MemoRAG MVP 高レベル設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- 種別: `DES_HLD`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

アーキテクチャで定義した RAG 構造を、実装可能なサブシステムと責務へ分解する。

## 対象範囲

- 文書取り込み
- memory/evidence record 生成
- 質問応答 workflow
- answerability gate
- citation validation
- debug trace
- conversation history
- benchmark evaluation

## コンポーネント

| コンポーネント | 入力 | 出力 | 関連要求 |
| --- | --- | --- | --- |
| Ingestion Handler | fileName、text、metadata | documentId、manifest | `FR-001`, `FR-002` |
| Memory Builder | source text、document metadata | memory record、evidence chunk | `FR-002`, `FR-020` |
| Query Orchestrator | question、settings、user context | answer/refusal、citations、metadata | `FR-003`, `FR-005` |
| Retriever | query/clue、filters | candidate chunks | `FR-016`, `FR-018`, `TC-001` |
| Retrieval Evaluator | candidates、required facts | next action、reason | `FR-016`, `FR-017` |
| Answerability Gate | question、evidence | answerability label、reason | `FR-014` |
| Answer Generator | question、supported evidence | grounded answer | `FR-003`, `FR-004` |
| Citation Validator | answer、candidate chunks | supported/unsupported claims | `FR-015` |
| Debug Trace Store | workflow events | run trace | `FR-010`, `NFR-005`, `NFR-006` |
| Conversation History Store | userId、conversation item | user-scoped conversation list | `FR-010`, `NFR-005` |
| Benchmark Runner | dataset case | result、summary、report | `FR-012`, `FR-019`, `SQ-001` |

## 責務分担

- Query Orchestrator は workflow の順序制御に集中し、検索、判定、生成、引用検証の個別ロジックを直接抱え込まない。
- Retriever は検索候補の取得に集中し、回答生成や引用文の作成を行わない。
- Answerability Gate は回答してよいかを判定し、回答文を生成しない。
- Citation Validator は回答後の主要文が引用 chunk に支持されているかを検証する。
- Conversation History Store は画面の会話履歴をユーザー単位で永続化し、履歴 item の schema version を保持する。
- Benchmark Runner は UI と独立して同等の質問評価を実行する。

## 主要フロー

1. API は認可と入力検証を行う。
2. Query Orchestrator は質問を正規化し、clue を生成する。
3. Retriever は memory/evidence index から候補を取得する。
4. RRF Rank Fusion は複数候補を統合する。
5. Retrieval Evaluator は十分な候補があるかを判断し、再検索、query rewrite、拒否のいずれかを選ぶ。
6. Answerability Gate は evidence だけで回答可能かを判定する。
7. Answer Generator は回答可能な場合だけ回答を生成する。
8. Citation Validator は回答文と引用 chunk の支持関係を検証する。
9. API は回答または拒否結果と trace metadata を返す。
10. Web UI は会話履歴 item を `schemaVersion` 付きで保存 API に送信する。
11. API は userId で会話履歴を分離し、本番環境では DynamoDB に保存する。

## アーキテクチャ判断との関係

- `ARC_ADR_001`: サーバレス RAG と guard 付き pipeline の採用。
- `ARC_QA_001`: 根拠性、不回答品質、検索品質、セキュリティを品質属性として扱う。
