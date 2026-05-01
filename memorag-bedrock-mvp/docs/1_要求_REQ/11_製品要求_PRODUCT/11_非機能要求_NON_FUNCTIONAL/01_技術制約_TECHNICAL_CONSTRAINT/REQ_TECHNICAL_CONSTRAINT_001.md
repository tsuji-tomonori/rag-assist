# 要件定義（1要件1ファイル）

- 要件ID: `TC-001`
- 種別: `REQ_TECHNICAL_CONSTRAINT`
- 状態: Draft
- 優先度: A

## 要件

- TC-001: 初期の検索基盤は OpenSearch 完全互換を目指さず、Lambda + TypeScript、S3 Vectors、軽量 lexical retrieval、RRF を組み合わせた RAG 専用 retriever として実装すること。

## 受け入れ条件（この要件専用）

- AC-TC001-001: 初期実装タスクに OpenSearch 互換 query parser、distributed shard 管理、aggregation 実装を含めないこと。
- AC-TC001-002: semantic search は S3 Vectors または local vector store adapter 経由で実行できること。
- AC-TC001-003: lexical retrieval を追加する場合は Lambda の memory、timeout、cold start cache を前提に index サイズを制御すること。
- AC-TC001-004: OpenSearch は高クエリ量、低レイテンシ検索UI、大規模 index が必要になった場合の再評価候補として扱うこと。

## 要件の源泉・背景

- 源泉: ユーザー提示の検索アーキテクチャ方針。
- 背景: 社内RAGの初期段階では、常時稼働検索基盤よりサーバレス従量課金と RAG 専用検索品質を優先する。

## 要件の目的・意図

- 目的: 検索基盤の過剰設計を避け、回答品質に効く範囲へ実装を集中する。
- 意図: OpenSearch の小型コピーではなく、安価な hybrid retriever として段階的に育てる。
- 区分: 技術制約。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `TC-001` |
| 説明 | 初期検索基盤の技術境界 |
| 根拠 | コスト、保守性、MVPの速度を優先するため |
| 源泉 | ユーザー提示方針 |
| 種類 | 技術制約 |
| 依存関係 | S3 Vectors adapter、Lambda runtime、TypeScript codebase |
| 衝突 | 検索UIや高負荷用途では OpenSearch が有利 |
| 受け入れ基準 | `AC-TC001-001` から `AC-TC001-004` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-01 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 実装範囲の肥大化を防ぐ |
| 十分性 | OK | 採用技術と非採用範囲を含む |
| 理解容易性 | OK | OpenSearch 互換を非目標と明示 |
| 一貫性 | OK | 現行 S3 Vectors / local store adapter と整合 |
| 標準・契約適合 | OK | 社内RAG MVP の制約に合う |
| 実現可能性 | OK | 既存構成を前提にできる |
| 検証可能性 | OK | タスク範囲とコード差分で確認可能 |
| ニーズ適合 | OK | コスト効率と段階導入に合う |
