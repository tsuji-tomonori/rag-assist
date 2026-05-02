# Athena 補助検索・分析基盤 詳細設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_003.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-02
- 状態: Draft

## 何を書く場所か

Athena を MemoRAG の検索基盤に組み込む場合の責務、online path から外す理由、fallback / batch / analytics での使い方、S3 data layout、実装時の guardrail を定義する。

## 結論

Athena は通常の全文検索 API の主経路にしない。

通常検索は Lambda TypeScript の lightweight lexical index、S3 Vectors の semantic search、RRF fusion を使う。

Athena は S3 上の文書 chunk、postings、query log、benchmark data を安価に分析し、term stats、zero-hit 分析、評価集計、Lambda 用 index artifact 生成、低頻度 fallback grep に使う。

## 対象

- S3 chunk lake: `chunk_id`, `doc_id`, `tenant_id`, `source`, `acl_groups`, `normalized_text`
- S3 postings table: `tenant_id`, `term_bucket`, `term`, `chunk_id`, `tf`, `doc_len`, `field`
- S3 query logs: query、hit/miss、latency、retrieval source、answerability、citation validation
- Athena workgroup、Glue table、query result S3 bucket
- Lambda が読む `lexical-index.json.br` または `sqlite.db` などの index artifact

## 非対象

- Athena を通常の `POST /search` または `POST /chat` の必須同期処理にすること。
- OpenSearch 互換 query parser、distributed shard、aggregation を Athena 上で再実装すること。
- 日本語 fuzzy matching を Athena SQL の全 term scan で実行すること。

## Online Path

```text
User query
  -> API Lambda
  -> lightweight BM25 / n-gram / prefix / ASCII fuzzy / alias index
  -> S3 Vectors semantic search with metadata filter
  -> RRF fusion
  -> ACL guard
  -> answer generation
```

この経路は `TC-001` と `DES_DLD_002` を正とする。

Athena は通常 path の必須依存にしない。理由は、Athena が query を開始して完了待ちする非同期実行モデルであり、scan 量、partition、workgroup quota、同時実行の影響を受けやすいためである。

## Offline / Batch Path

```text
S3 chunks / postings / query logs
  -> Athena SQL
  -> term frequency / document frequency
  -> zero-hit and recall analysis
  -> benchmark aggregation
  -> lexical-index.json.br / sqlite.db
  -> Lambda warm cache
```

batch では Athena を積極的に使う。特に、検索ログから zero-hit query、低 recall query、ACL filter 後の候補不足、RRF source 別の寄与を集計し、alias 辞書、BM25 weight、chunking 方針を改善する。

## 低頻度 Fallback 検索

zero-hit または管理者調査では、Athena による raw text scan を許容する。

```sql
SELECT
  chunk_id,
  doc_id,
  title,
  text
FROM rag_chunks
WHERE tenant_id = ?
  AND source = ?
  AND regexp_like(normalized_text, ?)
LIMIT 100
```

この query は通常検索 API の p95 latency を満たす目的では使わない。使う場合は `tenant_id`、`source`、`dt` などの partition predicate を必須にし、workgroup 側で scan 量制限と監視を設定する。

## Postings Table 検索

Athena で検索エンジン寄りの補助検索を行う場合は raw text scan ではなく postings table を使う。

```text
rag_postings
- tenant_id
- term_bucket
- term
- chunk_id
- tf
- doc_len
- field
- acl_groups

rag_term_stats
- tenant_id
- term
- df

rag_doc_stats
- tenant_id
- chunk_id
- doc_len
- title
- source
- url
```

`term_bucket` は `hash(term) % 256` などの固定 bucket とする。`term` を直接 partition key にすると partition 数が増えすぎ、planning と metadata 管理が重くなるため避ける。

## S3 Data Layout

```text
s3://rag-lake/chunks/
  tenant_id=acme/
    source=confluence/
      dt=2026-05-02/
        part-0001.parquet

s3://rag-lake/postings/
  tenant_id=acme/
    term_bucket=000/
      part-0001.parquet
    term_bucket=001/
      part-0001.parquet

s3://rag-lake/query_logs/
  dt=2026-05-02/
    part-0001.parquet
```

Athena で読むデータは Parquet または ORC を優先し、圧縮する。chunk 本文、postings、query logs は列指向にすることで、必要な列だけ scan できるようにする。

partition は common query に合わせる。chunk lake は `tenant_id`, `source`, `dt` を候補にし、postings は `tenant_id`, `term_bucket` を候補にする。高 cardinality の `term`, `chunk_id`, `user_id` は原則 partition key にしない。

## Lambda から Athena を呼ぶ場合

- `StartQueryExecution` で query を開始し、`GetQueryExecution` で完了を待ち、`GetQueryResults` で結果を読む。
- ユーザー入力は SQL 文字列へ直接連結せず、`ExecutionParameters` を使う。
- `WorkGroup` と `ResultConfiguration.OutputLocation` を明示する。
- query result reuse は fallback や管理者調査では有効だが、自然文 RAG query では hit 率が限定的である。
- timeout、poll interval、最大 scan 量、最大結果件数、error reason の記録を実装条件に含める。

## Cost / Latency 判断

Athena の SQL query は scan 量課金であり、2026-05-02 時点の AWS 公式料金ではオンデマンド SQL query が `$5/TB scanned` である。

| 1検索あたりの scan 量 | 1検索の目安 | 1万検索の目安 | 判断 |
|---:|---:|---:|---|
| 100 MB | 約 $0.0005 | 約 $5 | PoC / 管理者調査なら許容しやすい |
| 1 GB | 約 $0.005 | 約 $50 | 低頻度 fallback なら検討可 |
| 10 GB | 約 $0.05 | 約 $500 | 通常 API には重い |
| 50 GB | 約 $0.25 | 約 $2,500 | 通常 API には不適 |

この表は Athena 料金だけを単純計算した目安であり、S3 request、query result storage、Glue Data Catalog、Lambda などの周辺費用は別途評価する。

## Security / Access Control

- Athena fallback search は tenant 境界を必須 predicate とする。
- 管理者調査 query は認可済み admin route または offline job に限定する。
- query result S3 bucket は暗号化し、保持期間を設定する。
- query result に chunk text が含まれるため、public bucket や広い IAM principal へ公開しない。
- S3 Vectors の metadata filter と同じ ACL semantics を Athena 側で再現できない場合は、Athena の結果をそのまま user-facing answer に使わない。

## テスト観点

| 観点 | 確認方法 |
|---|---|
| 通常 path 非依存 | `POST /search` と `POST /chat` が Athena env var 不在でも動くこと |
| query parameterization | Athena 呼び出し実装で user input が `ExecutionParameters` に渡ること |
| scan 抑制 | SQL に tenant/source/date または term_bucket predicate が含まれること |
| result guard | fallback 結果に tenant / ACL guard が適用されること |
| artifact 互換 | batch 生成 index を Lambda lexical loader が読めること |
| cost monitoring | workgroup または job metrics で scan 量を観測できること |

## 採用判断

| 用途 | 判断 | 理由 |
|---|---|---|
| 通常のオンライン全文検索 API | 不採用 | scan 型で latency と cost が query 数に比例しやすい |
| zero-hit fallback | 条件付き採用 | 低頻度であれば運用調査と recall 改善に使える |
| 管理者向け調査検索 | 採用 | 秒単位待ちを許容でき、SQL で横断分析しやすい |
| postings table 検索 | 条件付き採用 | raw text scan より scan 量を抑えられるが、秒単位 latency 前提 |
| index 生成・評価集計 | 採用 | S3 data lake と相性がよく、Lambda 用 artifact 生成に向く |

## 関連ドキュメント

- `TC-001`: 初期検索基盤の技術境界。
- `TC-002`: Athena の検索基盤内での責務境界。
- `DES_DLD_002`: RAG 検索 API アルゴリズム詳細設計。
- `SQ-001`: RAG 品質の継続測定条件。

## 参考

- Amazon Athena pricing: https://aws.amazon.com/athena/pricing/
- Amazon Athena `regexp_like`: https://docs.aws.amazon.com/athena/latest/ug/filtering-with-regexp.html
- Amazon Athena data optimization: https://docs.aws.amazon.com/athena/latest/ug/performance-tuning-data-optimization-techniques.html
- Amazon Athena columnar storage: https://docs.aws.amazon.com/athena/latest/ug/columnar-storage.html
- Amazon Athena `StartQueryExecution`: https://docs.aws.amazon.com/athena/latest/APIReference/API_StartQueryExecution.html
- Amazon S3 Vectors query: https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-query.html
- Amazon S3 Vectors metadata filtering: https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-metadata-filtering.html
