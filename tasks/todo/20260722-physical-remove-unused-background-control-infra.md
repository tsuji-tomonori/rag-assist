# 未使用 background control の AWS リソースを物理削除する

- 状態: todo
- タスク種別: 修正
- 作成: 2026-07-22
- 前提PR: #446
- 優先理由: `SQ-015` cost-first

## 背景

PR #446 は継続課金の直接原因である scheduled S3 prefix listing を最短で停止するため、3つのLambda entrypointをcost-priority no-op / compatibility heartbeatへ変更した。一方、CloudFormation上のEventBridge rule、Lambda、IAM、log group、alarm、SNS topicは残るため、Lambda invocation、CloudWatch Logs/metrics/alarm等の小額 recurring costが残る。

## 目的

full monitoring / automatic cleanup / automatic audit reconciliationを使用しない現行MVP構成から、不要なAWS resourceとscheduleを物理削除し、idle recurring costをさらに削減する。

## 対象候補

- `RagQualityMonitorSchedule`
- `RevocationCleanupSchedule`
- `SecurityAuditReconciliationSchedule`
- `RagQualityMonitorFunction`と専用log group / role / policy / permission
- `RevocationCleanupFunction`と専用log group / role / policy / permission
- `SecurityAuditReconciliationFunction`と専用log group / role / policy / permission
- RAG quality control専用alarm / SNS topic / topic policyのうち、他のactive pathが参照しないもの
- bundle targetとgenerated inventory上の関連entry

RAG API compatibilityに必要なsafety state更新方式は、resource削除前に次のいずれかへ置換する。

`RAG_MONITORING_REQUIRED=0`とoptional interlock bypassを維持する

## 受け入れ条件

- [ ] 3つのperiodic EventBridge ruleがCloudFormation templateから削除される。
- [ ] 使用されないLambda、IAM、log group、permissionが削除される。
- [ ] unused alarm / SNS resourceが参照調査に基づき削除または保持理由付きで残る。
- [ ] cost-first production profileでRAG APIがheartbeat Lambdaなしに正常動作する。
- [ ] infra tests、CDK snapshot、generated infra inventoryを同期する。
- [ ] cdk-nag、GSI guard、全CIがpassする。
- [ ] CloudFormation change setで意図しないdata resource削除がないことを確認する。
- [ ] rollback手順を記録する。
- [ ] deploy後24時間、対象Lambda invocation 0、application-originated S3 LIST 0、関連log増加停止を確認する。
- [ ] Cost Explorer/CURで削減前後を比較し、結果を作業レポートへ記録する。

## 検証計画

- static reference / dependency graph
- infra assertion / snapshot tests
- generated inventory freshness
- API worker tests
- CDK synth / cdk-nag
- CloudFormation change set review
- dev deploy / health / representative chat・search・ingest smoke
- 24時間のCost Explorer/CUR/CloudWatch確認

## リスク

- `RAG_MONITORING_REQUIRED=1`のままmonitor resourceを削除するとsafety stateが期限切れになりAPIを停止させる。
- CloudWatch alarm/SNSを削除すると既存runbookや監視導線が壊れる可能性がある。
- broad construct削除で共有IAM permissionやbundle targetを誤って消す可能性がある。
- CloudFormation replacement/delete対象を誤るとstateful resourceへ波及する可能性があるため、change set確認を必須とする。
