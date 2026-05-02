# Alias 管理 lifecycle 詳細設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_003.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-02
- 状態: Draft

## 何を書く場所か

検索 alias を scoped / versioned artifact として管理し、batch/index lifecycle、ACL、監査、評価へ接続する設計を定義する。

## 対象

- alias artifact の scope と schema
- alias と lexical index の version 対応
- 管理 API の責務境界
- search runtime が返す diagnostics
- 品質・セキュリティ評価指標

## 最新根拠の確認

2026-05-02 時点で、次を確認した。

| 根拠 | 確認内容 | 設計への反映 |
|---|---|---|
| Elasticsearch Synonyms API | synonym set は API 管理対象で、既存 set 更新時に analyzer reload が行われ、set ごとに rule 上限がある。 | alias は管理対象 resource とし、runtime 定数にしない。 |
| Solr Managed Resources | managed synonym は REST API の CRUD 対象で、変更反映には reload/reindex の考慮が必要。 | alias 更新と active index 更新を lifecycle として分ける。 |
| Algolia Synonyms | regular、one-way、alternative correction、placeholder が分かれ、synonym の過剰利用は意図しない結果を招く。 | alias `type` と `weight` を持たせ、全社共通辞書を例外扱いにする。 |
| S3 Vectors metadata filtering | filterable metadata と non-filterable metadata を分け、query filter と vector search を同時に評価する。 | alias scope は tenant/source/docType/ACL filter と整合させる。 |
| Weaviate / Pinecone multitenancy | tenant ごとの shard や namespace で data isolation を実現する。 | alias の可視範囲は検索対象 index/tenant/ACL を超えない。 |
| OpenSearch custom dictionary package | S3 upload だけでは package は自動更新されず、index analyzer 利用時は reindex や alias 切替が必要になる。 | alias 反映は batch が lexical index を再生成し、manifest で publish する。 |
| ACL Anthology RAG security | RAG の外部 knowledge base は poisoning risk を持ち、単一 poisoned document でも retrieval を誘導し得る。 | alias を retrieval 制御データとして review/audit/rollback 対象にする。 |

参照 URL:

- `https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-synonyms-put-synonym`
- `https://solr.apache.org/guide/solr/9_9/configuration-guide/managed-resources.html`
- `https://www.algolia.com/doc/guides/managing-results/optimize-search-results/adding-synonyms`
- `https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-metadata-filtering.html`
- `https://docs.weaviate.io/weaviate/manage-collections/multi-tenancy`
- `https://docs.pinecone.io/guides/index-data/implement-multitenancy`
- `https://docs.aws.amazon.com/opensearch-service/latest/developerguide/custom-packages.html`
- `https://aclanthology.org/2025.findings-emnlp.1023/`
- `https://aclanthology.org/2023.emnlp-main.585/`
- `https://aclanthology.org/2023.acl-long.99/`
- `https://aclanthology.org/2024.emnlp-main.981/`

## 設計判断

| 判断ID | 判断 | 理由 | トレードオフ |
|---|---|---|---|
| ALIAS-D1 | alias は検索ロジックの定数ではなく検索データとして扱う | synonym/alias は検索品質、tenant 分離、監査、再現性に影響する | artifact 管理と batch が必要になる |
| ALIAS-D2 | default scope は `tenantId + source + docType` とする | 業務語彙は部署・文書種別で意味が変わる | global alias は明示例外になる |
| ALIAS-D3 | ACL scope を alias artifact に持たせる | alias 自体が内部 project 名や顧客名を含み得る | 管理 UI と review が複雑になる |
| ALIAS-D4 | alias 反映は runtime 即時反映ではなく batch/index lifecycle に寄せる | `aliasVersion` と `indexVersion` の対応を保ち、benchmark と rollback を可能にする | 反映までの遅延が発生する |
| ALIAS-D5 | `oneWay`、`equivalent`、`typo`、`placeholder` を区別する | query expansion の方向と重みを制御する必要がある | 初期 schema が単純 map より大きくなる |
| ALIAS-D6 | LLM 生成 alias は draft のみ許可する | query expansion は有効だが hallucination と poisoning のリスクがある | review と benchmark の手間が増える |

## 推奨 S3 layout

```text
aliases/
  tenantId=tenant-a/source=notion/docType=policy/definitions/{aliasId}.json
  audit-log/{timestamp}-{eventId}.json
  tenantId=tenant-a/source=notion/docType=policy/v0001/aliases.json
  tenantId=tenant-a/source=notion/docType=policy/v0002/aliases.json

indexes/
  tenantId=tenant-a/source=notion/docType=policy/v0002/lexical-index.json.br

index-manifests/
  tenantId=tenant-a/source=notion/docType=policy/latest.json
```

`definitions/{aliasId}.json` は管理 API が保存する個別 alias 定義である。`v0001/aliases.json` 以降は batch が active alias を compile して publish する versioned artifact として扱う。

`latest.json` は alias だけの latest ではなく、corpus、alias、index の対応を保持する。

```json
{
  "schemaVersion": 1,
  "tenantId": "tenant-a",
  "source": "notion",
  "docType": "policy",
  "corpusVersion": "corpus-20260502-010",
  "aliasVersion": "alias-20260502-003",
  "indexVersion": "idx-20260502-001",
  "aliasObjectKey": "aliases/tenantId=tenant-a/source=notion/docType=policy/v0003/aliases.json",
  "lexicalIndexObjectKey": "indexes/tenantId=tenant-a/source=notion/docType=policy/v0002/lexical-index.json.br",
  "createdAt": "2026-05-02T00:00:00.000Z",
  "createdBy": "batch-ingestion"
}
```

## Alias artifact schema

```json
{
  "schemaVersion": 1,
  "aliasId": "alias-001",
  "from": "pto",
  "to": ["paid time off", "vacation"],
  "type": "oneWay",
  "weight": 1.0,
  "scope": {
    "tenantId": "tenant-a",
    "source": "notion",
    "docType": "policy",
    "aclGroups": ["HR_POLICY_READER"]
  },
  "status": "active",
  "source": "manual",
  "reason": "Employees search PTO, documents use vacation.",
  "createdBy": "user-123",
  "updatedBy": "user-123",
  "reviewedBy": "user-456",
  "version": "alias-20260502-003",
  "createdAt": "2026-05-02T00:00:00.000Z",
  "reviewedAt": "2026-05-02T01:00:00.000Z"
}
```

## Lifecycle

```text
draft alias 登録
  -> reviewer が scope / ACL / reason / benchmark 対象を確認
  -> active alias artifact を version 付きで保存
  -> batch が active alias を読む
  -> lexical-index.json.br を再生成
  -> benchmark / smoke test
  -> index-manifest latest を更新
  -> search runtime が new indexVersion / aliasVersion を返す
```

search runtime は alias artifact を request 中に更新しない。通常 response は `aliasVersion` だけを返し、alias ID、reason、適用詳細は管理者 debug に限定する。

## 管理 API 案

| Method | Path | Permission | 責務 |
|---|---|---|---|
| `POST` | `/admin/aliases` | `rag:alias:write:group` | draft alias を作成する |
| `GET` | `/admin/aliases` | `rag:alias:read` | scope 内 alias を一覧する |
| `PATCH` | `/admin/aliases/{aliasId}` | `rag:alias:write:group` | draft alias を修正する |
| `POST` | `/admin/aliases/{aliasId}/review` | `rag:alias:review:group` | draft を approve/reject する |
| `POST` | `/admin/aliases/{aliasId}/disable` | `rag:alias:disable:group` | active alias を無効化する |
| `POST` | `/admin/aliases/publish` | `rag:alias:publish:group` | batch publish を要求する |
| `GET` | `/admin/aliases/audit-log` | `rag:alias:read` | audit log を参照する |

管理 API は alias 定義と監査を管理する。検索 index の直接更新は batch の責務にする。

## Phase 1 実装済み

Phase 1 では管理 API と S3 artifact は作らず、現行 metadata alias の安全化を先に行った。

- API metadata schema を recursive JSON にし、`searchAliases` / `aliases` の map を validation で拒否しない。
- `POST /search` の `results[].metadata` は allowlist で `tenantId`、`source`、`docType`、`department` だけを返す。
- `diagnostics.indexVersion` は opaque hash にし、document ID と alias 本文を含めない。
- `diagnostics.aliasVersion` は opaque hash または `none` にし、alias 本文を含めない。
- alias expansion は現行どおり visible manifest 由来 alias だけを merge し、ACL/filter 済み範囲外の alias を使わない。

## Phase 2/3 初期実装

今回の初期実装では、管理 API と object store backed alias 定義を追加した。検索 index への publish、`index-manifests/latest.json` 更新、batch benchmark は未実装である。

- `POST /admin/aliases` は draft alias を `aliases/tenantId=.../source=.../docType=.../definitions/{aliasId}.json` に保存する。
- `PATCH /admin/aliases/{aliasId}` は draft のみを更新できる。
- `POST /admin/aliases/{aliasId}/review` は draft を `active` または `rejected` に遷移する。
- `POST /admin/aliases/{aliasId}/disable` は active のみを `disabled` に遷移する。
- `GET /admin/aliases/audit-log` は create/update/review/disable の audit log を返す。
- すべての管理 API は `rag:alias:*` permission を要求し、通常利用者の `CHAT_USER` には alias 管理権限を付与しない。
- 管理 API は alias 定義を保存するだけで、search runtime の lexical index は直接更新しない。

### 監査ログ保持場所

alias audit log は document metadata、lexical index、index manifest と分離し、object store の `aliases/audit-log/{timestamp}-{eventId}.json` に JSON record として保持する。local 開発では `LocalObjectStore` 配下、本番構成では docs bucket を backing store とする `S3ObjectStore` 配下に保存する。

監査ログには、`eventId`、`aliasId`、`action`、`actorUserId`、`actorEmail`、`at`、`beforeStatus`、`afterStatus`、`reason`、`aliasVersion`、`scope` を保持する。通常検索 response には返さず、`GET /admin/aliases/audit-log` で `rag:alias:read` を持つ管理者だけが参照する。

## 評価指標

| 指標 | 目的 |
|---|---|
| `aliasRecallLift@20` | alias ありで Recall@20 が改善したか確認する |
| `aliasPrecisionDrop@10` | alias により irrelevant chunk が上位に増えていないか確認する |
| `aliasNoAccessLeak` | 権限外 document / alias / project name が結果・debug に出ないか確認する |
| `aliasScopeViolation` | tenant/source/docType/aclGroup 外 alias が適用されていないか確認する |
| `aliasLatencyOverhead` | alias expansion による p95 latency 増加を確認する |
| `aliasRollbackReproducibility` | `aliasVersion + indexVersion` から過去結果を再現できるか確認する |

## 将来拡張

- Phase 2: active alias の compile、versioned alias artifact、index manifest の version 対応を実装する。
- Phase 3: publish endpoint、scope filter 付き一覧、管理 UI、review 補助を実装する。
- Phase 4: no-result query、low-confidence query、user reformulation から draft alias 候補を生成する。
