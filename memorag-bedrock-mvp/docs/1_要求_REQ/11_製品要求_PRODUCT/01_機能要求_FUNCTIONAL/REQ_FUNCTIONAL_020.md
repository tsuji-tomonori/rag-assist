# 要件定義（1要件1ファイル）

- 要件ID: `FR-020`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: B

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2機能群:
  - `1.5 多抽象度メモリ生成`
- L3要件: `FR-020`
- 関連カテゴリ:
  - `3. RAG検索品質制御（3.5 検索補助メモリ）`

## 要件

- FR-020: ingestion は raw chunk とは別に、section、document、concept の各抽象度の memory record を生成できること。

## 受け入れ条件（この要件専用）

- AC-FR020-001: raw chunk は最終回答の引用根拠として維持されること。
- AC-FR020-002: section、document、concept memory は検索補助として扱われること。
- AC-FR020-003: 高抽象度 memory hit から raw chunk へ drill-down できる親子関係を保持すること。
- AC-FR020-004: ACL、tenant、source などの絞り込みメタデータが抽象度をまたいで維持されること。

## 要件の源泉・背景

- 源泉: ユーザー提示の RAPTOR / GraphRAG / S3 Vectors 多抽象度方針、現行 `memorag-service.ts` の実装確認。
- 背景: 現行 ingestion は chunk と document-level memory card が中心であり、section や cross-domain concept の抽象度を明示的には扱っていない。

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
| 変更履歴 | 2026-05-01 初版 |

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
