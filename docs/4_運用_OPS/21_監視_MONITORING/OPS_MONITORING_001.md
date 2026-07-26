# MemoRAG MVP 監視・検証ランブック

- ファイル: `docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md`
- 種別: `OPS_MONITORING`
- 状態: Active（cost-first mode）
- 最終更新: 2026-07-23

## 目的

現行MVPの最優先事項はAWS recurring costの最小化である。API、ログ、benchmark、deploy、docs freshnessの必要最小限の観測点を維持しながら、background処理とdeploy前処理によるS3 prefix全走査を停止する。

owner decisionにより、Draft/inferredの`FR-066`、`FR-075`、`FR-086`、`FR-093`が要求していた常時cleanup、automatic promotion、audit reconciliation、RAG quality control loopより`SQ-015`を優先する。

## 現行 cost-first mode

| Control | CloudFormation / runtime state | S3 LIST | Scheduled invocation |
| --- | --- | ---: | ---: |
| RAG quality monitor | `RagQualityMonitorSchedule.State=DISABLED`、`RAG_MONITORING_REQUIRED=0` | 0 | 0 |
| Revocation cleanup | `RevocationCleanupSchedule.State=DISABLED` | 0 | 0 |
| Security audit reconciliation | `SecurityAuditReconciliationSchedule.State=DISABLED` | 0 | 0 |
| Automatic deploy preparation | `DEPLOYMENT_MODE=cost_priority`、repository policy validation | observation LIST 0 | main/manual deploy時のみ |

3つのdomain primitiveとLambda source、RAG observation contract、policy evaluator、明示RAG promotion gateは、明示保守や将来のbounded/event-driven再設計に備えて保持する。

## 残る費用

EventBridge rule、Lambda、IAM、log group、alarm、SNS topicはCloudFormation上に残るが、ruleがdisabledのため定期Lambda invocationと定期log ingestionは発生しない。残余候補はresource自体の固定費、API実利用、CDK deployのasset upload、bucket deployment、benchmark、明示workflowである。

物理resource削除はgenerated infra inventory、CDK snapshot、change set、deploy/rollbackを伴う独立IaC最小化として`tasks/todo/20260722-physical-remove-unused-background-control-infra.md`で追跡する。

## 維持する安全境界

### FR-066

- mutation時のauthoritative denyは維持する。
- periodic physical cleanupは停止する。
- 残存artifactの削除が必要な場合はtenant/resource/operationを明示した保守処理で行う。

### FR-086

- mutation pathのdurable audit intent生成は維持する。
- pending intentを探すperiodic S3 scan/finalizationは停止する。
- `reconciliation_required`が発生した場合は対象intent IDを明示してrepairする。

### FR-075 / FR-093

- full production observation aggregation、automatic promotion、drift detection、alert、safe actionはautomatic deployから外す。
- API/workerは`RAG_MONITORING_REQUIRED=0`で、既存または期限切れのsafety-state objectを参照しない。
- observation schema、versioned evidence、policy evaluator、explicit RAG promotionは削除しない。
- explicit RAG promotionは`MemoRAG CI`の明示workflowまたは将来のowner承認済みrelease profileで実行する。

## 現行の観測点

| 対象 | 観測点 | 確認先 |
| --- | --- | --- |
| API生存性 | health endpointのHTTP status | `GET /health`、API Gateway/Lambda logs |
| chat / ingestion | request、error、処理段階 | 対象Lambda log group |
| S3 recurring/deploy cost | operation / region / bucket / request count | Cost Explorer、CUR、S3 usage report、CloudTrail data event（有効化済みの場合） |
| benchmark | run status、report、runner log | benchmark API、Step Functions、CodeBuild logs |
| deploy | workflow steps、context artifact、CloudFormation event、outputs | GitHub Actions、CloudFormation |
| API/docs drift | generated document freshness | `npm run docs:openapi:check`、`npm run docs:api-code:check` |
| Web/infra docs drift | inventory freshness | `npm run docs:web-inventory:check`、`npm run docs:infra-inventory:check` |

認証情報、source本文、chunk本文、prompt、raw model responseを一般ログへ出力しない。debug traceとartifactは認可、tenant partition、sanitizationを維持する。

## Deploy run `29936120192` の障害

PR #446 merge後のmain deployはAWS上のEventBridge停止を反映できなかった。

| Step | Result |
| --- | --- |
| AWS credential / stack bucket解決 | success |
| `Download RAG quality observations` | cancelled |
| promotion candidate preparation | skipped |
| promotion artifact upload | failure（directory不在） |
| build / synth / CDK deploy / outputs | skipped |

旧workflowは45分上限内で`quality-control/observations/`全体を`aws s3 sync`していた。RAG observationは明示promotionの品質証拠として利用価値があるが、過去履歴全体は通常のinfra deploy判断に不要である。artifact upload failureはdownload cancellation後の二次障害であり、CDK deploy未実施が本質である。

## Cost-first automatic deploy

`Deploy MemoRAG MVP`は次の順序で実行する。

1. repositoryの`config/rag-quality/dev-policy.json`をapproved policyとしてvalidationする。
2. empty local observation directoryを入力し、`policy.json`、空の`observations.json`、`preparation.json`を必ず生成する。
3. policyからmodel/runtime/workload/price/index/prompt/pipeline/parser/chunkerのCDK contextを設定する。
4. `preparation.json`へ次を記録する。
   - `deploymentMode=cost_priority`
   - `promotionGateApplied=false`
   - `deployAllowed=true`
   - `sourceObservationScan=false`
5. GitHub artifactとしてdeployment contextを保存する。
6. AWS credentialを設定し、build、synth、CDK deploy、outputs uploadを実行する。

禁止事項:

- `aws s3 sync quality-control/observations/`
- documents bucketの解決をpromotion前提にすること
- promotion candidateをS3へ再uploadすること
- observation completenessをcost-first deployのblock条件にすること
- upstream step失敗後に存在しないartifact pathを`if-no-files-found:error`で二次failureさせること

必要なS3 requestはCDK asset uploadやBucketDeployment等、実deployに不可欠なものへ限定する。

## Observation artifactの取り扱い

RAG observationは削除対象ではなく、明示RAG promotionの入力証拠として保持できる。ただし、取得境界を次のように分ける。

### 通常deploy

- production S3のobservationを読まない。
- observationの有無、件数、完全性をbuild/synth/CDK deployの前提にしない。
- repository policyとdeployment contextだけを使用する。

### 明示RAG promotion

- candidate、policy version、evaluation runを明示する。
- evidence manifest、明示object key、time-partitioned prefix、または単一のversioned `observations.json`からboundedに取得する。
- 判定に使用したpolicy、candidate、run、observation artifact identity、request countをpromotion artifactへ記録する。
- bucket内の全profile、全version、全期間のobservation履歴を同期しない。

推奨例:

```text
quality-control/promotion-evidence/<policy-version>/<candidate-id>/<evaluation-run-id>/observations.json
```

または同等のmanifestで、必要なobject keyを有限集合として列挙する。

## Cost Explorer / CUR 初動確認

1. linked account、service、operation、usage type、region、日次/時間粒度を確認する。
2. S3の請求operation `ListBucket`はCloudTrail event名`ListBuckets`と同一ではないことを確認する。
3. S3 usage reportまたはCURのresource/bucket列で対象bucketを特定する。
4. data eventを有効化済みなら`ListObjects` / `ListObjectsV2`の`userIdentity.sessionContext.sessionIssuer.arn`を確認する。
5. deploy後24時間でapplication-originated background S3 LISTが0件になったか確認する。
6. cost-first deploy runでobservation履歴LIST/GETが0件であることを確認する。
7. explicit promotionを実行した場合はmanifest/object keyとrequest countが承認上限内であることを確認する。
8. LISTが残る場合はAPIの`GET /debug-runs`、CDK BucketDeployment、CodeBuild、別stack/applicationを切り分ける。

## EventBridge停止確認

CloudFormation templateまたはdeployed ruleで次を確認する。

- `RagQualityMonitorSchedule`: `DISABLED`
- `RevocationCleanupSchedule`: `DISABLED`
- `SecurityAuditReconciliationSchedule`: `DISABLED`
- API / Heavy API / worker環境変数: `RAG_MONITORING_REQUIRED=0`

旧`quality-control/runtime/safety-state.json`が残っていても、cost-first runtimeは読み込まない。

## Explicit maintenance

### Revocation cleanup

scheduled workerは処理しない。物理cleanupが必要な場合はtenant ID、resource type/ID、operation ID、authoritative deny version、scope、request上限、budget、rollback/retry/audit方法を事前に決める。空キュー確認のためにbucket prefix全体をlistしない。

### Security audit reconciliation

pending/finalization-pendingを修復する場合はtenantとintent IDを明示する。全intentのpolling enumerationを行わない。repair後はauthoritative stateとcompleted eventの相関を確認する。

### Explicit RAG promotion

RAG candidateを評価する場合はpolicy、candidate、evaluation run、bounded observation manifestまたはversioned evidence artifactを明示してCI promotion gateを実行する。automatic deployのためにproduction S3履歴を全件downloadしない。explicit promotionでも全履歴同期は行わない。

## Full control再有効化条件

次を全て満たすまでcontinuous cleanup、reconciliation、monitoring、automatic promotionを再有効化しない。

- Product/FinOps ownerの明示承認
- 月額・日額・単位request/deploy cost ceiling
- idle時有料operationゼロの設計
- queue、DynamoDB index、time-partitioned key、manifest等による対象限定
- bounded batch / retry / dead-letter
- retention / lifecycle
- cost alarmとkill switch
- load testと24時間cost evidence
- rollback手順

S3 prefix全件を固定間隔またはdeploy前にscanする設計は不合格とする。explicit promotionでもcandidateと無関係なobservation履歴を全件取得しない。

## その他の固定費候補

| AWS service | MemoRAG MVP resource | 継続判断 |
| --- | --- | --- |
| KMS | `BenchmarkProjectKey` | CodeBuild benchmarkを使わない場合は削除候補 |
| Secrets Manager | `BenchmarkRunnerAuthSecret` | production APIを叩くbenchmark runnerを使わない場合は削除候補 |
| CloudWatch | log groups / alarms | retention短縮、unused worker resource削除の候補 |
| SNS | RAG quality alert topic | full monitor停止中は削除候補 |

## ローカル／CI検証

| 目的 | コマンド |
| --- | --- |
| deployment workflow contract | `node --import tsx --test benchmark/promotion-workflow.test.ts` |
| repository lint | `npm run lint` |
| docs構成/freshness | `task docs:check` |
| product runtime source audit | `npm run rag:release:source-audit` |
| whitespace/conflict | `git diff --check` |

未実施の確認を実施済みとしない。actual AWSのEventBridge停止とLIST低下はdeploy後のCloudFormation、Cost Explorer/CUR/data eventで確認する。

## 運用検証状況

repository-localのsource変更とCI結果は確認対象に含む。一方、live AWSのCloudFormation update、rule state、S3 request count、24時間cost evidenceはsuccess deploy後まで未検証である。

## 受け入れ条件

- AC-OPS-MON-001: 3つのEventBridge scheduleがDISABLEDで、scheduled Lambda invocationを行わないこと。
- AC-OPS-MON-002: RAG monitoringをoptional化し、stale safety-stateに依存せずAPI availabilityを維持すること。
- AC-OPS-MON-003: automatic deployがS3 observation履歴をlist/downloadせず、repository policyからbounded contextを生成すること。
- AC-OPS-MON-004: deployment context artifactが常に存在し、promotion gate未適用を明示すること。
- AC-OPS-MON-005: explicit promotionがcandidate固有のbounded evidenceだけを利用し、全observation履歴を同期しないこと。
- AC-OPS-MON-006: FR-066 authoritative denyとFR-086 durable intentが停止対象ではないこと。
- AC-OPS-MON-007: deploy後にregion/bucket/role別のLIST停止とEventBridge rule stateを検証できること。
- AC-OPS-MON-008: full control再有効化にowner承認とcost evidenceが必要であること。
- AC-OPS-MON-009: unused EventBridge/Lambda/Alarm/SNSの物理削除を次のIaC最小化候補として追跡できること。

## 参照

- `FR-066`
- `FR-075`
- `FR-086`
- `FR-093`
- `SQ-015`
- deploy run `29936120192`
- `tasks/done/20260722-2300-cost-first-disable-background-s3-scans.md`
- `tasks/done/20260723-0130-cost-first-deploy-without-rag-s3-scan.md`
- `tasks/todo/20260722-physical-remove-unused-background-control-infra.md`
