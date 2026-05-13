# 要件定義（1要件1ファイル）

- 要件ID: `NFR-012`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 要件

- NFR-012: 検索 API は通常 response で alias 定義、ACL metadata、内部 project code、許可 user list を漏えいしないこと。

## 受け入れ条件（この要件専用）

- AC-NFR012-001: `POST /search` の `results[].metadata` は allowlist 方式で返却項目を制限すること。
- AC-NFR012-002: `results[].metadata` は `tenantId`、`source`、`docType`、`department` 以外を返さないこと。
- AC-NFR012-003: `diagnostics.indexVersion` は document ID や alias 本文を含まない opaque value であること。
- AC-NFR012-004: `diagnostics.aliasVersion` は alias 本文を含まない opaque value または `none` であること。
- AC-NFR012-005: alias、ACL、許可 user、内部 project code の非漏えいは API test または unit test で検証されること。

## 要件の源泉・背景

- 源泉: 2026-05-02 の alias 管理見直し指示、現行 `SearchResult` metadata 返却設計、S3 Vectors metadata filtering、Weaviate/Pinecone multitenancy docs、RAG poisoning 研究。
- 背景: alias は内部 project 名、顧客名、未公開製品名、人事制度名などを含む可能性がある。
- 背景: ACL metadata は検索結果本文より前段の制御情報であり、通常利用者向け response へそのまま返すべきではない。

## 要件の目的・意図

- 目的: 検索品質向上のための alias と ACL 制御情報を、通常検索 response の情報漏えい面にしない。
- 意図: debug や audit で必要な情報は管理者向け経路へ分離し、通常 response には再現性に必要な version だけを返す。
- 区分: 非機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `NFR-012` |
| 説明 | search response metadata と diagnostics の非漏えい |
| 根拠 | alias と ACL metadata は検索制御データであり、通常利用者へ露出すると存在推測と誘導リスクになる |
| 源泉 | 2026-05-02 alias 管理見直し、検索/tenant/security docs |
| 種類 | 非機能要求 |
| 依存関係 | `POST /search`、`SearchResponseSchema`、hybrid search diagnostics |
| 衝突 | troubleshooting に必要な alias details は管理者 debug へ分離する |
| 受け入れ基準 | `AC-NFR012-001` から `AC-NFR012-005` |
| 優先度 | A |
| 安定性 | High |
| 変更履歴 | 2026-05-02 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 検索 response は通常利用者に返るため漏えい面になりやすい |
| 十分性 | OK | metadata と diagnostics の両方を対象にしている |
| 理解容易性 | OK | allowlist と opaque version の条件が明確 |
| 一貫性 | OK | 既存 RBAC と No-access leak 指標に合う |
| 標準・契約適合 | OK | tenant 分離と metadata filter の前提に合う |
| 実現可能性 | OK | response shaping と version hash で実装可能 |
| 検証可能性 | OK | search unit test と schema test で確認可能 |
| ニーズ適合 | OK | alias 管理の production 安全化に対応する |

## 関連文書

- `3_設計_DES/11_詳細設計_DLD/DES_DLD_002.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_003.md`
