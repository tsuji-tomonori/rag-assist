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

## 3. 原因分析

旧workflowは45分timeoutのjobで次を実行していた。

```sh
aws s3 sync s3://<documents-bucket>/quality-control/observations/ artifacts/rag-observations/
```

monitoringを停止したcost-first profileでは新規observation生成を止めた一方、deployだけが全履歴scanを要求し続けていた。これは次の問題を持つ。

- S3 LIST / GET費用を再発させる
- object数に比例して遅くなる
- monitoring停止後はevidence completenessが収束しない
- scan失敗・timeoutでcost-control infrastructure変更そのものをdeployできない

`upload-artifact`のNo filesは、upstreamのdownload cancellationにより`artifacts/rag-promotion/`が生成されなかった二次障害である。

## 4. 修正

### Deploy workflow

- `DEPLOYMENT_MODE=cost_priority`を明示。
- documents bucket resolution、`aws s3 sync`、promotion candidate S3 upload、automatic promotion gateを削除。
- repositoryのapproved policyをempty local observation directoryでvalidation。
- policyから全CDK RAG version contextを設定。
- `policy.json`、空`observations.json`、`preparation.json`を常に作成。
- preparationへ以下を記録。
  - `deploymentMode=cost_priority`
  - `promotionGateApplied=false`
  - `deployAllowed=true`
  - `sourceObservationScan=false`
- deployment contextをGitHub artifactへ保存。
- build / synth / CDK deploy / outputsは`deployment-context.deploy-allowed=true`へ統一。

### Contract test

`benchmark/promotion-workflow.test.ts`で次を固定。

- deploy workflowに`aws s3 sync`がない
- `quality-control/observations/`を参照しない
- documents bucketをpromotion目的で解決しない
- promotion candidate S3 uploadがない
- cost-priority preparationとartifactが存在する
- build/synth/deployがnew context outputへ依存する
-全CDK version contextを維持する

### Requirements / OPS

- `FR-075`: automatic deployのpromotion gateをdeferし、explicit CI gateを保持。
- `SQ-015`: deploy前S3 full-history scan禁止を追加。
- `OPS_MONITORING_001`: run `29936120192`、cost-first deploy手順、禁止事項、deploy後確認を追加。

## 5. Trade-off

現行automatic deployはproduction observation completeness、threshold pass、non-regressionを確認しない。RAG promotion evaluatorとexplicit CI workflowは残す。automatic RAG release profileを戻す場合はbounded evidence index、retention、cost ceiling、owner approvalが必要である。

## 6. 検証状況

PR作成前のrepository-local runtimeはmaterializeしていないため、GitHub Actionsを実行証跡とする。

未実施:

- final-head CI
- actual AWS deploy
- CloudFormation EventBridge state確認
- deploy後24時間のCost Explorer/CUR確認

未実施をpass扱いしない。

## 7. 期待するdeploy成功条件

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
