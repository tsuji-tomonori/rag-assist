# 作業完了レポート

保存先: `reports/working/20260506-1157-rag-rule-hardcode-review.md`

## 1. 受けた指示

- 主な依頼: RAG や判定周りの処理で、固定値を用いたルールベース対応がないか探す。
- 追加依頼: 固定値を使わず汎用的なつくりにする場合の方針を検討する。
- 条件: `/plan` 後の `go` により、調査を実行して結果をまとめる。コード変更は明示されていないため行わない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | RAG / retrieval / embedding / search 周辺を調べる | 高 | 対応 |
| R2 | answerability / judge / verifier など判定周辺を調べる | 高 | 対応 |
| R3 | 固定値・ルールベース候補をファイルパス付きで整理する | 高 | 対応 |
| R4 | 固定値を使わない汎用設計案を検討する | 高 | 対応 |
| R5 | 実作業レポートを残す | 高 | 対応 |

## 3. 検討・判断したこと

- `memorag-bedrock-mvp/apps/api/src/rag`、`agent/nodes`、`search`、`benchmark` を中心に検索し、実行時挙動へ影響する固定値と、テスト・評価用の固定値を分けて見た。
- 固定値のすべてが悪いわけではないため、構造認識や安全上のデフォルトとして許容しやすいものと、ドメイン依存・データ依存で汎用性を損なうものを分けた。
- 既存レポート `20260502-1246-remove-hardcoded-search-aliases.md`、`20260502-1517-value-mismatch-judge.md`、`20260502-1432-retrieval-evaluator.md`、`20260502-1457-retrieval-evaluator-review-fix.md` も確認し、既に alias 固定値の一部は metadata / published artifact 由来へ移行済みであることを反映した。

## 4. 調査結果

### 4.1 要求分類に特化した RAG 補正

- `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts`
  - `buildFinalAnswerPrompt` に、分類質問、要求獲得、要求分析、要求妥当性確認、要求管理などを直接列挙するルールがある。
  - `selectFinalAnswerChunks`、`intentAnchors`、`isRequirementsClassificationQuestion`、`classificationEvidenceScore`、`hasInvalidRequirementsClassificationAnswer` が、SWEBOK / ソフトウェア要求分類に特化したアンカー、除外語、正規表現で chunk 選択と回答検証を補正している。
- `memorag-bedrock-mvp/apps/api/src/rag/context-assembler.ts`
  - 分類、期限、金額、手順などの intent anchors を固定語彙で抽出し、要求分類質問では snippet の取り方も変えている。
- `memorag-bedrock-mvp/apps/api/src/agent/utils.ts`
  - 質問に `分類` が含まれると、ソフトウェア要求分類の固定検索 clue を追加する。
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/answerability-gate.ts`
  - 要求分類質問では `hasUsableRequirementsClassificationEvidence` を使って回答可否を決める。
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/validate-citations.ts`
  - 要求分類質問で固定の invalid answer pattern に一致すると citation failure にする。

判断: 汎用性への影響が最も大きい。特定資料の誤答対策としては効いているが、他ドメインの分類質問、別体系の要求文書、一般的な「分類して」という質問に漏れや誤拒否を起こしやすい。

### 4.2 回答可否判定の固定 fact check

- `memorag-bedrock-mvp/apps/api/src/agent/nodes/answerability-gate.ts`
  - 質問に `金額|費用|いくら|円|上限` があれば amount、`いつ|期限|日数|何日|何営業日|開始日|終了日` があれば date、`方法|手順|申請|やり方|フロー` があれば procedure として扱う。
  - 根拠文側も `円`、日付単位、`申請|手順|システム|フォーム|提出|承認` の正規表現で確認する。

判断: MVP の安全弁としては理解できるが、判定ロジックとしては型が少なすぎる。担当者、対象条件、例外、頻度、場所、ステータス、バージョン、適用範囲などは扱えない。

### 4.3 retrieval evaluator の語彙一致・値抽出 heuristic

- `memorag-bedrock-mvp/apps/api/src/agent/nodes/retrieval-evaluator.ts`
  - `supportsFact` は significant terms の全一致を中心に fact support を判定する。
  - `requiresValueAnchor` は期限系 fact だけに value anchor を要求する。
  - `factValueKind` と `extractValues` は deadline / money のみを扱う。
  - conflict 時の追加検索 query に `現行 最新 施行日 適用条件 旧制度` を固定追加する。
  - LLM judge の `NO_CONFLICT` 適用条件は confidence `0.7` 固定。

判断: rule-based risk signal としては限定的に有用。ただし deadline / money 以外の矛盾を見落とす一方、日付表現やスコープが複雑な資料では誤検出しやすい。固定追加 query も日本語の制度文書に寄っている。

### 4.4 retrieval / ranking / context の固定パラメータ

- `memorag-bedrock-mvp/apps/api/src/config.ts`
  - `MIN_RETRIEVAL_SCORE=0.20`、`CHUNK_SIZE_CHARS=1200`、`CHUNK_OVERLAP_CHARS=200`、`EMBEDDING_CONCURRENCY=3` など。
- `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.ts`
  - `topK=10`、`lexicalTopK=80`、`semanticTopK=80`、semantic query cap `100`、RRF `k=60`、weights `[1, 0.9]`、BM25 `k1=1.2` / `b=0.75`。
  - `cheapRerank` で exact query、fileName、token coverage、90日以内 createdAt に固定 bonus を加算する。
  - n-gram、prefix、fuzzy expansion の長さ、件数、重みが固定。
- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
  - `topK=6`、`memoryTopK=4`、`maxIterations=3`、`remainingCalls=3`、`maxReferenceDepth=2`、`minEvidenceCount=2..4`、`maxNoNewEvidenceStreak=2`。
- `memorag-bedrock-mvp/apps/api/src/rag/context-assembler.ts`
  - token budget `3000` を `*4` して文字数換算、snippet max `1800`、通常 prefix `160`。

判断: これらは運用上必要なデフォルト値だが、コード内に散在しており、コーパス規模、文書種別、embedding model、質問種別ごとの調整が難しい。特に min score と topK は index / model ごとの calibration 対象にした方がよい。

### 4.5 memory card 生成の固定件数

- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
  - fallback summary `500` 文字、keywords `30` 件、likelyQuestions / constraints `20` 件、section cards `12` 件、concept terms `8` 件、source chunks `8` 件。
  - concept memory は `chunk.text.includes(term)` と heading 一致で作る。

判断: RAG 品質には影響するが、判定よりは indexing budget の問題。文書長、章数、用語密度に応じた動的生成にすると汎用性が上がる。

### 4.6 benchmark / evaluation 側の固定ルール

- `memorag-bedrock-mvp/benchmark/run.ts`
  - expected text の `includes`、`expectedRegex`、`資料からは回答できません` / `noanswer` 判定、recall@20、ページ表現 regex など。
- `memorag-bedrock-mvp/benchmark/metrics/retrieval.ts`
  - recall@1/3/5/10/20、mrr@10、ndcg@10、precision@5/10。
- `memorag-bedrock-mvp/benchmark/metrics/quality.ts`
  - regression threshold や alias candidate 抽出条件が固定。

判断: これは本番判定ではなく評価 harness なので、固定値自体は許容しやすい。ただし評価対象が増えるなら dataset row に evaluator profile を持たせる方がよい。

## 5. 汎用化方針

1. RAG policy / profile を導入する。
   - `RetrievalProfile`、`AnswerPolicy`、`FactExtractionPolicy`、`EvaluatorProfile` のような設定単位を作り、topK、score 閾値、RRF weight、query expansion、invalid answer rule、domain anchors をコード外へ出す。
   - profile は tenant、collection、document type、benchmark suite ごとに選べるようにし、debug trace に使用 profile version を残す。

2. 要求分類 special case を domain policy へ移す。
   - `ソフトウェア要求の分類`、SWEBOK 固有語、invalid answer pattern は production code の汎用 prompt から外し、特定 corpus 用の policy または benchmark dataset の期待値に移す。
   - 汎用 prompt は「分類質問では、根拠 chunk 内で分類対象として明示された項目だけを列挙する」程度に留める。

3. query intent / required facts を structured planning に寄せる。
   - 正規表現で amount/date/procedure を決める代わりに、LLM または lightweight classifier で `{intent, requiredFacts, factType, subject, scope, expectedValueType}` を出す。
   - deterministic check は `date`, `money`, `person`, `organization`, `duration`, `count`, `status`, `location`, `condition` などの typed extractor として plug-in 化する。

4. conflict 判定は typed claim extraction にする。
   - evidence sentence から `{subject, predicate, value, unit, scope, effectiveDate, sourceChunkId}` を抽出し、同一 subject/predicate/scope で排他的な value がある場合だけ conflict candidate にする。
   - deadline / money 専用 regex は fallback extractor に落とし、最終判断は LLM judge または claim schema 上の比較に委ねる。

5. retrieval パラメータを adaptive にする。
   - min score は固定値ではなく、score 分布、top1-topN gap、semantic/lexical overlap、corpus size、query type から判定する。
   - topK / lexicalTopK / semanticTopK は query complexity と recall target に応じて決める。
   - RRF weight と cheap rerank bonus は benchmark で profile ごとに calibration する。

6. memory / context budget を文書構造に合わせる。
   - section 数、chunk 数、table / list / code 比率、質問の complexity に応じて memory card 数や snippet budget を決める。
   - context assembly は keyword anchor ではなく、section metadata、claim coverage、MMR / diversity、引用可能性を使って選ぶ。

7. benchmark の期待判定を dataset 側に寄せる。
   - `expectedContains` / `expectedRegex` は現状通り dataset に置きつつ、row ごとに `evaluatorProfile` を指定できるようにする。
   - regression threshold も global default ではなく suite / metric ごとに持つ。

## 6. 優先度付きの次アクション案

1. 高: 要求分類 special case を `AnswerPolicy` に隔離する。
   - 既存テストは policy を明示して通す。
   - default policy では SWEBOK 固有語を使わない。

2. 高: `answerability-gate` の amount/date/procedure regex を `requiredFacts.factType` ベースへ置き換える。
   - 最初は LLM sufficient context gate を主判定にし、regex gate は fallback / debug signal に落とす。

3. 中: retrieval profile を作り、topK、lexicalTopK、semanticTopK、RRF weight、BM25 parameter、cheap rerank bonus を集約する。
   - まずはコード外化し、次に benchmark calibration へ進む。

4. 中: `retrieval-evaluator` の conflict 検出を typed claim extraction へ移行する。
   - deadline / money は既存実装を extractor の一種として保持し、対象 fact type を増やす。

5. 中: context assembly を query anchors から coverage / diversity / section metadata ベースへ寄せる。

## 7. 実施した作業

- `rg` で RAG、retrieval、judge、threshold、regex、classification、score、alias などを検索した。
- `nl -ba` / `sed` で該当ファイルを確認した。
- 既存作業レポートを確認し、過去に alias 固定値削除と retrieval evaluator 改修が行われていることを反映した。
- 調査結果と汎用化方針を本レポートに整理した。

## 8. 検証

- コード変更は行っていないため、lint / typecheck / test / build は実行していない。
- 確認に使った主なコマンド:
  - `rg`
  - `nl -ba`
  - `sed`
  - `git status --short`
  - `date +%Y%m%d-%H%M`

## 9. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `reports/working/20260506-1157-rag-rule-hardcode-review.md` | Markdown | RAG / 判定周辺の固定値調査と汎用化方針 | R1-R5 |

## 10. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.5 / 5 | RAG、search、agent 判定、benchmark を確認し、主要な固定値候補を整理した。 |
| 制約遵守 | 5.0 / 5 | コード変更はせず、調査とレポート作成に限定した。 |
| 成果物品質 | 4.5 / 5 | ファイル単位で問題箇所と汎用化方針を対応づけた。 |
| 説明責任 | 4.5 / 5 | 許容しやすい固定値とリスクの高い固定ルールを分けた。 |
| 検収容易性 | 4.5 / 5 | 次アクションの優先度を示し、未実施検証を明記した。 |

総合fit: 4.6 / 5.0（約92%）

理由: 主要な固定値・ルールベース箇所と汎用化方針は整理できた。実装変更や benchmark による定量評価は今回の範囲外として未実施。

## 11. 未対応・制約・リスク

- 実装変更は行っていない。
- ローカル実行による RAG 応答比較や benchmark は行っていない。
- コード行の静的確認に基づく調査であり、本番データでの発生頻度や影響度は未測定。
- 汎用化は段階的に進める必要があり、特に要求分類 special case の隔離は既存テスト期待値の更新を伴う可能性がある。
