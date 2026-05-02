# 要件定義（1要件1ファイル）

- 要件ID: `NFR-013`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 要件

- NFR-013: システムは alias の作成、更新、review、無効化の監査ログを、document artifact と分離した監査ログ専用 S3 bucket 上の append-only record として保持できること。

## 受け入れ条件（この要件専用）

- AC-NFR013-001: alias audit log は監査ログ専用 bucket の `aliases/audit-log/{timestamp}-{eventId}.json` に保存されること。
- AC-NFR013-002: alias audit log は `eventId`、`aliasId`、`action`、`actorUserId`、`at`、`beforeStatus`、`afterStatus`、`reason`、`aliasVersion`、`scope` を保持できること。
- AC-NFR013-003: alias audit log は document metadata、lexical index、index manifest とは別の S3 bucket に保持されること。
- AC-NFR013-004: alias audit log の参照 API は `rag:alias:read` 以上の権限を要求すること。
- AC-NFR013-005: 通常検索 response は alias audit log の内容を返さないこと。
- AC-NFR013-006: alias audit log の保存と参照は unit test または API contract test で検証されること。
- AC-NFR013-007: 監査ログ専用 bucket は Block Public Access、SSE-S3、TLS 強制、versioning、S3 Object Lock Governance retention、server access logging、lifecycle expiration を設定すること。

## 要件の源泉・背景

- 源泉: 2026-05-02 の alias 管理見直し指示。
- 源泉: 2026-05-02 の「監査ログはどこで保持するか、要件として新たに起こす」追加指示。
- 源泉: RAG poisoning 研究で示された、retrieval 前段の knowledge / control data が検索候補と回答を誘導し得るというリスク。
- 源泉: Elasticsearch Synonyms API、Solr Managed Resources、OpenSearch custom dictionary package など、synonym/alias を権限付き管理対象 resource として扱う検索製品実務。
- 背景: alias は document 本文ではないが、query expansion と lexical retrieval の候補生成を制御する運用データである。
- 背景: alias には内部 project 名、顧客名、未公開製品名、人事制度名などが含まれる可能性がある。
- 背景: alias の誤設定や悪意ある追加は、権限外文書の存在推測、検索結果の誘導、benchmark 再現性の低下につながる。
- 背景: document artifact と同一 bucket に置くと、文書削除、index 再生成、debug 用 object、監査ログの保持・削除・権限境界が混在する。

## 要件の目的・意図

- 目的: alias の変更主体、理由、scope、状態遷移を追跡できるようにし、誤設定・悪意ある変更・権限境界違反を事後調査できるようにする。
- 目的: `aliasVersion` と lifecycle event を結び付け、検索品質劣化や rollback 時の説明可能性を確保する。
- 目的: audit log の保持、削除、改ざん防止、access logging を document lifecycle から分離する。
- 意図: 監査ログを検索 runtime や通常検索 response から分離し、監査情報そのものが新たな漏えい面にならないようにする。
- 意図: batch publish や index manifest 更新の前段で、review workflow の証跡を保持する。
- 意図: 小さい JSON record が中心であるため、KMS customer managed key や頻繁な storage class transition を初期設定にせず、SSE-S3 と lifecycle expiration により固定費を抑える。
- 区分: 非機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `NFR-013` |
| 説明 | alias audit log の専用 bucket 保持、分離、追跡性 |
| 根拠 | alias は retrieval 制御データであり、変更履歴を追跡できないと漏えい・poisoning・品質劣化の調査が困難になる |
| 源泉 | 2026-05-02 alias 管理見直し、2026-05-02 監査ログ追加指示、検索製品実務、RAG security 研究 |
| 種類 | 非機能要求 |
| 依存関係 | `FR-023`、`AliasDefinition`、`AliasAuditLogEntry`、`/admin/aliases/audit-log`、RBAC |
| 衝突 | 監査ログは調査性を高めるが、内容に機微情報を含み得るため通常 response からは分離する |
| 受け入れ基準 | `AC-NFR013-001` から `AC-NFR013-007` |
| 優先度 | A |
| 安定性 | High |
| 変更履歴 | 2026-05-02 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | alias の変更は検索候補と権限境界に影響するため追跡が必要 |
| 十分性 | OK | 専用 bucket、保持項目、参照権限、通常 response 非露出を含む |
| 理解容易性 | OK | bucket 境界、object key prefix、required fields が明確 |
| 一貫性 | OK | `FR-023` の scoped/versioned alias lifecycle と整合する |
| 標準・契約適合 | OK | synonym/alias を管理対象 resource として扱う検索製品実務に合う |
| 実現可能性 | OK | object store への JSON record 保存と RBAC 付き API で実装可能 |
| 検証可能性 | OK | alias store unit test と API contract test で確認可能 |
| ニーズ適合 | OK | production 運用で必要な review、rollback、監査に対応する |

## 関連文書

- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_023.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_003.md`
- `3_設計_DES/31_データ_DATA/DES_DATA_001.md`
