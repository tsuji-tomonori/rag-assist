# 作業完了レポート

保存先: `reports/working/20260509-1147-github-actions-performance-loop.md`

## 1. 受けた指示

- 主な依頼: 新しく追加した性能テストを GitHub Actions から実行し、性能改善ループを回す。
- 成果物: Actions 実行導線の修正、Actions 実行結果、必要な改善、PR コメント、作業レポート。
- 条件: 実施していない検証を実施済み扱いしない。外部環境に依存する未達事項は blocked として明示する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 新 suite を GitHub Actions から選べるようにする | 高 | 対応 |
| R2 | 新 suite の dataset を Actions/CodeBuild で読めるようにする | 高 | 対応 |
| R3 | GitHub Actions で新 suite を実行する | 高 | 部分対応 |
| R4 | 実行結果から性能改善ループを回す | 高 | blocked |
| R5 | 検証と未達理由を PR / task / report に記録する | 高 | 対応 |

## 3. 検討・判断したこと

- PR #221 の `mtrag-v1` / `chatrag-bench-v1` が今回の「新しく追加した性能テスト」と判断した。
- workflow の選択肢だけでなく、CodeBuild runner が読む S3 dataset と seed corpus 指定が不足していたため、Actions 実行性の修正を優先した。
- 実行した GitHub Actions は `OPERATOR_AUTH_SECRET_ID is required` で失敗した。GitHub `dev` environment には `AWS_DEPLOY_ROLE_ARN` だけがあり、`BENCHMARK_OPERATOR_AUTH_SECRET_ID` は未設定だった。
- 新 suite の dataset 配置と API suite 定義はこの PR の変更であり、dev stack へ deploy されるまでは実 benchmark 完走はできないと判断した。deploy は外部環境変更のため、このターンでは確認なしに実行していない。

## 4. 実施した作業

- `.github/workflows/memorag-benchmark-run.yml` に `mtrag-v1` / `chatrag-bench-v1` / 既存 API suite の選択肢を追加した。
- `benchmark/dataset.mtrag.sample.jsonl` と `benchmark/dataset.chatrag-bench.sample.jsonl` を追加した。
- CDK の `DeployBenchmarkDatasets` に新 dataset を追加した。
- CodeBuild runner の pre_build で新 suite も `standard-agent-v1` corpus を seed するよう更新した。
- README / GitHub Actions docs / Operations docs を同期した。
- GitHub Actions run `25589515162` を `mtrag-v1` で起動し、失敗ログを確認した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `.github/workflows/memorag-benchmark-run.yml` | YAML | 新 suite を workflow_dispatch の選択肢に追加 | R1 |
| `memorag-bedrock-mvp/benchmark/dataset.mtrag.sample.jsonl` | JSONL | MTRAG/mtRAG 軽量 sample dataset | R2 |
| `memorag-bedrock-mvp/benchmark/dataset.chatrag-bench.sample.jsonl` | JSONL | ChatRAG Bench 軽量 sample dataset | R2 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | dataset deploy と CodeBuild seed corpus 指定を更新 | R2 |
| `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` ほか | Markdown | Actions/運用 docs の suite 一覧を同期 | R5 |
| GitHub Actions run `25589515162` | Actions run | `mtrag-v1` で起動したが secret 未設定で failed | R3 部分対応 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 3.0 / 5 | Actions 実行導線の不足は修正し、実 run も起動したが、外部 secret / deploy 未反映で benchmark 完走と改善値確認は未達。 |
| 制約遵守 | 4.5 / 5 | 実行済み/未実施を分け、外部 deploy は確認なしに実行しなかった。 |
| 成果物品質 | 4.0 / 5 | workflow、dataset、CDK、docs、tests は整合した。 |
| 説明責任 | 4.5 / 5 | 失敗 run URL、原因、次に必要な操作を明記した。 |
| 検収容易性 | 4.0 / 5 | task と report に受け入れ条件・検証結果・ブロック理由を残した。 |

総合fit: 3.8 / 5.0（約76%）

理由: GitHub Actions から新 suite を起動するためのコード側不足は解消したが、`BENCHMARK_OPERATOR_AUTH_SECRET_ID` 未設定と未deployのため性能改善ループの完走は blocked。

## 7. 実行した検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: fail -> snapshot 更新後 pass
- `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `git diff --check`: pass
- `gh workflow run memorag-benchmark-run.yml ... suite-id=mtrag-v1 ...`: 起動成功。ただし run は `OPERATOR_AUTH_SECRET_ID is required` で failed。

## 8. 未対応・制約・リスク

- `mtrag-v1` の benchmark 完走: 未達。理由は GitHub `dev` environment の `BENCHMARK_OPERATOR_AUTH_SECRET_ID` 未設定。
- 性能改善値の確認: 未達。benchmark artifact が生成されなかったため。
- dev stack deploy: 未実施。外部環境変更であり、確認なしに実行しないため。
- PR #221 の新 suite は deploy 後に API / BenchmarkBucket へ反映されるため、現行 dev stack では未反映の可能性が高い。
