# RAG 検索 API アルゴリズム詳細設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_002.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-02
- 状態: Draft

## 何を書く場所か

`POST /search` と agent の `search_evidence` が使う hybrid retriever のアルゴリズム、採用判断、制約、テスト観点を定義する。

## 対象

- lexical search: BM25、field boost、CJK n-gram、prefix、ASCII fuzzy、alias expansion
- semantic search: evidence vector store、S3 Vectors metadata filter
- fusion: Reciprocal Rank Fusion
- guard: ACL/metadata filter、cheap rerank
- response safety: metadata allowlist、opaque `indexVersion`、opaque `aliasVersion`
- agent integration: `search_evidence` の BM25 / S3 Vectors / RRF 統合、debug trace diagnostics

## アルゴリズム構成

```text
query
  -> normalize / tokenize
  -> lexical search
       - title boost
       - body BM25
       - CJK 2-gram / 3-gram
       - prefix expansion
       - ASCII fuzzy expansion
       - alias expansion
  -> semantic search
       - embedding
       - evidence vector store query
       - metadata filter
  -> RRF fusion
  -> ACL guard
  -> cheap rerank
  -> metadata sanitize / diagnostics versioning
  -> topK chunks
```

`POST /chat` の agent workflow では、`embed_queries` が生成した各 query/vector を `search_evidence` に渡し、同じ hybrid retriever を query ごとに実行する。各 query 内では lexical result と semantic result を RRF で融合し、さらに複数 query / clue の result list も chunk key 単位の cross-query RRF で順位融合する。回答可能性判定向けの retrieval score は semantic score、lexical score、cheap rerank score、cross-query RRF の軽量 boost を使って正規化する。

## 採用判断

| 項目 | 判断 | 理由 | リスク・制約 |
|---|---|---|---|
| BM25 | 採用 | キーワード一致と固有名詞検索に強く、RAG の候補生成として説明可能性が高い。 | 現行は Lambda memory 上の warm cache であり、大規模 index では専用 index 保存が必要。 |
| CJK n-gram | 採用 | 日本語の未知語、部分一致、複合語に最低限対応できる。 | 形態素解析よりノイズが多く、語境界の精度は限定的。 |
| kuromoji.js | 初期未採用 | 依存と辞書ロードを増やさず、MVP の実装速度と Lambda cold start を優先する。 | 検索品質が不足する場合は tokenizer 差し替え候補にする。 |
| prefix | 採用 | 社内略語、品番、ファイル名、英数字識別子に効く。 | 短すぎる prefix はノイズになるため、2 文字以上に限定する。 |
| fuzzy | 限定採用 | typo に対応するため、4 文字以上の ASCII term に限定して edit distance 1〜2 を使う。 | 日本語 fuzzy は計算量と誤一致が増えるため、n-gram/alias に寄せる。 |
| alias expansion | 限定採用 | tenant や index の運用データとして与えられた同義語だけを query expansion に使う。 | 実装に業務語彙や製品名を hard-code しない。 |
| alias diagnostics | 採用 | 通常 response では alias 本文を出さず、`aliasVersion` だけを返して再現性と非漏えいを両立する。 | 管理者向け debug で詳細確認する経路は別途必要。 |
| metadata allowlist | 採用 | `searchAliases`、`aliases`、`aclGroups`、`allowedUsers`、内部 project code を通常検索結果に返さない。 | response metadata に任意項目を出したい場合は allowlist 追加の設計判断が必要。 |
| S3 Vectors | 採用 | 意味検索は自作せず、既存 vector store 抽象経由で topK 類似検索と metadata filter を使う。 | metadata filter は保存項目とサイズ制約に依存する。 |
| RRF | 採用 | BM25 score と vector score は尺度が異なるため、順位ベース融合で score normalization 依存を避ける。 | 重みは初期値であり、評価ログに基づく調整が必要。 |
| cheap rerank | 採用 | phrase match、token coverage、title match、recentness の軽量補正で上位順序を安定させる。 | cross encoder rerank ほどの意味理解はない。 |

## 妥当性レビュー

現時点のアルゴリズムは、小〜中規模の社内 RAG MVP には適切である。

- OpenSearch の小型互換ではなく、RAG 候補生成に必要な lexical/semantic/ACL/source 情報へ絞っている。
- BM25 と vector search を併用しているため、正確な語句一致と意味的な言い換えの両方を拾える。
- RRF により、score 尺度が異なる BM25 と vector distance を単純加算しない。
- ACL は manifest 側と vector metadata 側の両方で扱い、検索後の guard も残している。
- Lambda 上の実装としては、巨大 index を常時運用する前提を避け、warm cache の MVP としている。

ただし、次の条件に達した場合は設計を見直す。

- lexical index が数十 MB を超え、cold start と memory 使用量が p95 latency に影響する。
- 日本語の複合語・表記ゆれで Recall@20 が不足する。
- ACL group の組み合わせが複雑化し、単一 `aclGroup` filter では候補生成段階の絞り込みが不十分になる。
- クエリ数が増え、Lambda 実行時間と S3/object load が OpenSearch または SQLite FTS5/EFS より不利になる。

## 実装上の制約

- lexical index は ingestion 時に永続生成せず、manifest/source text から search Lambda execution environment に warm cache する。
- metadata filter は `tenantId`、`department`、`source`、`docType`、`documentId` を API 入力で受ける。
- vector metadata には `tenantId`、`department`、`source`、`docType`、`aclGroup`、`aclGroups`、`allowedUsers` を保存できる。
- alias expansion は manifest metadata の `searchAliases` または `aliases` から取り込んだ index-local map だけを使う。
- alias expansion の default は空であり、実コードに具体的な社内用語、部署名、製品名を固定値として持たせない。
- search response の `metadata` は allowlist 方式とし、現行は `tenantId`、`source`、`docType`、`department` のみ返す。
- search response の `diagnostics.indexVersion` と `diagnostics.aliasVersion` は opaque value とし、document ID、alias key、alias value を含めない。
- S3 Vectors の前段 filter は scalar metadata に寄せ、複雑な ACL 判定は後段 guard で補完する。
- agent `search_evidence` は `POST /search` と同じ `searchRag` 実装を使い、chat route の `AppUser` を渡して ACL guard を維持する。
- agent `search_evidence` は複数 query / clue の結果を最大 score だけで統合せず、cross-query RRF の順位を `crossQueryRrfScore` / `crossQueryRank` として chunk metadata に残す。
- agent debug trace の `execute_search_action` には query 数、index / alias version、lexical / semantic / fused count、source count を記録する。
- agent の回答文脈選択は、質問から動的に得た語彙 overlap、根拠文内の一般的な値表現、文単位の補完関係など、通常運用の資料にも成立する信号だけを使う。benchmark dataset の期待語句、QA sample の行 ID、特定 corpus の回答語句、部署名や制度名の固定リストを実装へ持たせてはいけない。
- QA benchmark の期待語句未一致を修正する場合も、`retrievalRecallAtK` や `citationHitRate` の結果だけで固定補正を追加しない。根拠 chunk は取れているが回答文へ渡す情報が不足する場合は、context assembly の一般規則、prompt の根拠使用指示、または support verification の責務として設計し、dataset 固有の分岐で数値だけを改善しない。

## テスト観点

| 観点 | 対応テスト |
|---|---|
| 日本語 query tokenization | `tokenizeQuery normalizes Japanese and ASCII terms with n-grams` |
| BM25 exact match | `BM25 search covers exact, Japanese n-gram, prefix, and ASCII fuzzy matches` |
| CJK n-gram match | `BM25 search covers exact, Japanese n-gram, prefix, and ASCII fuzzy matches` |
| prefix match | `BM25 search covers exact, Japanese n-gram, prefix, and ASCII fuzzy matches` |
| ASCII fuzzy match | `BM25 search covers exact, Japanese n-gram, prefix, and ASCII fuzzy matches` |
| alias expansion | `BM25 alias expansion uses caller-provided alias maps only` |
| alias version diagnostics | `BM25 alias expansion uses caller-provided alias maps only`、`service search applies ACL and metadata filters across lexical and vector results` |
| search metadata sanitize | `service search applies ACL and metadata filters across lexical and vector results` |
| recursive metadata schema | `document metadata schema accepts recursive JSON alias metadata` |
| RRF overlap boost | `RRF fusion rewards overlap while keeping independent lexical hits` |
| ACL filter | `service search applies ACL and metadata filters across lexical and vector results` |
| metadata filter | `service search applies ACL and metadata filters across lexical and vector results` |
| API contract | `HTTP contract validates major endpoint responses against /openapi.json` |
| agent hybrid search integration | `fixed MemoRAG workflow answers from selected evidence and records fixed trace steps`、`query nodes handle memory-disabled, fallback, generated clue, and search merge paths` |
| agent cross-query RRF | `query nodes handle memory-disabled, fallback, generated clue, and search merge paths` |
| agent retrieval diagnostics trace | `fixed MemoRAG workflow answers from selected evidence and records fixed trace steps` |
| agent answer context generalization | `final answer context uses dynamic question terms and value signals without domain word lists` |

## 評価指標

- `Recall@20`: 正解 chunk または正解 document が上位 20 件に含まれること。
- `MRR@10`: 正解 chunk または正解 document が上位に出ること。
- `retrieval_mrr_at_k`: agent benchmark で evaluator profile の `retrieval.recallK` 内に期待 document/file がどの順位で出るか。
- `citation_support_pass_rate`: answer support verifier が非支持文を検出しなかった割合。
- `No-access leak`: 権限外 document が検索結果に含まれないこと。
- `no_access_leak_count`: agent benchmark の citation / retrieved に forbidden evidence が混入した件数。baseline gate では 0 を必須とする。
- `aliasNoAccessLeak`: alias、ACL、許可 user、内部 project code が通常検索結果と diagnostics に含まれないこと。
- `aliasScopeViolation`: ACL/filter 済み manifest の外側にある alias が query expansion に使われないこと。
- `p95 latency`: Lambda cold/warm の両方で業務利用に耐えること。
- `Grounded answer rate`: agent 統合後、回答が hybrid retrieval の出典に基づくこと。

## 高度検索導入 gate

現行 hybrid retrieval を baseline とし、GraphRAG、RAPTOR、visual retrieval、cross-encoder reranker、HyDE、OpenSearch / FTS index は、症状別の benchmark gate を満たすまで default path に入れない。

| 症状 | 判定指標 | 優先する対応 | 導入候補 | safety gate |
|---|---|---|---|---|
| exact keyword、規程番号、品番、略語で落ちる | `Recall@20`、token coverage、alias candidate | alias / glossary、CJK n-gram、prefix、tokenizer 調整 | kuromoji.js、OpenSearch custom dictionary | `aliasScopeViolation=0`、`no_access_leak_count=0` |
| 意味的言い換えで落ちる | semantic hit、query rewrite contribution、answerable accuracy | embedding model、query expansion、HyDE の ablation | HyDE、query rewrite profile | refusal precision と unsupported sentence rate を悪化させない |
| Recall@20 に正解があるが順位が悪い | `MRR@10`、citation hit、finalEvidence hit | cheap rerank weight、RRF weight | cross-encoder reranker、LLM rerank | p95 latency と model cost budget を超えない |
| 表、スキャン PDF、ページ抽出で evidence がない | extraction failure、chunk failure、expected page hit | OCR、structured block ingestion、table-aware chunking | visual retrieval は OCR / block ingestion 後に再評価 | raw evidence が存在しない回答を生成しない |
| 複数文書統合で落ちる | multi-doc category、fact slot coverage、citation support | context assembly、memory card | RAPTOR、GraphRAG | 最終根拠は raw evidence に戻せる |
| index size / query 量で latency が悪化する | p95 latency、index size、Lambda memory、cold start | immutable lexical index、candidate cap、cache | SQLite FTS5 / EFS、OpenSearch | ACL guard と rollback 手順を維持する |

導入判断では、baseline と current run の evaluator profile を一致させる。profile mismatch の比較は参考値に留め、採用 gate の合格扱いにしない。

ablation は少なくとも該当する `vector`、`BM25`、`CJK n-gram`、`alias`、`RRF`、`query rewrite`、`reranker`、`structured chunking` の寄与を比較する。該当しない項目は、failure taxonomy 上の理由を report に残す。

高度検索候補を採用する PR は、成功条件、rollback 条件、latency / cost budget、ACL guard、answerability gate、citation validation、support verification への影響を PR 本文と運用 docs に記載する。

## 将来拡張

- ingestion batch で immutable lexical index を生成し、S3 Brotli object として保存する。
- scoped / versioned alias artifact と index manifest により `aliasVersion` と `indexVersion` の対応を publish する。
- tokenizer を kuromoji.js に差し替え、形態素 token と n-gram token の重みを分離する。
- 評価ログから RRF weight、BM25 topK、semantic topK、cheap rerank 加点を調整する。
- index size が増えた場合は SQLite FTS5 または EFS へ移行する。
- 検索 confidence が低い場合のみ HyDE または LLM rerank を選択的に使う。
