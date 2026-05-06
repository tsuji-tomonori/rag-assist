# Operations

## ローカル運用

初回セットアップ:

```bash
npm install
cp .env.example .env
```

ローカルAPI:

```bash
task dev:api
```

ローカルUI:

```bash
task dev:web
```

Docker Compose:

```bash
task docker:up
task docker:down
```

## 検証

静的検証:

```bash
task verify
```

起動済みAPIへのスモークテスト:

```bash
task smoke:api
```

サンプルベンチマーク:

```bash
task benchmark:sample
```

## 主要環境変数

| 変数 | 用途 | ローカル既定値 |
| --- | --- | --- |
| `PORT` | API listen port | `8787` |
| `MOCK_BEDROCK` | Bedrockモック利用 | `false` |
| `USE_LOCAL_VECTOR_STORE` | ファイルベースstore利用 | production以外は`true` |
| `USE_LOCAL_QUESTION_STORE` | 担当者問い合わせのローカルstore利用 | production以外は`true` |
| `USE_LOCAL_CONVERSATION_HISTORY_STORE` | 会話履歴のローカルstore利用 | production以外は`true` |
| `LOCAL_DATA_DIR` | ローカル保存先 | `.local-data` |
| `AUTH_ENABLED` | Cognito JWT認証をAPIで有効化 | `false` |
| `COGNITO_REGION` | Cognito User Pool リージョン | 未設定 |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | 未設定 |
| `COGNITO_APP_CLIENT_ID` | Cognito App Client ID | 未設定 |
| `QUESTION_TABLE_NAME` | 担当者問い合わせ DynamoDB table | `memorag-human-questions` |
| `CONVERSATION_HISTORY_TABLE_NAME` | 会話履歴 DynamoDB table | `memorag-conversation-history` |
| `DEFAULT_MODEL_ID` | 回答生成モデル | `amazon.nova-lite-v1:0` |
| `DEFAULT_MEMORY_MODEL_ID` | memory card/clue生成モデル | `DEFAULT_MODEL_ID` |
| `EMBEDDING_MODEL_ID` | 埋め込みモデル | `amazon.titan-embed-text-v2:0` |
| `EMBEDDING_DIMENSIONS` | vector次元数 | `1024` |
| `RAG_PROFILE_ID` | retrieval profile selector。`default` / `adaptive-retrieval` 以外は起動時に失敗 | `default` |
| `RAG_DOMAIN_POLICY_ID` | default answer policy。SWEBOK 固有 rule は `swebok-requirements-policy` で opt-in | `default-answer-policy` |
| `RAG_ADAPTIVE_RETRIEVAL` | score 分布と overlap diagnostics に基づく adaptive retrieval を有効化 | `false` |
| `MIN_RETRIEVAL_SCORE` | no-answer判定閾値 | `0.20` |
| `RAG_DEFAULT_TOP_K` / `RAG_MAX_TOP_K` | 通常チャットの evidence 件数既定値と上限 | `6` / `20` |
| `RAG_DEFAULT_MEMORY_TOP_K` / `RAG_MAX_MEMORY_TOP_K` | memory card 検索件数既定値と上限 | `4` / `10` |
| `RAG_DEFAULT_MAX_ITERATIONS` / `RAG_MAX_ITERATIONS` | retrieval loop の既定反復数と上限 | `3` / `8` |
| `RAG_DEFAULT_SEARCH_BENCHMARK_TOP_K` | `/search` と search benchmark suite の既定 topK。`RAG_MAX_TOP_K` と `RAG_SEARCH_RAG_MAX_TOP_K` の小さい方で clamp される | `10` |
| `RAG_SEARCH_CANDIDATE_MIN_TOP_K` | RRF・context expansion 用に内部保持する最小候補数。`RAG_SEARCH_RAG_MAX_TOP_K` で clamp される | `30` |
| `RAG_SEARCH_LEXICAL_TOP_K` / `RAG_SEARCH_SEMANTIC_TOP_K` | hybrid retrieval の lexical / semantic 候補取得件数。`RAG_SEARCH_RAG_MAX_SOURCE_TOP_K` で clamp される | `80` / `80` |
| `RAG_SEARCH_RRF_K` / `RAG_SEARCH_LEXICAL_WEIGHT` / `RAG_SEARCH_SEMANTIC_WEIGHT` | RRF の k と lexical / semantic weight | `60` / `1` / `0.9` |
| `RAG_SEARCH_BM25_K1` / `RAG_SEARCH_BM25_B` | lexical BM25 parameter | `1.2` / `0.75` |
| `RAG_ADAPTIVE_TOP_GAP_EXPAND_BELOW` / `RAG_ADAPTIVE_OVERLAP_BOOST_AT_LEAST` / `RAG_ADAPTIVE_SCORE_FLOOR_QUANTILE` | adaptive retrieval の gap / overlap / score floor 判断 | `0.015` / `0.35` / `0.25` |
| `RAG_ADAPTIVE_MIN_COMBINED_SCORE` | adaptive retrieval が RRF + rerank の combined score に適用する下限。`MIN_RETRIEVAL_SCORE` とは分離する | `0` |
| `RAG_SEARCH_RAG_MAX_TOP_K` / `RAG_SEARCH_RAG_MAX_SOURCE_TOP_K` | `/search` 実装の最終返却件数上限と lexical / semantic source 候補の上限 | `50` / `100` |
| `RAG_SEARCH_SEMANTIC_PREFETCH_MULTIPLIER` | semantic search の権限制御後 candidate を確保するための事前取得倍率 | `3` |
| `RAG_MEMORY_PREFETCH_MULTIPLIER` / `RAG_MEMORY_PREFETCH_MAX_TOP_K` | memory 検索の事前取得倍率と上限 | `3` / `100` |
| `RAG_MIN_EVIDENCE_COUNT_MIN` / `RAG_MIN_EVIDENCE_COUNT_MAX` | search plan の evidence count 判定範囲 | `2` / `4` |
| `RAG_MAX_NO_NEW_EVIDENCE_STREAK` | 新規 evidence なしで検索を停止する連続回数 | `2` |
| `RAG_REFERENCE_MAX_DEPTH` / `RAG_SEARCH_BUDGET_CALLS` | 参照解決深度と検索 budget | `2` / `3` |
| `RAG_CONTEXT_WINDOW_DECAY` / `RAG_CONTEXT_WINDOW_MAX_SCORE` | 隣接 chunk 展開時だけに使う score 減衰と上限 | `0.03` / `0.99` |
| `RAG_RETRIEVAL_COMBINED_MAX_SCORE` | 通常 hybrid retrieval の combined score 上限 | `0.99` |
| `RAG_RETRIEVAL_LEXICAL_BASE_SCORE` / `RAG_RETRIEVAL_LEXICAL_LOG_DIVISOR` / `RAG_RETRIEVAL_MAX_SOURCE_SCORE` | lexical score 正規化と source score 上限 | `0.35` / `3` / `0.95` |
| `RAG_CROSS_QUERY_RRF_BOOST_CAP` / `RAG_CROSS_QUERY_RRF_BOOST_MULTIPLIER` | 複数 query RRF boost の上限と倍率 | `0.08` / `3` |
| `RAG_LLM_TEMPERATURE` | RAG の clue、judge、回答生成、memory card 生成で使う LLM temperature | `0` |
| `RAG_CLUE_MAX_TOKENS` / `RAG_FINAL_ANSWER_MAX_TOKENS` / `RAG_MEMORY_CARD_MAX_TOKENS` | clue、最終回答、memory card 生成の max tokens | `600` / `1200` / `1000` |
| `RAG_SUFFICIENT_CONTEXT_MAX_TOKENS` / `RAG_RETRIEVAL_JUDGE_MAX_TOKENS` / `RAG_ANSWER_SUPPORT_MAX_TOKENS` / `RAG_ANSWER_REPAIR_MAX_TOKENS` | LLM judge / verifier / repair の max tokens | `900` / `700` / `900` / `900` |
| `RAG_LLM_JUDGE_NO_CONFLICT_MIN_CONFIDENCE` | conflict risk を LLM judge が解消できる最小 confidence | `0.7` |
| `RAG_COMPUTED_FACT_CONFIDENCE` / `RAG_FACT_COVERAGE_SUPPORTED_CONFIDENCE` / `RAG_ANSWERABILITY_MAX_CONFIDENCE` | deterministic fact と answerability gate の confidence policy | `0.86` / `0.8` / `0.99` |
| `RAG_PARTIAL_EVIDENCE_CONFIDENCE_CAP` / `RAG_PARTIAL_EVIDENCE_FALLBACK_CONFIDENCE` | partial evidence を後段検証つきで進める場合の confidence policy | `0.78` / `0.66` |
| `RAG_SUPPORT_SUPPORTED_FALLBACK_CONFIDENCE` / `RAG_SUPPORT_UNSUPPORTED_FALLBACK_CONFIDENCE` | answer support verifier の fallback confidence | `0.7` / `0.3` |
| `RAG_CLARIFICATION_MIN_AMBIGUITY_SCORE` / `RAG_CLARIFICATION_CONFIDENCE_CAP` / `RAG_CLARIFICATION_CONFIDENCE_FLOOR` / `RAG_CLARIFICATION_NOT_NEEDED_CONFIDENCE_CAP` | 確認質問 gate の曖昧性判定と confidence 上限・下限 | `0.65` / `0.95` / `0.55` / `0.49` |
| `RAG_JUDGE_CHUNK_LIMIT` / `RAG_JUDGE_REASON_MAX_CHARS` / `RAG_REQUIRED_FACT_LIMIT` | LLM judge 入出力の件数・文字数上限 | `8` / `800` / `12` |
| `RAG_CITATION_LIMIT` / `RAG_SEARCH_CLUE_LIMIT` / `RAG_CLARIFICATION_OPTION_LIMIT` | citation、clue、確認質問 option の上限 | `5` / `6` / `5` |
| `PUBLISH_LEXICAL_INDEX_ON_SEARCH` | 検索 path で lexical index artifact を生成するか。production では read-only 既定 | production以外は`true` |
| `DEBUG_DOWNLOAD_BUCKET_NAME` | debug trace JSON download用S3 bucket | 未設定 |
| `DEBUG_DOWNLOAD_EXPIRES_IN_SECONDS` | debug trace download URL有効期限 | `900` |

`RAG_MAX_TOP_K` は chat / agent state が受け付ける evidence 件数上限、`RAG_SEARCH_RAG_MAX_TOP_K` は `/search` 実装の取得上限である。agent の evidence 実取得数は両方の制約を受けるため、`RAG_MAX_TOP_K` を `RAG_SEARCH_RAG_MAX_TOP_K` より大きくしても search cap を超える chunk は取得されない。

## RAG profile / policy 運用

RAG profile は `RAG_PROFILE_ID`、retrieval profile、answer policy の id / version を debug trace と benchmark artifact に記録する。`RAG_PROFILE_ID=default` は固定 retrieval、`RAG_PROFILE_ID=adaptive-retrieval` は adaptive retrieval を選択する。未知の profile ID は default に fallback せず起動時に失敗する。通常 `/chat` の request / response schema には profile 選択 field を追加しない。profile 切り替えは内部 config、document / collection metadata、benchmark suite config で扱う。

`RAG_ADAPTIVE_RETRIEVAL=true` は `RAG_PROFILE_ID=default` または未指定時に `adaptive-retrieval` を選ぶ互換 shortcut として扱う。search diagnostics の `scoreDistribution`、`topGap`、`lexicalSemanticOverlap`、`adaptiveDecision` を見て、default profile との benchmark 比較を行う。adaptive の `effectiveMinScore` は RRF + rerank の combined score 用であり、no-answer 判定用の `MIN_RETRIEVAL_SCORE` は流用しない。悪化が見つかった場合は `RAG_PROFILE_ID=default` かつ `RAG_ADAPTIVE_RETRIEVAL=false` に戻す。

SWEBOK 要求分類向けの anchor、invalid answer pattern、検索 clue は `swebok-requirements-policy` に隔離する。default policy では `ソフトウェア要求の分類` などの固定語彙を自動注入しない。既存文書でこの policy を使う場合は、document metadata に `domainPolicy: "swebok-requirements"` などを付けて再インデックスする。

## ロール運用

CDK stack は Cognito group として `CHAT_USER`、`ANSWER_EDITOR`、`RAG_GROUP_MANAGER`、`BENCHMARK_RUNNER`、`USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR`、`SYSTEM_ADMIN` を作成する。

| group | 運用上の用途 |
| --- | --- |
| `CHAT_USER` | 通常チャット、本人の会話履歴、担当者問い合わせ登録 |
| `ANSWER_EDITOR` | 担当者問い合わせの一覧、回答、解決 |
| `RAG_GROUP_MANAGER` | 文書登録、文書削除、再インデックス運用、benchmark run 起動 |
| `BENCHMARK_RUNNER` | CodeBuild runner から隔離された benchmark corpus を seed し、`/benchmark/query` と `/benchmark/search` を実行 |
| `USER_ADMIN` | Cognito User Pool の全ユーザー参照、管理台帳上のユーザー作成、停止、再開、削除、利用状況確認 |
| `ACCESS_ADMIN` | ロール定義参照、ロール付与、管理操作履歴参照 |
| `COST_AUDITOR` | 概算コスト監査 |
| `SYSTEM_ADMIN` | debug trace、benchmark cancel/download、管理者検証、Phase 2 管理操作 |

通常利用者に `ANSWER_EDITOR`、`USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR`、`SYSTEM_ADMIN` を付与しない。担当者には `ANSWER_EDITOR` を付与する。性能テストを起動する運用者には `RAG_GROUP_MANAGER`、CodeBuild runner 用 service user には `BENCHMARK_RUNNER`、debug trace と benchmark 成果物を確認する管理者には `SYSTEM_ADMIN` を付与する。

ログイン画面から self sign-up したユーザーは、メール確認後に Cognito post-confirmation trigger で `CHAT_USER` のみを自動付与する。担当者、管理、監査、`SYSTEM_ADMIN` などの上位権限は、管理ユーザーが対象者と必要性を確認し、`.github/workflows/memorag-create-cognito-user.yml` または AWS 管理手順で後から付与する。

管理者設定のユーザー管理一覧は `GET /admin/users` で Cognito User Pool の全ユーザーを読み取り、email または Cognito `sub` で管理台帳とマージして表示する。Cognito はユーザー発見用 directory として扱い、管理画面上のロール、停止、再開、削除状態は管理台帳を source of truth とする。Cognito に存在しても管理台帳で `deleted` のユーザーは一覧に戻さない。実際の API 認可は Cognito group を含む JWT で判定するため、上位権限の実効付与は GitHub Actions または AWS 管理手順で Cognito group を更新する。API Lambda には `cognito-idp:ListUsers` と `cognito-idp:AdminListGroupsForUser` を User Pool ARN に限定して付与する。

Cognito group 取得が一部ユーザーで失敗した場合、一覧取得は継続し、該当ユーザーの Cognito group は空配列として扱う。API は CloudWatch Logs に `cognito_user_directory_group_lookup_failed` と `cognito_user_directory_group_lookup_failure_summary` を JSON で出力し、summary は Embedded Metric Format の `MemoRAG/Admin` namespace に `CognitoGroupLookupFailureCount` と `CognitoGroupLookupFailureRate` を記録する。これらが 0 以外の場合は IAM、User Pool ID、Cognito region、対象ユーザー状態を確認する。

デプロイ後の smoke test では、管理者 token で `GET /admin/users` を実行し、初回ログイン前の Cognito ユーザーが表示されること、Cognito group lookup 失敗 metric が 0 であること、管理台帳で `deleted` にしたユーザーが再表示されないこと、管理画面上のロールと実効 Cognito group の運用差分が利用者に説明されていることを確認する。

## AWSデプロイ前チェック

- Bedrockの利用モデルを対象リージョンで有効化する。
- `EMBEDDING_DIMENSIONS` とS3 Vectors indexのdimensionを一致させる。
- 文書データに社外秘や個人情報が含まれる場合、S3 bucket policy、KMS、ログ出力方針を本番基準に更新する。
- MVPのCDKはRAG動作検証用なので、SSO、WAF、詳細監査ログは本番化時に追加する。

## GitHub Actionsデプロイ

`.github/workflows/deploy.yml` から手動デプロイできる。AWS認証はOIDC前提で、GitHub secret `AWS_DEPLOY_ROLE_ARN` にAssumeRole先のARNを設定する。

詳細は [GitHub Actions Deploy](GITHUB_ACTIONS_DEPLOY.md) を参照する。

## 障害時の初動

- APIが応答しない場合は `/health`、Lambda logs、API Gateway logsの順に確認する。
- 回答が空になる場合は `/chat` の `includeDebug=true` でmemory/chunk検索結果とscoreを確認する。
- debug/評価ビューでは、debug trace を RAG workflow のフローチャート、ノード詳細、fact coverage、evidence、answer support として確認できる。`可視化JSON` は raw trace と graph model を含む replay 用 JSON で、API に接続できない環境でも `JSONをアップロード` から再表示できる。
- 共有用の replay JSON は `SYSTEM_ADMIN` または `chat:admin:read_all` を持つ管理者が扱い、raw prompt、chunk text、alias/ACL の詳細が含まれる可能性を前提に社外共有しない。
- 文書が検索されない場合はdocument manifest、vector metadata、embedding dimensionの不一致を確認する。
- 担当者問い合わせ送信後に 403 が出る場合は、通常利用者で `GET /questions` や `GET /debug-runs` が発火していないか確認する。
- 担当者対応ビューが表示されない場合は、対象ユーザーに `ANSWER_EDITOR` group が付与され、ID token の `cognito:groups` に反映されているか確認する。
- AWS実行時にBedrockエラーが出る場合はリージョン、モデル有効化、IAMの `bedrock:InvokeModel` と `bedrock:Converse` を確認する。

## 再インデックス運用

文書の chunker、extractor、embedding model、dimensions を変える場合は、`POST /documents/{documentId}/reindex/stage` で staged document を作成し、`GET /documents/reindex-migrations` で状態を確認してから `cutover` する。検索 runtime は `lifecycleStatus=active` の manifest/vector だけを対象にするため、staging 中の document は通常検索に出ない。cutover 後に問題が見つかった場合は `rollback` で旧 source と structured block ledger から active document を復元する。

## ベンチマークレポート

`task benchmark:sample` は行ごとの結果JSONL、集計JSON、Markdownレポートを生成する。社内データセットではJSONLの各行に `answerable`、`expectedContains`、`expectedFiles`、必要に応じて `expectedPages` と fact slot 系の期待値を指定すると、回答可能問題の正答率、回答不能問題の拒否率、unsupported answer rate、citation/file/page hit rate、fact slot coverage、p95 latencyを確認できる。Markdown report は `Dataset Coverage` と metric ごとの `status`、`basis`、`note` を出力する。`status=not_applicable` は分母や期待値フィールドがなく、その dataset では評価対象外であることを示す。`0.0%` や `0` は分母が存在したうえで成功件数または count が 0 だったことを示す。

`standard-agent-v1` のような回答可能な通常QAだけの dataset では、clarification / refusal / post-clarification / fact slot / page / LLM judge label-rate 系の分母が存在しないことがある。この場合、`answerable_accuracy`、`over_clarification_rate`、`answer_contains_rate`、`citation_hit_rate`、`expected_file_hit_rate`、`retrieval_recall_at_20`、latency 系を主要指標として扱い、clarification 評価は `clarification-smoke-v1` または `benchmark/dataset.clarification.sample.jsonl` のような専用 dataset で確認する。`clarification_latency_delta_vs_non_clarification_ms` は actual clarification 行の平均 latency から non-clarification 行の平均 latency を引いた差分であり、同一質問の overhead ではない。

確認質問 dataset では `followUp` を指定すると option の `resolvedQuery` で二段目の問い合わせを行い、`latencyMs` は初回 API call、`taskLatencyMs` と `postClarificationTaskLatencyMs` は確認質問から follow-up 完了までの task latency として出力する。`includeDebug=true` の benchmark response から `retrieval_evaluator` の `riskSignals` と `llmJudge` も集計し、judge 発火率、`NO_CONFLICT` / `CONFLICT` / `UNCLEAR` の内訳、解消率を report に出力する。

benchmark runner は summary と report に quality review を出力する。`BASELINE_SUMMARY=<過去のsummary.json>` を指定すると、`answerableAccuracy`、`retrievalRecallAt20`、`refusalPrecision`、`unsupportedSentenceRate`、`p95LatencyMs` などの劣化を閾値で検知する。検索 miss や期待語不足の failure から alias candidate も出力するため、`/admin/aliases` の draft 作成候補としてレビューできる。

evaluator profile は summary JSON、results JSONL、Markdown report に id / version を記録する。未指定の dataset row は suite-level の profile として扱う。未知の evaluator profile は default に fallback せず失敗する。row の `evaluatorProfile` は suite-level profile と同一の場合だけ許容し、異なる profile が混在する dataset は集計値の `recall@K` が曖昧になるため失敗させる。search benchmark の Markdown report は行ごとの `evaluator_profile` と `recall_k` を表示する。baseline summary と current run の evaluator profile が異なる場合は既定で失敗し、`ALLOW_EVALUATOR_PROFILE_MISMATCH=1` を指定した場合だけ参考比較として続行する。profile mismatch の run は regression 判定の合格扱いにせず、比較条件が違うことを PR 本文や作業レポートに残す。

管理画面の性能テストは Step Functions + CodeBuild runner を使う。dataset は `BenchmarkBucket` の `datasets/agent/` と `datasets/search/`、成果物は `runs/<runId>/` に保存する。CDK は agent 用の `smoke-v1.jsonl`、`standard-v1.jsonl`、`clarification-smoke-v1.jsonl` と search 用の `smoke-v1.jsonl`、`standard-v1.jsonl` を deploy 時に配置する。benchmark の results / summary / report は `BenchmarkBucket` の `runs/<runId>/` に保存され、bucket 側では SSE-S3 を使う。CodeBuild project は起動直後に build ID と log URL を `BenchmarkRunsTable` に記録するため、benchmark 成果物が生成されない failed run でも管理画面から CodeBuild logs を確認できる。CodeBuild runner は `summary.json` から `BenchmarkRunsTable` の `metrics` を更新し、管理画面の p50 / p95 / accuracy / recall 表示に使う。CodeBuild project には customer managed KMS key を設定しており、CodeBuild 側の artifact 暗号化設定として利用する。Step Functions は CloudWatch Logs に `ALL` event を出力する。X-Ray tracing は trace 数に応じた追加コストを避けるため MVP では無効にし、必要になった時点で有効化を再検討する。production API を叩く runner の bearer token は、CDK が作成する Secrets Manager secret と `BENCHMARK_RUNNER` service user から CodeBuild が自動取得する。管理画面の実行者が token を入力する必要はない。`RAG_GROUP_MANAGER` は benchmark run 起動用であり、runner API を直接呼ぶ外部運用 token は `BENCHMARK_RUNNER` service user へ移行する。agent mode runner は `/benchmark/query`、search mode runner は `/benchmark/search` を呼ぶ。

`smoke-agent-v1`、`standard-agent-v1`、`clarification-smoke-v1` は `handbook.md` を期待資料にする。CodeBuild runner は query 実行前に `benchmark/corpus/standard-agent-v1/handbook.md` を `/documents` へ seed し、active chunk が存在することを確認する。同じ `benchmarkSourceHash` と `benchmarkIngestSignature` の seed 済み active document がある場合は再アップロードしない。CodeBuild ではこれらの suite の `BENCHMARK_CORPUS_SUITE_ID` を `standard-agent-v1` に固定し、同じ corpus を共有する。seed 文書は `metadata.source = "benchmark-runner"`、`metadata.docType = "benchmark-corpus"`、`metadata.aclGroups = ["BENCHMARK_RUNNER"]` を強制し、通常利用者の RAG 検索・回答・文書一覧から隔離する。`BENCHMARK_RUNNER` はこの前処理のために `benchmark:seed_corpus` を持ち、seed 文書確認用に `/documents` の一覧取得だけを許可される。通常の `rag:doc:write:group` や `rag:doc:read` は持たないため、任意の一般文書 upload や通常 `/search` は実行できない。

`allganize-rag-evaluation-ja-v1` は `allganize/RAG-Evaluation-Dataset-JA` を Hugging Face から CodeBuild runner 内で取得する。pre_build で `rag_evaluation_result.csv` を JSONL に変換し、`documents.csv` の source PDF を一時 corpus に download してから `/documents` に seed する。Hugging Face または各 PDF 配布元への outbound HTTPS が失敗すると run は dataset 準備失敗として扱う。既定の評価では `target_answer` は `referenceAnswer` として raw results に保持し、file/page/citation/retrieval 指標を中心に見る。公式 leaderboard と同等の O/X 判定ではないため、回答品質を厳密に比較する場合は `ALLGANIZE_RAG_EXPECTED_MODE=strict-contains` または別途 LLM judge profile を検討する。

CodeBuild は起動時に `infra/scripts/resolve-benchmark-auth-token.mjs` を実行し、secret の `username` / `password` から service user を作成または修復し、`BENCHMARK_RUNNER` group に所属させたうえで Cognito `USER_PASSWORD_AUTH` の id token を取得する。外部管理の secret を使いたい場合だけ、CDK context `benchmarkRunnerAuthSecretId` に secret ID または ARN を指定する。secret に `idToken` または `token` がある場合は、その値をそのまま bearer token として使う。`password` は AWS CLI の shorthand ではなく JSON で Cognito に渡すため、記号を含められる。token 解決に失敗した場合、CodeBuild runner は失敗し、Step Functions の benchmark run は `failed` に遷移する。buildspec は `set -euo pipefail` を使うため shell を `bash` に固定し、`/bin/sh` 実行環境で `pipefail` が未対応になることを防ぐ。

AWS Cost Anomaly Detection で KMS または Secrets Manager の少額 anomaly が出た場合は、まず `4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md` の必要リソース表で `BenchmarkProjectKey`、`BenchmarkRunnerAuthSecret`、Secrets Manager の AWS managed key 利用と突合する。benchmark runner を使わない運用では、同ファイルの削除・抑制条件を確認してから CDK 構成変更を検討する。
