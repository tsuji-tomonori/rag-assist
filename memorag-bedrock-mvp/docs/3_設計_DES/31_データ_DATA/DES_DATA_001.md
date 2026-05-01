# MemoRAG MVP データ設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md`
- 種別: `DES_DATA`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

RAG workflow、文書管理、検索、引用、評価、debug trace で扱う主要データを定義する。

## データモデル

### Document

| 項目 | 内容 |
| --- | --- |
| `documentId` | 文書識別子 |
| `fileName` | 登録時のファイル名 |
| `sourceUri` | S3 またはローカル保存先 |
| `createdAt` | 登録日時 |
| `metadata` | 任意メタデータ |

### EvidenceChunk

| 項目 | 内容 |
| --- | --- |
| `chunkId` | chunk 識別子 |
| `documentId` | 親文書 |
| `text` | 根拠候補本文 |
| `sectionPath` | 見出し階層 |
| `tokenCount` | token 概算 |
| `embeddingId` | vector record 識別子 |

### MemoryRecord

| 項目 | 内容 |
| --- | --- |
| `memoryId` | memory record 識別子 |
| `documentId` | 親文書 |
| `level` | `chunk` / `section` / `document` / `concept` |
| `summary` | 検索補助用の要約または概念 |
| `sourceChunkIds` | 原典 raw chunk への参照 |

### RetrievalResult

| 項目 | 内容 |
| --- | --- |
| `queryId` | 質問実行識別子 |
| `chunkId` | evidence chunk |
| `rank` | 統合後順位 |
| `vectorScore` | vector search score |
| `lexicalScore` | lexical search score |
| `rrfScore` | rank fusion score |
| `sourceQuery` | 検索に使った clue または query |

### GeneratedAnswer

| 項目 | 内容 |
| --- | --- |
| `queryId` | 質問実行識別子 |
| `answer` | 回答本文 |
| `answerability` | `ANSWERABLE` / `PARTIAL` / `UNANSWERABLE` |
| `citations` | citation 配列 |
| `modelId` | 回答生成モデル |
| `promptVersion` | prompt template version |

### EvaluationResult

| 項目 | 内容 |
| --- | --- |
| `caseId` | 評価ケース識別子 |
| `queryId` | 実行識別子 |
| `factCoverage` | 期待 fact の網羅率 |
| `faithfulness` | 根拠忠実性 |
| `contextRelevance` | 検索文脈の関連度 |
| `refusalCorrectness` | 不回答判定の正しさ |

## 保持と保護

- source と manifest は文書削除時に削除対象とする。
- debug trace は `NFR-006` に従い、調査用ログとして 1 週間保持を基本とする。
- benchmark/debug 系 API の参照データは `NFR-010` に従い認可対象とする。
- memory record の高抽象度要約は検索補助であり、最終回答の引用根拠には使わない。

## 関連要求

- `FR-002`, `FR-004`, `FR-010`, `FR-015`, `FR-019`, `FR-020`
- `NFR-004`, `NFR-005`, `NFR-006`, `NFR-010`
