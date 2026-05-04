# 要件定義（1要件1ファイル）

- 要件ID: `FR-023`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.5 検索alias管理`
- L3要件: `FR-023`
- 関連カテゴリ:
  - `8. 認証・認可・管理・監査`


## 要件

- FR-023: システムは検索 alias を tenant、source、docType、ACL scope を持つ versioned artifact として管理できること。

## 受け入れ条件（この要件専用）

- AC-FR023-001: alias 定義は `aliasId`、`type`、`from`、`to`、`scope`、`status`、`reason`、`createdBy`、`reviewedBy`、`version` を保持できること。
- AC-FR023-002: active alias だけが ingestion または batch により lexical index へ反映されること。
- AC-FR023-003: search runtime は request 中に alias 定義を生成または更新しないこと。
- AC-FR023-004: index manifest は `aliasVersion` と `indexVersion` の対応を保持できること。
- AC-FR023-005: alias の可視範囲は検索対象 document の tenant、source、docType、ACL scope を超えないこと。
- AC-FR023-006: alias 追加、review、disable、publish は audit log に記録できること。

## 要件の源泉・背景

- 源泉: 2026-05-02 の alias 管理見直し指示、現行 `POST /search` 実装、Elasticsearch Synonyms API、Solr Managed Synonym Graph Filter、Algolia Synonyms、OpenSearch custom dictionary package、S3 Vectors metadata filtering、Weaviate/Pinecone multitenancy docs。
- 背景: alias は検索品質だけでなく、tenant 分離、ACL、監査、index 再現性、rollback に影響する検索データである。
- 背景: 現行 MVP は manifest metadata 由来 alias に加え、専用 artifact、管理 API、review、audit log、publish、管理 UI からの操作を備える。

## 要件の目的・意図

- 目的: alias を runtime の定数ではなく、index lifecycle と対応する管理対象データとして扱う。
- 意図: scoped alias により部署・文書種別ごとの意味差を保ち、全社共通辞書による precision 低下を避ける。
- 意図: review と audit により、悪意ある alias や誤設定 alias が retrieval を誘導するリスクを下げる。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-023` |
| 説明 | scoped / versioned alias artifact 管理 |
| 根拠 | 検索エンジン実務では synonym/alias が管理対象 resource として扱われる |
| 源泉 | 2026-05-02 alias 管理見直し、公式検索サービス docs、RAG security 研究 |
| 種類 | 機能要求 |
| 依存関係 | ingestion、batch、lexical index、index manifest、RBAC、audit log |
| 衝突 | 即時 runtime 反映より batch 反映を優先するため反映 latency が発生する |
| 受け入れ基準 | `AC-FR023-001` から `AC-FR023-006` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-02 初版、2026-05-03 alias 管理 API/UI 実装状況を反映 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | alias は検索結果と権限境界に影響する |
| 十分性 | OK | artifact、scope、lifecycle、manifest 対応、audit を含む |
| 理解容易性 | OK | alias 管理の責務を検索 runtime から分離している |
| 一貫性 | OK | 現行 BM25 + vector + RRF 方針と矛盾しない |
| 標準・契約適合 | OK | Synonyms API、managed resource、custom dictionary lifecycle の実務に合う |
| 実現可能性 | OK | まず S3 object + manifest + batch で段階導入できる |
| 検証可能性 | OK | aliasVersion/indexVersion と benchmark で再現性を検証できる |
| ニーズ適合 | OK | production 運用で必要な review、rollback、監査に対応する |

## 関連文書

- `3_設計_DES/11_詳細設計_DLD/DES_DLD_003.md`
- `3_設計_DES/31_データ_DATA/DES_DATA_001.md`
