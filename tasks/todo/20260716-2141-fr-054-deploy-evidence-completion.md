# FR-054 deploy smoke・external setting evidence 完成

- 状態: todo
- タスク種別: deploy 運用・検証
- 作成日: 2026-07-16
- 関連要件: `FR-054`

## 背景

repository 内の deploy workflow は OIDC、CDK synth/cdk-nag artifact、CloudFormation artifact、deploy output、GitHub environment 指定を持つ。一方、deploy 後 smoke と GitHub environment approval/secret の external 設定 evidence は確認できない。

## 受け入れ条件

- [ ] deploy 後に、対象 environment の公開 health endpoint と主要非破壊 read path を確認する smoke step があり、失敗時に workflow が fail する。
- [ ] smoke の対象 URL は deploy output または environment 設定から取得し、固定 production URL を source に埋め込まない。
- [ ] production GitHub environment に required reviewer/approval rule が設定されている証跡を、secret 値を開示せず運用文書または監査 artifact に残す。
- [ ] AWS 認証は OIDC role assumption のみを使用し、長期 AWS access key を repository、workflow、GitHub secret に保存していないことを権限ある operator が確認する。
- [ ] CDK synth/cdk-nag/CloudFormation/deploy output/smoke の保持期間と incident 時の参照手順を運用文書へ記載する。

## 検証

- workflow lint、infra test、dry-run または非本番 environment deploy、smoke failure の negative test/evidence を記録する。
- secret 値そのものは log、artifact、PR に出力しない。
