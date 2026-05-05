# 作業完了レポート

保存先: `reports/working/20260505-1348-ci-cdk-nag-synth.md`

## 1. 受けた指示

- 専用 worktree を作成して作業する。
- PR #108 のように CD のタイミングで見つかった `cdk-nag` 問題を、CI の時点で検出できるように検討して対処する。
- 修正後に git commit し、GitHub Apps を利用して main 向け PR を作成する。
- 実施していない検証を実施済みとして書かない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `origin/main` 起点の作業用 worktree を作成する | 高 | 対応 |
| R2 | CD 時点で見つかった `cdk-nag` error の CI 検出漏れ原因を確認する | 高 | 対応 |
| R3 | PR CI に `cdk-nag` 有効状態の CDK synth を追加する | 高 | 対応 |
| R4 | 現在 main に残る `AwsSolutions-APIG2` を解消し、追加 CI が通る状態にする | 高 | 対応 |
| R5 | ドキュメントへ CI での事前検出を反映する | 中 | 対応 |
| R6 | 最小十分な検証を実行する | 高 | 対応 |
| R7 | commit と PR 作成を行う | 高 | 対応 |

## 3. 検討・判断したこと

- PR #108 のコメントでは既存 PR CI が lint、typecheck、test、build まで成功していた。一方、deploy workflow では CDK synth 時に `cdk-nag` が有効化されるため、`AwsSolutions-APIG2` が CD 段階で初めて error になった。
- 原因は PR CI に `cdk-nag` 有効状態の CDK synth が含まれていないことと判断した。
- CI に `npm run synth:yaml -w @memorag-mvp/infra` を追加し、CI コメントと最終 fail 判定にも含めた。診断しやすいよう CloudFormation YAML と `AwsSolutions-*-NagReport.csv` を artifact として保存する。
- 追加した synth を main 相当で実行すると `AwsSolutions-APIG2` が再現したため、PR #108 と同じ API Gateway request validator 対応を同じブランチに含めた。これにより、この PR 自身の CI も通過可能な状態にした。
- 最初に作成した `../rag-assist-ci-cd-path-regression` は writable root 外で build 出力が `EROFS` になったため、`.worktrees/ci-cdk-nag-synth` に writable な worktree を作成し直した。

## 4. 実施した作業

- `.worktrees/ci-cdk-nag-synth` を `origin/main` 起点で作成した。
- `.github/workflows/memorag-ci.yml` に CDK synth with cdk-nag の step、artifact upload、CI コメント行、fail 条件を追加した。
- API Gateway REST API に `basic-request-validator` を追加し、Cognito 保護メソッドへ request validator を設定した。
- CDK assertion と snapshot を更新し、protected method は validator あり、CORS preflight は validator なしであることを固定した。
- `memorag-bedrock-mvp/README.md` と `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` に PR CI での `cdk-nag` 事前検出を追記した。
- 作業前に追加 CI step が `AwsSolutions-APIG2` を検出して失敗することを確認し、修正後に成功することを確認した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `.github/workflows/memorag-ci.yml` | GitHub Actions YAML | PR CI に cdk-nag synth と artifact upload を追加 | CI 事前検出 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | API Gateway request validator を追加 | APIG2 解消 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` | TypeScript test | validator と preflight 境界の assertion を追加 | 回帰防止 |
| `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json` | JSON snapshot | CDK 合成結果を更新 | テスト整合 |
| `memorag-bedrock-mvp/README.md` | Markdown | PR CI の実行内容を更新 | docs maintenance |
| `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` | Markdown | cdk-nag 事前検出と artifact を追記 | docs maintenance |
| `reports/working/20260505-1348-ci-cdk-nag-synth.md` | Markdown | 本作業レポート | レポート要件 |
| `https://github.com/tsuji-tomonori/rag-assist/pull/109` | Pull Request | main 向け PR | PR 作成要件 |

## 6. 確認内容

| コマンド | 結果 | 備考 |
|---|---|---|
| `npm install` | pass | writable worktree で検証依存を準備 |
| `npm run build -w @memorag-mvp/web` | pass | synth 前提の frontend dist を作成 |
| `npm run build -w @memorag-mvp/infra` | pass | Lambda bundle と infra build |
| `npm run synth:yaml -w @memorag-mvp/infra` | fail -> pass | APIG2 fix 前に `AwsSolutions-APIG2` を検出。fix 後に成功 |
| `UPDATE_SNAPSHOTS=1 npm test -w @memorag-mvp/infra` | pass | CDK assertion と snapshot 更新 |
| `git diff --check` | pass | 空白エラーなし |
| `python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/memorag-ci.yml")); print("yaml ok")'` | pass | workflow YAML parse 確認 |
| `git commit` | pass | `d806d16` と `f36d758` を作成 |
| GitHub Apps PR create | pass | PR #109 を作成 |

## 7. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | worktree 作成、原因検討、CI 対処、検証、レポート、commit/PR 作成に対応 |
| 制約遵守 | 5 | 実施していない検証は記載せず、writable root 制約も明記 |
| 成果物品質 | 5 | CI で cdk-nag error を fail 判定に含め、artifact で診断可能にした |
| 説明責任 | 5 | PR #108 相当の検出漏れ原因と APIG2 fix 同梱理由を明記 |
| 検収容易性 | 5 | 変更ファイル、検証コマンド、残存 warning を明示 |

総合fit: 5.0 / 5.0（約100%）

## 8. 未対応・制約・リスク

- `AwsSolutions-COG2` と `AwsSolutions-APIG3` は既存 warning として残る。今回追加した CI synth は error を検出して fail させる目的のため、warning は未対応。
- `actionlint` はローカルに未導入だったため未実行。代替として Python の YAML parse と実コマンド検証を実施した。
- writable root 外に最初に作成した `../rag-assist-ci-cd-path-regression` は不要になった。sandbox 制約のため最終的な削除可否は別途確認する。
