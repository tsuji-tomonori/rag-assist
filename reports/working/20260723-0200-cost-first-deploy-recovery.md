# 作業レポート: cost-first deploy復旧

保存先: `reports/working/20260723-0200-cost-first-deploy-recovery.md`

## 1. 依頼

PR #446でmainへ入れたEventBridge停止がAWSへdeploy済みかGitHub Actionsを確認し、必要なら修正PRを作成する。

## 2. GitHub Actions確認

対象: `Deploy MemoRAG MVP` run `29936120192`

- checkout SHA: `56bf81e139390ec809359fe63f35d04fde3393ed`
- job: `CDK deploy`
- job conclusion: `cancelled`
- artifact: 0件

### Step結果

| Step | Result |
| --- | --- |
| Checkout / setup / npm ci / input validation | success |
| AWS credentials | success |
| Documents bucket resolution | success |
| Download RAG quality observations | cancelled |
| Prepare promotion candidate | skipped |
| Promotion gate | skipped |
| Upload promotion evidence | failure（No files） |
| Build | skipped |
| Synth | skipped |
| CDK deploy | skipped |
| Outputs | skipped |

したがって、AWS上のEventBridge ruleがPR #446の`DISABLED`状態へ更新された証拠はなく、deploy未実施と判定した。

ユーザー提示のNode 20 migration noticeと`punycode` deprecation warningは、このrunの停止原因ではない。blocking pointはobservation downloadのcancelと、その後のartifact不在である。

## 3. 原因分析

旧workflowは45分timeoutのjobで次を実行していた。

```sh
aws s3 sync s3://<documents-bucket>/quality-control/observations/ artifacts/rag-observations/
```

RAG observation自体には、candidateの品質・安全性を明示promotionで評価する証拠として価値がある。しかし通常のCDK deployはCloudFormation、Lambda、EventBridge等のinfra変更を反映する処理であり、過去のobservation履歴全体を入力に必要としない。

旧workflowは次の問題を持っていた。

- candidate、policy version、evaluation runと無関係な履歴までS3 LIST / GETする
- object数に比例して費用と時間が増える
- 取得後にprofile/provenance不一致の大部分を破棄する
- monitoring停止後はevidence completenessが収束しない
- scan失敗・timeoutでcost-control infrastructure変更そのものをdeployできない

`upload-artifact`のNo filesは、upstreamのdownload cancellationにより`artifacts/rag-promotion/`が生成されなかった二次障害である。

## 4. 判断境界

本対応は「RAG observationが不要」という判断ではない。

### 保持するもの

- observation schema / versioned observation artifact
- policy evaluator
- benchmark / promotion gate implementation
- explicit CI promotion workflow

### 通常deployから除去するもの

- production S3 observation履歴の全prefix LIST
- 全observation objectのdownload
- observation completenessをinfra deployのblock条件にすること
- promotion candidateをdeployのたびにS3へ再uploadすること

### 将来のexplicit promotion

observationを使う場合も、candidate、policy version、evaluation runを特定するmanifest、明示object key、time-partitioned prefix、または単一のversioned evidence artifactからboundedに取得する。判定に使用したevidence identityとrequest countをpromotion artifactへ記録し、全履歴同期は行わない。

## 5. 修正

PR #447 `💸 deploy前のRAG S3全履歴走査を除去` を作成した。

### Deploy workflow

- `DEPLOYMENT_MODE=cost_priority`を明示。
- documents bucket resolution、`aws s3 sync`、promotion candidate S3 upload、automatic promotion gate、policy bootstrap経路を削除。
- repositoryのapproved policyをempty local observation directoryでvalidation。
- policyから全CDK RAG version contextを設定。
- `policy.json`、空`observations.json`、`preparation.json`を常に作成。
- preparationへ以下を記録。
  - `deploymentMode=cost_priority`
  - `promotionGateApplied=false`
  - `deployAllowed=true`
  - `sourceObservationScan=false`
- deployment contextをGitHub artifactへ保存。
- AWS credential設定をcontext生成・artifact保存の後へ移動。
- build / synth / CDK deploy / outputsは`deployment-context.deploy-allowed=true`へ統一。

### Contract test

`benchmark/promotion-workflow.test.ts`で次を固定した。

- deploy workflowに`aws s3 sync`がない
- `quality-control/observations/`を参照しない
- documents bucketをpromotion目的で解決しない
- promotion candidate S3 uploadがない
- policy bootstrap経路がない
- cost-priority preparationとartifactが存在する
- build/synth/deploy/outputsがnew context outputへ依存する
- 全CDK version contextを維持する
- explicit promotion evaluator/CI gateを削除しない

### Requirements / OPS

- `FR-075`: automatic deployのpromotion gateをdeferし、observation contractとexplicit CI gateを保持。
- `SQ-015`: deploy前S3 full-history scan禁止とbounded observation取得を追加。
- `OPS_MONITORING_001`: run `29936120192`、cost-first deploy手順、observation artifact境界、禁止事項、deploy後確認を追加。
- taskを`tasks/done/20260723-0130-cost-first-deploy-without-rag-s3-scan.md`へ完了移動。

## 6. Trade-off

現行automatic deployはproduction observation completeness、threshold pass、non-regressionを確認しない。これはinfra deployをRAG release promotionから分離する意図的な判断である。

RAG promotion evaluator、observation contract、explicit CI workflowは残す。automatic RAG release profileを戻す場合はcandidate固有のbounded evidence manifest/index、retention、request ceiling、cost ceiling、owner approvalが必要である。

## 7. 検証状況

### GitHub Actions

実装headのMemoRAG CI run `29964816432` はsuccess。

- lint: web / API / infra success
- typecheck: infra / API / Web / benchmark success
- docs: OpenAPI / source-backed API / canonical structure / Web / infra inventory success
- product runtime source audit: success
- tests: infra / benchmark / API / Web success
- API coverage: C0 90.65%、C1 80.48%（既存改善taskで追跡）
- Web coverage: C0 90.87%、C1 85.77%
- builds: infra / API / Web / benchmark success
- CDK synth / cdk-nag: success
- DynamoDB GSI guard: success

Validate Semver Label run `29964822711` はsuccess。explicit RAG candidate promotion gateはPR eventでは意図どおりskipped。

### 未実施

- actual AWS deploy
- CloudFormation EventBridge state確認
- deploy後24時間のCost Explorer/CUR確認
- bounded evidence manifestを用いたproduction explicit promotion profile

未実施をpass扱いしない。

## 8. 期待するdeploy成功条件

修正PR merge後のmain deployで次を確認する。

- `Prepare cost-priority deployment context`: success
- context artifact: uploaded
- `Configure AWS credentials`: success
- build: success
- synth: success
- `CDK deploy`: success
- outputs artifact: uploaded
- observation download step:存在しない

その後AWS/CloudFormationで3 ruleが`DISABLED`であることを確認する。
