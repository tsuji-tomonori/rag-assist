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
| `MIN_RETRIEVAL_SCORE` | no-answer判定閾値 | `0.20` |
| `PUBLISH_LEXICAL_INDEX_ON_SEARCH` | 検索 path で lexical index artifact を生成するか。production では read-only 既定 | production以外は`true` |
| `DEBUG_DOWNLOAD_BUCKET_NAME` | debug trace JSON download用S3 bucket | 未設定 |
| `DEBUG_DOWNLOAD_EXPIRES_IN_SECONDS` | debug trace download URL有効期限 | `900` |

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

管理画面の性能テストは Step Functions + CodeBuild runner を使う。dataset は `BenchmarkBucket` の `datasets/agent/` と `datasets/search/`、成果物は `runs/<runId>/` に保存する。CDK は agent 用の `smoke-v1.jsonl`、`standard-v1.jsonl`、`clarification-smoke-v1.jsonl` と search 用の `smoke-v1.jsonl`、`standard-v1.jsonl` を deploy 時に配置する。benchmark の results / summary / report は `BenchmarkBucket` の `runs/<runId>/` に保存され、bucket 側では SSE-S3 を使う。CodeBuild project には customer managed KMS key を設定しており、CodeBuild 側の artifact 暗号化設定として利用する。Step Functions は CloudWatch Logs に `ALL` event を出力する。X-Ray tracing は trace 数に応じた追加コストを避けるため MVP では無効にし、必要になった時点で有効化を再検討する。production API を叩く runner の bearer token は、CDK が作成する Secrets Manager secret と `BENCHMARK_RUNNER` service user から CodeBuild が自動取得する。管理画面の実行者が token を入力する必要はない。`RAG_GROUP_MANAGER` は benchmark run 起動用であり、runner API を直接呼ぶ外部運用 token は `BENCHMARK_RUNNER` service user へ移行する。agent mode runner は `/benchmark/query`、search mode runner は `/benchmark/search` を呼ぶ。

`smoke-agent-v1`、`standard-agent-v1`、`clarification-smoke-v1` は `handbook.md` を期待資料にする。CodeBuild runner は query 実行前に `benchmark/corpus/standard-agent-v1/handbook.md` を `/documents` へ seed し、active chunk が存在することを確認する。同じ `benchmarkSourceHash` と `benchmarkIngestSignature` の seed 済み active document がある場合は再アップロードしない。CodeBuild ではこれらの suite の `BENCHMARK_CORPUS_SUITE_ID` を `standard-agent-v1` に固定し、同じ corpus を共有する。seed 文書は `metadata.source = "benchmark-runner"`、`metadata.docType = "benchmark-corpus"`、`metadata.aclGroups = ["BENCHMARK_RUNNER"]` を強制し、通常利用者の RAG 検索・回答・文書一覧から隔離する。`BENCHMARK_RUNNER` はこの前処理のために `benchmark:seed_corpus` を持ち、seed 文書確認用に `/documents` の一覧取得だけを許可される。通常の `rag:doc:write:group` や `rag:doc:read` は持たないため、任意の一般文書 upload や通常 `/search` は実行できない。

CodeBuild は起動時に `infra/scripts/resolve-benchmark-auth-token.mjs` を実行し、secret の `username` / `password` から service user を作成または修復し、`BENCHMARK_RUNNER` group に所属させたうえで Cognito `USER_PASSWORD_AUTH` の id token を取得する。外部管理の secret を使いたい場合だけ、CDK context `benchmarkRunnerAuthSecretId` に secret ID または ARN を指定する。secret に `idToken` または `token` がある場合は、その値をそのまま bearer token として使う。`password` は AWS CLI の shorthand ではなく JSON で Cognito に渡すため、記号を含められる。token 解決に失敗した場合、CodeBuild runner は失敗し、Step Functions の benchmark run は `failed` に遷移する。buildspec は `set -euo pipefail` を使うため shell を `bash` に固定し、`/bin/sh` 実行環境で `pipefail` が未対応になることを防ぐ。

AWS Cost Anomaly Detection で KMS または Secrets Manager の少額 anomaly が出た場合は、まず `4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md` の必要リソース表で `BenchmarkProjectKey`、`BenchmarkRunnerAuthSecret`、Secrets Manager の AWS managed key 利用と突合する。benchmark runner を使わない運用では、同ファイルの削除・抑制条件を確認してから CDK 構成変更を検討する。
