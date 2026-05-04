# 作業完了レポート

保存先: `reports/working/20260504-1404-aws-cost-anomaly-resources.md`

## 1. 受けた指示

- 主な依頼: worktree を作成し、AWS Cost Anomaly Detection で検知された KMS / Secrets Manager の必要リソースを整理する。
- 成果物: コード・ドキュメント変更、git commit、main 向け PR。
- 形式・条件: commit message と PR は日本語、PR 作成は GitHub Apps を利用する。
- 入力情報: 2026-05-02 の AWS Key Management Service `$0.02` と AWS Secrets Manager `$0.01` の anomaly。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
| --- | --- | ---: | --- |
| R1 | 最新 `origin/main` から作業用 worktree を作成する | 高 | 対応 |
| R2 | KMS / Secrets Manager anomaly の関連リソースを調査する | 高 | 対応 |
| R3 | 必要リソースと削除・抑制条件を運用ドキュメントへ残す | 高 | 対応 |
| R4 | 変更範囲に合う検証を実行する | 高 | 対応 |
| R5 | commit と main 向け PR を作成する | 高 | 対応予定 |

## 3. 検討・判断したこと

- `memorag-mvp-stack.ts` と CDK snapshot を確認し、`BenchmarkRunnerAuthSecret` と `BenchmarkProjectKey` が既知の benchmark runner 構成であると判断した。
- anomaly の `$0` / AWS managed 表示は、Secrets Manager の AWS managed key 利用や API request 由来の少額コストとして突合できるよう、運用監視ドキュメントに整理した。
- 実リソースを削除すると benchmark runner の本番 API 評価導線に影響するため、今回はリソース削減実装ではなく必要性と削除条件の明文化を優先した。
- CDK の実装は既に KMS key と secret を作成していたため、リソース数テストへ `AWS::KMS::Key` を追加して棚卸しの回帰を防ぐ方針にした。

## 4. 実施した作業

- `.worktrees/aws-cost-anomaly-resources` を `origin/main` から作成した。
- `OPS_MONITORING_001.md` を追加し、KMS / Secrets Manager の必要リソース、anomaly 初動確認、削除・抑制条件を記載した。
- `OPERATIONS.md`、アーキテクチャ context/view、`NFR-009` に cost anomaly 突合の導線を追加した。
- CDK stack test に `AWS::KMS::Key` のリソース数確認を追加した。
- AWS KMS と AWS Secrets Manager の公式 pricing ページを確認し、AWS managed key と Secrets Manager の課金観点を docs に反映した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
| --- | --- | --- | --- |
| `memorag-bedrock-mvp/docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md` | Markdown | KMS / Secrets Manager anomaly runbook | 必要リソース判断に対応 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | anomaly 発生時の参照導線 | 運用手順に対応 |
| `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/01_コンテキスト_CONTEXT/ARC_CONTEXT_001.md` | Markdown | AWS KMS の依存関係追加 | 構成理解に対応 |
| `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md` | Markdown | deploy view への AWS KMS 追加 | 構成理解に対応 |
| `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_009.md` | Markdown | cost anomaly 受け入れ条件追加 | 継続監視要件に対応 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` | TypeScript test | KMS key 数の静的検証追加 | 回帰防止に対応 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
| --- | --- | --- |
| 指示網羅性 | 4.8 / 5 | worktree、調査、変更、検証、commit/PR 作成まで実施対象に含めた |
| 制約遵守 | 4.8 / 5 | 日本語 commit/PR、docs 更新、未実施検証の明記方針に従った |
| 成果物品質 | 4.7 / 5 | anomaly の初動確認と削除条件を運用可能な粒度で記載した |
| 説明責任 | 4.7 / 5 | 実リソース削除を行わない判断理由を明記した |
| 検収容易性 | 4.7 / 5 | 対象ファイルと検証結果を一覧化した |

総合fit: 4.7 / 5.0（約94%）

## 7. 検証

- `git diff --check`: pass
- `task memorag:cdk:test`: pass
- 初回の `task memorag:cdk:test`: fail。worktree に `node_modules` がなく `tsc: not found` になったため、`npm install` 後に再実行して pass。

## 8. 未対応・制約・リスク

- 実 AWS account の Cost Explorer / CUR / CloudTrail には接続していないため、Member Account `713881826246 (GenU)` の請求明細そのものは未確認。
- benchmark runner を使わない運用へ変更する場合は、CDK の条件分岐または runner 無効化設計が別途必要。
- AWS pricing は公式ページを確認したが、実請求は account、region、usage type、free tier 状況に依存する。
