# RAG S3 全走査なしで cost-first CDK deploy を復旧する

- 状態: do
- タスク種別: 修正
- 着手: 2026-07-23 01:30 JST
- 対象run: `29936120192`

## 背景

PR #446 merge commit `56bf81e139390ec809359fe63f35d04fde3393ed` の main pushで `Deploy MemoRAG MVP` run `29936120192` が起動したが、AWS上のEventBridge停止を反映するCDK deployまで到達しなかった。

確認結果:

- `Download RAG quality observations`: cancelled
- `Prepare and upload RAG promotion candidate`: skipped
- `Upload RAG promotion evidence and decision`: failure（artifact directory不在）
- build / synth / CDK deploy / outputs: skipped
- workflow artifact: 0件

旧workflowは45分上限のjob内で `quality-control/observations/` 全体を `aws s3 sync` していた。monitoringを停止したcost-first profileでは新規observationが生成されず、全履歴scanは不要かつ `SQ-015` と矛盾する。

## 根本原因

cost-first modeでFR-093 monitoringとEventBridge scheduleを停止した一方、deploy workflowは旧FR-075 promotion pathを無条件実行し続けた。結果として、停止対象としたS3 full-prefix scanがdeploy前提として残り、コスト削減変更そのものをAWSへ反映できなかった。

`upload-artifact`のNo files errorは二次障害であり、一次障害はobservation download stepが完了しなかったことである。

## 方針

現行MVPのdeploy profileを明示的な `cost_priority` とし、deploy時にS3 observationを列挙しない。

- repository内のapproved policyを読み、CDK version contextだけを確定する
- empty local observation directoryでpolicy validation/preparation artifactを生成する
- `aws s3 sync quality-control/observations/`、promotion candidate S3 upload、promotion gateを実行しない
- preparation artifactへ `deploymentMode=cost_priority`、`promotionGateApplied=false`、`deployAllowed=true`、`sourceObservationScan=false` を記録する
- build / synth / deployはcontext準備後に実行する
- artifact directoryを必ず生成し、upload-artifactの二次failureを防ぐ

## 要求整理

- `SQ-015`: idle/運用コスト最優先。deployのためのS3 full-prefix scanも禁止対象とする
- `FR-075`: model/prompt/index/pipelineのpromotion gateは将来のopt-in profileへ延期し、現行cost-first infrastructure deployをblockしない
- `FR-093`: monitoring停止中のためproduction observation completenessをdeploy条件にしない

## 受け入れ条件

- [ ] deploy workflowに `aws s3 sync`、`quality-control/observations/` download、documents bucket resolutionが存在しない
- [ ] deploy workflowがrepository policyから全RAG CDK version contextを設定する
- [ ] cost-priority deployment preparation artifactを常に作成し、artifact uploadがno-filesで失敗しない
- [ ] build、synth、CDK deploy、outputs uploadがpromotion-candidate outputに依存しない
- [ ] deployment workflow contract testがcost-first pathとS3 scan不在を固定する
- [ ] `FR-075`、`SQ-015`、monitoring runbookを現行deploy profileへ同期する
- [ ] final-head CIがpassする
- [ ] PRを作成し、受け入れ条件・セルフレビューを記録する

## 検証計画

- `benchmark/promotion-workflow.test.ts`
- repository lint / typecheck / tests / docs checks
- GitHub Actions final-head CI
- merge後のmain deploy runでbuild / synth / CDK deploy / outputsを確認
- AWS上の3 EventBridge ruleが`DISABLED`になったことをdeploy outputs / CloudFormation / follow-up AWS確認で検証

## リスク

- cost-first modeではRAG promotion gateをdeploy時に実行しない
- repository policyのversion contextは利用するが、production observationsの完全性・threshold passを保証しない
- CDK deploy自体のasset upload / bucket deployment等の必要なS3 requestは残る
- PRをmergeするまでAWS上の既存EventBridge ruleは停止されない
