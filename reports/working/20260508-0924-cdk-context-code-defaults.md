# 作業完了レポート

保存先: `reports/working/20260508-0924-cdk-context-code-defaults.md`

## 1. 受けた指示

- 主な依頼: CDK context を外部から注入することが CDK のベストプラクティスとして正しいか調べ、そのうえで benchmark source を CDK コード側に書くようにする。
- 追加条件: 前回 branch は merge 済みのため、main から取り込んで対応する。
- 成果物: 調査結果、修正差分、検証結果、PR。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | AWS CDK context の外部注入方針を調査する | 高 | 対応 |
| R2 | main 取り込み済み状態から作業する | 高 | 対応 |
| R3 | benchmark source を CDK コード側に書く | 高 | 対応 |
| R4 | workflow から固定 context 注入を外す | 高 | 対応 |
| R5 | docs と検証を更新する | 中 | 対応 |

## 3. 調査結果と判断

- AWS CDK 公式 docs では、`--context` は合成・デプロイ時に runtime context values を渡す正式な手段として説明されている。
- AWS CDK 公式 docs では、CLI から渡す context 値は常に文字列で、複数 stack に渡ることがあると説明されている。
- AWS CDK 公式 docs では、context 値は `cdk.json`、`cdk.context.json`、CLI、`App`/construct の context など複数 source から供給できるが、app state として再現性が必要な値は source control に含めるべきと説明されている。
- AWS CDK best practices では、CDK context provider 以外の外部値を通常 build のたびに動的取得するのではなく、必要時に取得してファイルへ保存し CDK app で読む方針が推奨されている。
- 今回の benchmark source は環境ごとに毎回変える runtime parameter ではなく、このリポジトリの CodeBuild source という固定 IaC 設計値である。そのため、workflow から `--context benchmarkSource*` を毎回注入するより、CDK コード内定数を正とする方が差分レビュー・再現性・運用の観点で適切と判断した。

参照:

- AWS CDK v2 Developer Guide: `Context values and the AWS CDK`
- AWS CDK v2 Developer Guide: `Save and retrieve context variable values`
- AWS CDK v2 Developer Guide: `Best practices for developing and deploying cloud infrastructure with the AWS CDK`

## 4. 実施した作業

- `origin/main` を fetch し、PR #185 merge 後の `origin/main` から `codex/cdk-context-code-defaults` worktree を作成した。
- `.github/workflows/memorag-ci.yml` から CDK synth 時の `benchmarkSource*` context 注入を削除した。
- `.github/workflows/memorag-deploy.yml` から bootstrap、synth、deploy 時の `benchmarkSource*` context 注入を削除した。
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` で `benchmarkSource*` context 参照を削除し、`defaultBenchmarkSource` 定数を CodeBuild source に直接渡す形へ変更した。
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` から context override テストを削除し、コード側既定値テストを残した。
- `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` を、workflow から固定 source を注入せず CDK コード側定数を正とする説明へ更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `.github/workflows/memorag-ci.yml` | YAML | CDK synth の benchmark source context 注入削除 | R4 |
| `.github/workflows/memorag-deploy.yml` | YAML | bootstrap/synth/deploy の benchmark source context 注入削除 | R4 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | CodeBuild source をコード内定数から設定 | R3 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` | TypeScript test | 外部 context override テスト削除、既定値テスト維持 | R3, R5 |
| `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` | Markdown | CDK context 方針とローカル相当コマンドを更新 | R1, R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 調査、main 取り込み、コード側定数化、workflow 削除、検証まで対応 |
| 制約遵守 | 5 | worktree/task/report/検証ルールに従った |
| 成果物品質 | 5 | `benchmarkSource*` context キーが repo 内に残らない状態を確認した |
| 説明責任 | 5 | 公式 docs に基づく判断を記録した |
| 検収容易性 | 5 | 変更ファイルと検証コマンドを明示した |

総合fit: 5.0 / 5.0（約100%）
理由: 主要要件を満たし、関連検証も pass したため。

## 7. 実行した検証

- `npm ci`: pass
- `task memorag:cdk:synth:yaml`: pass
- `task memorag:cdk:test`: pass
- `pre-commit run --files .github/workflows/memorag-ci.yml .github/workflows/memorag-deploy.yml memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts tasks/do/20260508-0920-cdk-context-code-defaults.md`: pass
- `git diff --check`: pass
- `rg -n "benchmarkSourceOwner|benchmarkSourceRepo|benchmarkSourceBranch" .github memorag-bedrock-mvp -g '!node_modules'`: no matches

## 8. 未対応・制約・リスク

- 未対応事項: なし。
- 制約: GitHub Actions 上の実 CI 結果は PR 作成後に確認する必要がある。
- リスク: benchmark source を別リポジトリに変更する場合は、CDK コード差分としてレビューする必要がある。
