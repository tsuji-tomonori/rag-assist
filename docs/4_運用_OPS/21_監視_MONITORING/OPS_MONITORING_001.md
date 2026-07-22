# MemoRAG MVP 監視・検証ランブック

- ファイル: `docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md`
- 種別: `OPS_MONITORING`
- 状態: Active（cost-first mode）
- 最終更新: 2026-07-22

## 目的

現行 MVP の最優先事項は AWS recurring cost の最小化である。API、ログ、benchmark、deploy、docs freshness の必要最小限の観測点を維持しながら、利用者操作がない状態で S3 prefix を定期全走査する background control を停止する。

2026-07-22 の owner decision により、Draft/inferred の `FR-066`、`FR-086`、`FR-093` が要求していた常時 cleanup / audit reconciliation / RAG quality control loop より `SQ-015` を優先する。

## 現行 cost-first mode

| Control | CloudFormation / runtime state | S3 LIST | Scheduled invocation |
| --- | --- | ---: | ---: |
| RAG quality monitor | `RagQualityMonitorSchedule.State=DISABLED`、`RAG_MONITORING_REQUIRED=0` | 0 | 0 |
| Revocation cleanup | `RevocationCleanupSchedule.State=DISABLED` | 0 | 0 |
| Security audit reconciliation | `SecurityAuditReconciliationSchedule.State=DISABLED` | 0 | 0 |

3つのdomain primitiveとLambda sourceは、明示保守や将来のevent-driven再設計に備えて保持する。停止対象はEventBridge scheduleとproduction runtime dependencyである。

## 残る費用

EventBridge rule、Lambda、IAM、log group、alarm、SNS topicはCloudFormation上に残るが、ruleがdisabledのため定期Lambda invocationと定期log ingestionは発生しない。残余候補はresource自体の固定費、API実利用、deploy、benchmark、手動実行である。

物理resource削除はgenerated infra inventory、CDK snapshot、change set、deploy/rollbackを伴う独立IaC最小化として `tasks/todo/20260722-physical-remove-unused-background-control-infra.md` で追跡する。

## 維持する安全境界

### FR-066

- mutation時のauthoritative denyは維持する。
- periodic physical cleanupは停止する。
- 残存artifactの削除が必要な場合はtenant/resource/operationを明示した保守処理で行う。

### FR-086

- mutation pathのdurable audit intent生成は維持する。
- pending intentを探すperiodic S3 scan/finalizationは停止する。
- `reconciliation_required`が発生した場合は対象intent IDを明示してrepairする。

### FR-093

- full source aggregation、drift detection、alert、safe actionは停止する。
- API/workerは`RAG_MONITORING_REQUIRED=0`で、既存または期限切れのsafety-state objectを参照しない。
- monitoring Lambdaのcompatibility heartbeatも実行しない。

## 現行の観測点

| 対象 | 観測点 | 確認先 |
| --- | --- | --- |
| API生存性 | health endpointのHTTP status | `GET /health`、API Gateway/Lambda logs |
| chat / ingestion | request、error、処理段階 | 対象Lambda log group |
| S3 recurring cost | operation / region / bucket / request count | Cost Explorer、CUR、S3 usage report、CloudTrail data event（有効化済みの場合） |
| benchmark | run status、report、runner log | benchmark API、Step Functions、CodeBuild logs |
| deploy | workflow、CloudFormation event、outputs | GitHub Actions、CloudFormation |
| API/docs drift | generated document freshness | `npm run docs:openapi:check`、`npm run docs:api-code:check` |
| Web/infra docs drift | inventory freshness | `npm run docs:web-inventory:check`、`npm run docs:infra-inventory:check` |

認証情報、source本文、chunk本文、prompt、raw model responseを一般ログへ出力しない。debug traceとartifactは認可、tenant partition、sanitizationを維持する。

## Cost Explorer / CUR 初動確認

1. linked account、service、operation、usage type、region、日次/時間粒度を確認する。
2. S3の請求operation `ListBucket`はCloudTrail event名`ListBuckets`と同一ではないことを確認する。
3. S3 usage reportまたはCURのresource/bucket列で対象bucketを特定する。
4. data eventを有効化済みなら`ListObjects` / `ListObjectsV2`の`userIdentity.sessionContext.sessionIssuer.arn`を確認する。
5. 次のroleが残っていないか確認する。
   - `RagQualityMonitorFunctionServiceRole`
   - `RevocationCleanupFunctionServiceRole`
   - `SecurityAuditReconciliationFunctionServiceRole`
6. deploy後24時間でapplication-originated S3 LISTが0件になったか確認する。
7. LISTが残る場合はAPIの`GET /debug-runs`、GitHub Actionsの`aws s3 sync`、CDK BucketDeployment、CodeBuild、別stack/applicationを切り分ける。

## EventBridge停止確認

CloudFormation templateまたはdeployed ruleで次を確認する。

- `RagQualityMonitorSchedule`: `DISABLED`
- `RevocationCleanupSchedule`: `DISABLED`
- `SecurityAuditReconciliationSchedule`: `DISABLED`
- API / Heavy API / worker環境変数: `RAG_MONITORING_REQUIRED=0`

旧`quality-control/runtime/safety-state.json`が残っていても、cost-first runtimeは読み込まない。

## Explicit maintenance

### Revocation cleanup

scheduled workerは処理しない。物理cleanupが必要な場合は以下を事前に決める。

- tenant ID
- resource type / resource ID
- operation ID
- authoritative deny version
- cleanup対象scope
- 最大request数とbudget
- rollback / retry / audit方法

空キュー確認のためにbucket prefix全体をlistしない。

### Security audit reconciliation

pending/finalization-pendingを修復する場合はtenantとintent IDを明示する。全intentのpolling enumerationを行わない。repair後はauthoritative stateとcompleted eventの相関を確認する。

## Full control再有効化条件

次を全て満たすまでcontinuous cleanup / reconciliation / monitoringを再有効化しない。

- Product/FinOps ownerの明示承認
- 月額・日額・単位request cost ceiling
- idle時有料operationゼロの設計
- queue、DynamoDB index、time-partitioned key等による対象限定
- bounded batch / retry / dead-letter
- retention / lifecycle
- cost alarmとkill switch
- load testと24時間cost evidence
- rollback手順

S3 prefix全件を固定間隔でpollingする設計は不合格とする。

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
| API worker contract | targeted Node tests |
| API type | `npm run typecheck -w @memorag-mvp/api` |
| repository lint | `npm run lint` |
| docs構成/freshness | `task docs:check` |
| product runtime source audit | `npm run rag:release:source-audit` |
| whitespace/conflict | `git diff --check` |

未実施の確認を実施済みとしない。actual AWSのLIST停止はdeploy後のCost Explorer/CUR/data eventで確認する。

## 運用検証状況

repository-localのsource変更とunit/CI結果は確認対象に含む。一方、live AWSのS3 request count、CloudFormation update、24時間cost evidence、pending cleanup/audit件数はdeploy後まで未検証である。

## 受け入れ条件

- AC-OPS-MON-001: 3つのEventBridge scheduleがDISABLEDで、scheduled Lambda invocationを行わないこと。
- AC-OPS-MON-002: RAG monitoringをoptional化し、stale safety-stateに依存せずAPI availabilityを維持すること。
- AC-OPS-MON-003: FR-066 authoritative denyとFR-086 durable intentが停止対象ではないこと。
- AC-OPS-MON-004: deferred guaranteeと残余riskを要件・PR・runbookで説明できること。
- AC-OPS-MON-005: deploy後にregion/bucket/role別のLIST停止を検証できること。
- AC-OPS-MON-006: full control再有効化にowner承認とcost evidenceが必要であること。
- AC-OPS-MON-007: unused EventBridge/Lambda/Alarm/SNSの物理削除を次のIaC最小化候補として追跡できること。

## 参照

- `FR-066`
- `FR-086`
- `FR-093`
- `SQ-015`
- `tasks/done/20260722-2300-cost-first-disable-background-s3-scans.md`
- `tasks/todo/20260722-physical-remove-unused-background-control-infra.md`
