# RAG S3 全走査なしで cost-first CDK deploy を復旧する

- 状態: done
- タスク種別: 修正
- 着手: 2026-07-23 01:30 JST
- 完了: 2026-07-23 02:10 JST
- 対象失敗run: `29936120192`
- PR: #447
- リリース種別: `semver:major`

## 背景

PR #446 merge commit `56bf81e139390ec809359fe63f35d04fde3393ed` のmain pushで`Deploy MemoRAG MVP` run `29936120192`が起動したが、AWS上のEventBridge停止を反映するCDK deployまで到達しなかった。

確認結果:

- `Download RAG quality observations`: cancelled
- `Prepare and upload RAG promotion candidate`: skipped
- `Upload RAG promotion evidence and decision`: failure（artifact directory不在）
- build / synth / CDK deploy / outputs: skipped
- workflow artifact: 0件

旧workflowは45分上限のjob内で`quality-control/observations/`全体を`aws s3 sync`していた。monitoringを停止したcost-first profileでは新規observationが生成されず、全履歴scanは不要かつ`SQ-015`と矛盾する。

## 根本原因

cost-first modeでFR-093 monitoringとEventBridge scheduleを停止した一方、deploy workflowは旧FR-075 promotion pathを無条件実行し続けた。停止対象としたS3 full-prefix scanがdeploy前提として残り、コスト削減変更そのものをAWSへ反映できなかった。

`upload-artifact`のNo files errorは、observation download cancellation後にartifact directoryが生成されなかった二次障害である。

## 実施内容

### Deploy workflow

- `DEPLOYMENT_MODE=cost_priority`を明示。
- documents bucket resolutionを削除。
- `aws s3 sync quality-control/observations/`を削除。
- promotion candidateのS3 uploadとautomatic promotion gateを削除。
- policy bootstrap経路を削除。
- repository policyをempty local observation directoryでvalidation。
- model/runtime/workload/price/index/prompt/pipeline/parser/chunkerのCDK contextを設定。
- deployment artifactを必ず生成し、次を記録。
  - `deploymentMode=cost_priority`
  - `promotionGateApplied=false`
  - `deployAllowed=true`
  - `sourceObservationScan=false`
- build / synth / CDK deploy / outputsを`deployment-context.deploy-allowed=true`へ接続。

### Contract test

`benchmark/promotion-workflow.test.ts`で次を固定した。

- deploy workflowに`aws s3 sync`がない
- `quality-control/observations/`参照がない
- documents bucket resolutionがない
- promotion artifactのS3 uploadがない
- cost-priority preparation/artifactが存在する
- build/synth/deploy/outputsがnew outputへ依存する
- 全CDK version contextを維持する

### Requirements / OPS

- `FR-075`: automatic deployのpromotion gateをDeferred、explicit CI gateを維持。
- `SQ-015`: deploy前S3 full-history scan禁止を追加。
- `OPS_MONITORING_001`:失敗run、復旧手順、禁止事項、deploy後確認を追加。
- 作業レポート: `reports/working/20260723-0200-cost-first-deploy-recovery.md`

## 受け入れ条件結果

- [x] deploy workflowに`aws s3 sync`、observation download、documents bucket resolutionが存在しない
- [x] repository policyから全RAG CDK version contextを設定する
- [x] deployment preparation artifactを常に作成する
- [x] build/synth/deploy/outputsがpromotion-candidate outputに依存しない
- [x] workflow contract testがcost-first pathとS3 scan不在を固定する
- [x] `FR-075`、`SQ-015`、runbookを同期した
- [x] PR #447を作成し、`semver:major`を設定した
- [x] final-head MemoRAG CIがpassした

## CI結果

- MemoRAG CI run `29964816432`: success
  - web/api/infra lint: pass
  - infra/API/Web/benchmark typecheck: pass
  - OpenAPI/API code/canonical docs/Web/infra inventory: pass
  - product runtime source audit: pass
  - infra/benchmark/API/Web tests: pass
  - API coverage: C0 90.65%、C1 80.48%（既存改善taskで追跡）
  - Web coverage: C0 90.87%、C1 85.77%
  - all builds、CDK synth/cdk-nag、DynamoDB GSI guard: pass
- Validate Semver Label run `29964822711`: success
- explicit RAG candidate promotion gate: PR eventでは意図どおりskipped

## 未実施・残余リスク

- PRは未merge。
- actual AWS deploy、CloudFormation update、EventBridge rule state確認は未実施。
- automatic deployはproduction observation completeness、threshold pass、non-regressionを保証しない。
- explicit RAG promotion evaluator/CI workflowは保持する。
- CDK asset upload、BucketDeployment、CloudFormation等の必要S3 requestは残る。
- PR merge後のmain deploy成功とAWS上の3 rule `DISABLED`確認が次の運用acceptanceである。
