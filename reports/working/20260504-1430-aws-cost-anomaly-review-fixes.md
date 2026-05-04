# 作業完了レポート

保存先: `reports/working/20260504-1430-aws-cost-anomaly-review-fixes.md`

## 1. 受けた指示

- 主な依頼: PR review で指摘された `BenchmarkProjectKey` の説明ずれを修正する。
- 成果物: ドキュメント表現修正、CDK test 強化、追加 commit、PR branch push。
- 入力情報: `BenchmarkBucket` の benchmark output object は SSE-S3 で、`BenchmarkProjectKey` は CodeBuild project の `encryptionKey` に設定されているという review 指摘。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
| --- | --- | ---: | --- |
| R1 | `BenchmarkProjectKey` の用途説明を実装に合わせる | 高 | 対応 |
| R2 | KMS key storage と request の cost 切り分け観点を runbook に追加する | 高 | 対応 |
| R3 | 既存作業レポートの R5 を実態に合わせる | 中 | 対応 |
| R4 | 可能なら CDK test の回帰検出力を上げる | 中 | 対応 |
| R5 | 公式 pricing の最新情報を再確認する | 中 | 対応 |

## 3. 検討・判断したこと

- CDK 実装を確認し、`BenchmarkBucket` は `S3_MANAGED`、`BenchmarkProjectKey` は `codebuild.Project.encryptionKey` であるため、benchmark output object を CMK 暗号化すると読める表現を修正した。
- `BenchmarkProjectKey` は customer managed key として stack 作成時に存在するため、CodeBuild 実行履歴がない場合でも key storage 由来の cost 候補になることを runbook に明記した。
- AWS KMS と Secrets Manager の公式 pricing ページを再確認し、KMS key storage、KMS request、Secrets Manager secret/API call の切り分け観点を維持した。
- 追加提案に合わせて、CDK test は KMS key 個数だけでなく `EnableKeyRotation` と CodeBuild project の `EncryptionKey` 参照も検証する形へ強化した。

## 4. 実施した作業

- `OPS_MONITORING_001.md` の KMS 用途と削除条件を CodeBuild project artifact 暗号化設定へ修正した。
- `OPERATIONS.md` で benchmark output object は `BenchmarkBucket` の SSE-S3、CodeBuild project artifact 暗号化設定は customer managed KMS key と分けて説明した。
- `ARC_CONTEXT_001.md` と `ARC_VIEW_001.md` の AWS KMS 用途説明を更新した。
- `memorag-mvp-stack.test.ts` に `EnableKeyRotation` と `CodeBuild::Project.EncryptionKey` の参照検証を追加した。
- 既存作業レポートの R5 を `対応` に修正した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
| --- | --- | --- | --- |
| `memorag-bedrock-mvp/docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md` | Markdown | KMS cost 切り分けと用途表現修正 | R1, R2 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | SSE-S3 と CodeBuild KMS 設定の説明分離 | R1 |
| `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/01_コンテキスト_CONTEXT/ARC_CONTEXT_001.md` | Markdown | AWS KMS 用途修正 | R1 |
| `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md` | Markdown | AWS KMS 用途修正 | R1 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` | TypeScript test | KMS rotation と CodeBuild EncryptionKey 参照を検証 | R4 |
| `reports/working/20260504-1404-aws-cost-anomaly-resources.md` | Markdown | R5 対応状況修正 | R3 |

## 6. 指示へのfit評価

総合fit: 4.8 / 5.0（約96%）

理由: review 指摘の主要論点は反映し、追加提案の test 強化も実施した。実 AWS account の請求明細確認は今回も環境外のため未実施。

## 7. 検証

- `git diff --check`: pass
- `task memorag:cdk:test`: pass

## 8. 未対応・制約・リスク

- 実 AWS account の Cost Explorer / CUR / CloudTrail には接続していない。
- benchmark output object 自体を customer managed KMS key で暗号化する設計変更は行っていない。
