# 要件定義（1要件1ファイル）

- 要件ID: `FR-026`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 要件

- FR-026: システムは通常のチャット回答経路の evidence 検索で、軽量 lexical retrieval、S3 Vectors semantic search、RRF を統合した hybrid retriever を使用すること。

## 受け入れ条件（この要件専用）

- AC-FR026-001: `search_evidence` は vector store への直接検索ではなく、`POST /search` と同等の hybrid retriever 実装を呼び出すこと。
- AC-FR026-002: evidence 候補は lexical result と semantic result を chunk key で重複排除し、RRF または同等の順位融合で統合されること。
- AC-FR026-003: チャット回答経路の retrieval は `AppUser` または同等の利用者 context を受け取り、ACL guard を適用すること。
- AC-FR026-004: debug trace の検索 step は query 数、index/alias version 情報、lexical/semantic/fused 件数、source 件数を含む retrieval diagnostics を記録できること。

## 要件の源泉・背景

- 源泉: 2026-05-02 の全文検索実装見直し指示、現行 `POST /search` hybrid retriever、agent `search_evidence` 実装。
- 背景: Athena は検索基盤の裏側の分析や batch 生成には向くが、通常チャットの本線検索 API としては latency と scan 型課金の制約がある。
- 背景: 通常チャットの回答品質を上げるには、固有名詞・略語・エラーコードに強い lexical retrieval と、言い換えに強い semantic search を同一 retrieval path で扱う必要がある。

## 要件の目的・意図

- 目的: `POST /search` で実装した全文検索強化を、評価用または補助 API に閉じず、通常の RAG 回答経路に反映する。
- 意図: OpenSearch を初期導入しなくても、BM25/n-gram/fuzzy/alias と S3 Vectors を RRF で統合し、回答候補生成の recall と説明可能性を上げる。
- 意図: 検索診断を trace に残し、Recall@k、zero-hit、ACL 漏えい、alias version 差分の調査を可能にする。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-026` |
| 説明 | チャット回答経路への hybrid retriever 統合 |
| 根拠 | 通常回答経路が vector-only のままだと、全文検索改善が実運用の回答品質へ反映されない |
| 源泉 | 2026-05-02 全文検索実装見直し、agent integration 実装 |
| 種類 | 機能要求 |
| 依存関係 | `FR-016`, `FR-017`, `FR-018`, `FR-023`, `NFR-012`, `TC-001`, `SQ-001` |
| 衝突 | hybrid retrieval により latency と trace 情報量が増える |
| 受け入れ基準 | `AC-FR026-001` から `AC-FR026-004` |
| 優先度 | S |
| 安定性 | Medium |
| 変更履歴 | 2026-05-02 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 本懐である全文検索改善を通常チャットに接続する |
| 十分性 | OK | 実装共有、融合、ACL、trace diagnostics を含む |
| 理解容易性 | OK | `search_evidence` と `POST /search` の関係を明示している |
| 一貫性 | OK | `TC-001` の Lambda + S3 Vectors + 軽量 lexical retrieval 方針に合う |
| 標準・契約適合 | OK | RAG 候補生成として BM25/vector/RRF を組み合わせる設計に合う |
| 実現可能性 | OK | 既存 hybrid retriever を agent node から再利用できる |
| 検証可能性 | OK | agent unit test と trace diagnostics で確認できる |
| ニーズ適合 | OK | Athena を限定用途に留め、通常検索品質を改善する指示に合う |

## 関連文書

- `2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md`
- `2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_001.md`
- `3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_002.md`
- `3_設計_DES/31_データ_DATA/DES_DATA_001.md`
