# 作業完了レポート

保存先: `reports/working/20260502-1208-search-api-hybrid-retriever.md`

## 1. 受けた指示

- 作業用 worktree を作成し、`main` 向けの変更として検索用 API を実装する。
- OpenSearch 互換ではなく、RAG 用の低コスト hybrid retriever として BM25 / fuzzy / prefix / n-gram、S3 Vectors、RRF、ACL/metadata filter を組み合わせる。
- エージェント側への取り込みは次回予定のため、今回は API 実装を主対象にする。
- 実装後に git commit し、GitHub App を利用して `main` 宛て PR を作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | worktree を作成して作業する | 高 | 対応 |
| R2 | 検索 API を追加する | 高 | 対応 |
| R3 | BM25 / prefix / fuzzy / n-gram と vector search を融合する | 高 | 対応 |
| R4 | S3 Vectors 側で使える metadata filter を拡張する | 高 | 対応 |
| R5 | ACL を考慮して権限外文書を結果から除外する | 高 | 対応 |
| R6 | エージェント側への組み込みは行わない | 中 | 対応 |
| R7 | 検証後に commit と PR 作成まで行う | 高 | 対応予定 |

## 3. 検討・判断したこと

- 既存の `MemoRagService`、`ObjectStore`、`VectorStore`、`TextModel` を再利用し、検索 API を既存 API の境界に合わせた。
- 初期実装では、取り込み済み manifest と source text から lexical index を warm cache し、BM25 検索と S3 Vectors/ローカル vector search を RRF で融合する方針にした。
- 日本語検索は外部依存を増やさず、NFKC 正規化、CJK 2-gram/3-gram、alias、prefix、英数字 fuzzy を組み合わせる MVP とした。
- ACL は manifest/vector metadata の `aclGroups`、`allowedGroups`、`aclGroup`、`allowedUsers`、`userIds` を確認し、`SYSTEM_ADMIN` を除いて一致しない結果を除外する保険を入れた。
- S3 Vectors の filterable metadata として `tenantId`、`department`、`source`、`docType`、`aclGroup` を vector metadata に引き継ぐようにした。

## 4. 実施した作業

- `POST /search` を追加し、OpenAPI schema と認証/権限チェックを接続した。
- `search/hybrid-search.ts` に BM25、query tokenization、prefix/fuzzy/n-gram 拡張、RRF、cheap rerank、ACL/metadata filter を実装した。
- `VectorFilter`、`S3VectorsStore`、`LocalVectorStore` を metadata filter 対応に拡張した。
- 文書取り込み時に検索用の filterable metadata を vector metadata へ保存するようにした。
- API 契約テストへ `/search` の正常系を追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.ts` | TypeScript | RAG 用 hybrid retriever 実装 | 検索 API 中核に対応 |
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | `POST /search` ルート追加 | API 実装に対応 |
| `memorag-bedrock-mvp/apps/api/src/schemas.ts` | TypeScript | Search request/response schema 追加 | OpenAPI 契約に対応 |
| `memorag-bedrock-mvp/apps/api/src/adapters/*vector-store.ts` | TypeScript | metadata filter 拡張 | S3 Vectors/ローカル検索に対応 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | search method と vector metadata 拡張 | 既存 service 境界に対応 |
| `memorag-bedrock-mvp/apps/api/src/contract/api-contract.test.ts` | TypeScript | `/search` contract test 追加 | 検証に対応 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.5 / 5 | 検索 API、hybrid fusion、metadata/ACL、worktree 作業に対応した。エージェント取り込みは指示通り未実施。 |
| 制約遵守 | 4.5 / 5 | 既存構造に合わせ、Git/PR/レポート指示を反映した。 |
| 成果物品質 | 4.0 / 5 | MVP として動作確認済み。kuromoji.js や永続 lexical index 生成は次段階の改善余地。 |
| 説明責任 | 4.5 / 5 | 採用方針、未対応、検証内容を明記した。 |
| 検収容易性 | 4.5 / 5 | API schema と contract test を追加し、PR で確認しやすい差分にした。 |

総合fit: 4.4 / 5.0（約88%）

理由: 指示の中核である RAG 用検索 API は実装・検証できた。一方で、本格的な immutable lexical index の S3 Brotli 保存や kuromoji.js 統合は MVP の次段階として残しているため満点ではない。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `npm --prefix memorag-bedrock-mvp run lint`
- `npm --prefix memorag-bedrock-mvp/apps/api test`
- `npm --prefix memorag-bedrock-mvp/apps/api run build`

## 8. 未対応・制約・リスク

- エージェント側の検索ノードへの取り込みは、ユーザー指示通り次回実施予定。
- lexical index は warm cache の MVP であり、S3 上の immutable Brotli index 生成/ロードは未実装。
- 日本語 tokenizer は軽量 n-gram ベースで、kuromoji.js の形態素解析導入は未実装。
- S3 Vectors の ACL group 前段 filter は `aclGroup` metadata を保存できるようにしたが、公開文書と ACL 文書の混在 semantics は運用 metadata 設計に合わせて追加調整が必要。
