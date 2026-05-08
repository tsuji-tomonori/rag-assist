# 作業完了レポート

保存先: `reports/working/20260509-0136-github-actions-benchmark-run.md`

## 1. 受けた指示

- 主な依頼: GitHub Actions から API の `POST /benchmark-runs` を実施する計画を実装する。
- 成果物: 手動実行 workflow、必要な運用ドキュメント、task md、作業レポート。
- 条件: CodeBuild 直接起動ではなく既存 API / Step Functions / CodeBuild 経路を使う。secret / token / password を log や文書へ書かない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | GitHub Actions から `POST /benchmark-runs` を呼ぶ workflow を追加 | 高 | 対応 |
| R2 | suite / mode / model / retrieval parameter を手動入力できる | 高 | 対応 |
| R3 | token / password / secret JSON / Authorization header を log に出さない | 高 | 対応 |
| R4 | 必要な AWS / Cognito / Secrets Manager 前提を docs に記録 | 高 | 対応 |
| R5 | 既存 Step Functions + CodeBuild 経路を使う | 高 | 対応 |
| R6 | 検証結果と未実施事項を正直に記録 | 高 | 対応 |

## 3. 検討・判断したこと

- CodeBuild を直接 `start-build` すると run record や管理画面履歴との整合が壊れやすいため、API の `POST /benchmark-runs` を起点にする方針を採用した。
- `BENCHMARK_RUNNER` は `/benchmark/query` / `/benchmark/search` 用であり、run 起動には `BENCHMARK_OPERATOR` または `RAG_GROUP_MANAGER` の `benchmark:run` 権限が必要と判断した。
- 既存 OIDC bootstrap template は deploy workflow だけを `workflow_ref` で許可する構成だったため、benchmark workflow 用の `AllowedBenchmarkWorkflowRef` を追加した。
- 実行結果は GitHub step summary に runId / status / CodeBuild logs / metrics を出し、認証情報は `::add-mask::` の対象にしたうえで summary や output へ出さない構成にした。

## 4. 実施した作業

- `.github/workflows/memorag-benchmark-run.yml` を追加した。
- workflow で CloudFormation Outputs から `ApiUrl`、`CognitoUserPoolId`、`CognitoUserPoolClientId` を取得する処理を実装した。
- workflow で Secrets Manager secret の `idToken` / `token`、または `username` / `password` から ID token を取得する処理を実装した。
- workflow で `POST /benchmark-runs` を呼び、任意で `GET /benchmark-runs/{runId}` を polling する処理を実装した。
- `memorag-bedrock-mvp/infra/bootstrap/github-actions-oidc-role.yaml` に benchmark workflow の `workflow_ref` 許可を追加した。
- `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` と `memorag-bedrock-mvp/docs/OPERATIONS.md` に運用手順と前提を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `.github/workflows/memorag-benchmark-run.yml` | GitHub Actions workflow | `POST /benchmark-runs` 経由で benchmark を起動する手動 workflow | R1-R5 |
| `memorag-bedrock-mvp/infra/bootstrap/github-actions-oidc-role.yaml` | CloudFormation template | benchmark workflow の OIDC `workflow_ref` 許可 | R4 |
| `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` | Markdown | workflow 入力、secret、IAM、実行手順 | R4 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | GitHub Actions からの起動も既存経路に乗ることを追記 | R4-R5 |
| `tasks/do/20260509-0129-github-actions-benchmark-run.md` | Markdown task | 受け入れ条件と実施結果 | R6 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 4 | workflow と docs は実装済み。実 AWS 手動実行は環境 secret / role 依存のため未実施。 |
| 制約遵守 | 5 | secret 値そのものは追加ファイルや log 想定出力に書かない構成にした。 |
| 成果物品質 | 4 | 既存 API contract と OIDC 制約に合わせた。actionlint は未導入で未実施。 |
| 説明責任 | 5 | 必要な前提、未実施、権限を docs / task / report に分けて記録した。 |
| 検収容易性 | 4 | workflow_dispatch 入力と summary 出力を docs に整理した。 |

総合fit: 4.4 / 5.0（約88%）

理由: 実装と静的検証は完了したが、実 AWS での workflow 手動実行は外部 credential と benchmark 起動を伴うため未実施。

## 7. 実行した検証

- `ruby -e 'require "yaml"; YAML.load_file(...)'`: pass。workflow と bootstrap YAML を parse。
- workflow の `Start benchmark through API` step を抽出して `bash -n`: pass。
- `git diff --check`: pass。
- `pre-commit run --files .github/workflows/memorag-benchmark-run.yml memorag-bedrock-mvp/infra/bootstrap/github-actions-oidc-role.yaml memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md memorag-bedrock-mvp/docs/OPERATIONS.md tasks/do/20260509-0129-github-actions-benchmark-run.md`: pass。
- secret / token / password の echo、step summary、step output 混入 grep: pass。ただし `::add-mask::` とエラーメッセージの語句は検出対象から除外して確認した。

## 8. 未対応・制約・リスク

- GitHub Actions の実手動実行は未実施。理由は `AWS_DEPLOY_ROLE_ARN`、`BENCHMARK_OPERATOR_AUTH_SECRET_ID`、Secrets Manager secret の実在と外部 AWS 状態変更に依存するため。
- `actionlint` はローカル未導入のため未実施。代替として YAML parse、step shell `bash -n`、pre-commit を実行した。
- OIDC role を既に bootstrap 済みの環境では、`AllowedBenchmarkWorkflowRef` を反映するため bootstrap stack の更新が必要。
