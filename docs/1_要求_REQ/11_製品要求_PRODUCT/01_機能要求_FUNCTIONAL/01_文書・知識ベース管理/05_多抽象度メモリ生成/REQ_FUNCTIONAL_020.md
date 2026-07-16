# 要件定義（1要件1ファイル）

- 要件ID: `FR-020`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft（実装・直接 behavior test 確認済み）
- 優先度: B

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.5 多抽象度メモリ生成`
- L3要件: `FR-020`
- 関連カテゴリ:
  - `3. RAG検索品質制御`


## 要件

- FR-020: ingestion は raw chunk とは別に、section、document、concept の各抽象度の memory record を生成できること。

## 受け入れ条件（この要件専用）

- [x] AC-FR020-001: raw chunk は evidence vector として維持され、memory record と分離されること。
- [x] AC-FR020-002: section、document、concept memory は `kind: memory` の検索補助 record として永続化されること。
- [x] AC-FR020-003: 高抽象度 memory は `sourceChunkIds` と section metadata により raw chunk へ drill-down できる関係を保持すること。
- [x] AC-FR020-004: tenant、source、docType、department と source locator metadata が抽象度をまたいで維持されること。ACL/認可境界は derived security envelope と検索時認可で維持すること。

## 要件の源泉・背景

- 源泉: ユーザー提示の RAPTOR / GraphRAG / S3 Vectors 多抽象度方針、現行 `memorag-service.ts` の実装確認。
- 背景: 現行 ingestion は raw chunk に加えて `MemoRagService.createMemoryCards`、`createSectionMemoryCards`、`createConceptMemoryCards` から document/section/concept memory を生成し、memory ledger と memory vector に保存する。

## 要件の目的・意図

- 目的: ピンポイントQAだけでなく、文書探索、俯瞰質問、他分野探索へ対応しやすくする。
- 意図: RAPTOR 風の多抽象度検索を軽量に導入し、最終根拠は raw evidence に限定する。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-020` |
| 説明 | 複数抽象度の memory record を生成する |
| 根拠 | 俯瞰検索と他分野探索には raw chunk だけでは不足しやすい |
| 源泉 | ユーザー提示方針、現行コード調査 |
| 種類 | 機能要求 |
| 依存関係 | ingestion、vector metadata、manifest |
| 衝突 | storage と embedding コストが増える |
| 受け入れ基準 | `AC-FR020-001` から `AC-FR020-004` |
| 優先度 | B |
| 安定性 | Low |
| 変更履歴 | 2026-05-01 初版。2026-07-16 public ingest の実装・直接 behavior test に同期 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 将来の俯瞰検索に有効 |
| 十分性 | OK | 抽象度、根拠限定、親子関係を含む |
| 理解容易性 | OK | memory record の役割が明確 |
| 一貫性 | OK | memory/evidence 分離方針と合う |
| 標準・契約適合 | OK | raw evidence 根拠方針に合う |
| 実現可能性 | OK | ingestion 拡張で実装可能 |
| 検証可能性 | OK | manifest と検索結果で確認可能 |
| ニーズ適合 | OK | 中長期の検索価値に対応 |

## 実装・検証トレース

- `confirmed`: `apps/api/src/rag/memorag-service.ts` の `MemoRagService.createMemoryCards`、`createSectionMemoryCards`、`createConceptMemoryCards`。
- `confirmed`: `apps/api/src/rag/offline/pre-retrieval/ingestion/ingest-run.service.ts` が raw evidence vector と memory vector を分離し、memory ledger、`sourceChunkIds`、filter metadata、security envelope を保存する。
- `confirmed`: `apps/api/src/rag/multi-abstraction-memory.test.ts` は public `MemoRagService.ingest` 経路から document/section/concept、raw chunk trace、section metadata、tenant/source/docType/department、evidence/memory 分離、memory/evidence security envelope の tenant/document/version/authorization/source locator を直接検証する。
- `confirmed`: `apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts` は memory hit に ordinary deny、継承 allow、明示 private、benchmark tenant/corpus filter を適用する検索時認可を検証する。
- `conflict`: 旧 coverage の `memorag-service.test.ts` は memory ledger key の存在、`adapters/local-stores.test.ts` は generic memory record だけを確認しており、本要件の直接 behavior test ではなかったため差し替えた。
- `open_question`: なし。
