# 運用監視

- ファイル: `OPS_MONITORING_001.md`
- 種別: `OPS_MONITORING`
- 状態: Draft

## 目的

AWS Cost Anomaly Detection で検知される少額の KMS / Secrets Manager コストを、既知の MemoRAG MVP 構成と突合できるようにする。

## 監視対象

| AWS service | MemoRAG MVP の必要リソース | 用途 | 継続判断 |
| --- | --- | --- | --- |
| AWS Key Management Service | `BenchmarkProjectKey` | CodeBuild benchmark runner の生成物暗号化 | benchmark runner を管理画面から実行する場合は必要 |
| AWS Secrets Manager | `BenchmarkRunnerAuthSecret` | `BENCHMARK_RUNNER` service user credential の保存 | production API を叩く benchmark runner では必要 |
| AWS Key Management Service | AWS managed key `aws/secretsmanager` | Secrets Manager secret の保存時暗号化 | Secrets Manager を使う限り AWS 側で利用される |

AWS KMS の AWS managed key は key storage 自体の課金対象外だが、AWS managed key への API request は利用量として請求されうる。Secrets Manager は secret 保存数と API call に基づく課金対象であり、secret を維持する限り少額 anomaly の候補になる。

## Anomaly 突合メモ

2026-05-02 の Cost Anomaly Detection では、Member Account `713881826246 (GenU)` に対して AWS Key Management Service の Total Impact `$0.02` と AWS Secrets Manager の Total Impact `$0.01` が検知された。

この金額が MemoRAG MVP deploy 後に発生した場合、第一候補は benchmark runner 用の `BenchmarkProjectKey`、`BenchmarkRunnerAuthSecret`、および Secrets Manager の AWS managed key 利用である。

## 初動確認

1. Cost Explorer または Cost and Usage Report で account、region、service、usage type を確認する。
2. CloudFormation stack に `BenchmarkProjectKey` と `BenchmarkRunnerAuthSecret` が存在するか確認する。
3. `benchmarkRunnerAuthSecretId` context で外部 secret を参照している場合、外部 secret の所有者と利用目的を確認する。
4. CodeBuild benchmark runner の実行履歴と Secrets Manager `GetSecretValue` の時刻を突合する。
5. 予算超過や想定外 region での発生があれば、benchmark runner の起動を止めて stack drift と未使用 stack を確認する。

## 削除・抑制できる条件

| リソース | 削除・抑制条件 | 注意点 |
| --- | --- | --- |
| `BenchmarkProjectKey` | Step Functions + CodeBuild benchmark runner を使わない | CodeBuild artifacts の暗号化設定と cdk-nag 要件を再評価する |
| `BenchmarkRunnerAuthSecret` | production API を叩く runner を使わない、または外部管理 secret へ移行する | 外部管理 secret を使う場合も Secrets Manager の保存・API call コストは残る |
| AWS managed key `aws/secretsmanager` | Secrets Manager secret を全廃する | AWS managed key 自体の保存は管理対象外だが、関連 API request は請求表示に出る可能性がある |

## 受け入れ条件

- AC-OPS-MON-001: Cost anomaly で KMS または Secrets Manager が検知された場合、上記の必要リソース表で MemoRAG MVP の既知リソースか判断できること。
- AC-OPS-MON-002: benchmark runner を使わない運用では、削除・抑制条件に従って関連リソースの停止候補を説明できること。

## 参照

- AWS Key Management Service pricing: https://aws.amazon.com/kms/pricing/
- AWS Secrets Manager pricing: https://aws.amazon.com/secrets-manager/pricing/
