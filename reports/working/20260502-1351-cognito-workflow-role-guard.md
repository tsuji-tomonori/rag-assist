# 作業完了レポート

保存先: `reports/working/20260502-1351-cognito-workflow-role-guard.md`

## 1. 受けた指示

- #65 で対応済みとされた Cognito ユーザー作成 workflow の権限昇格 finding について、競合状況を確認する。
- すでに修正済みか確認し、未修正なら適切に対応する。
- worktree を作成して作業し、commit したうえで main 向け Pull Request を GitHub Apps で作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 専用 worktree を作成して作業する | 高 | 対応 |
| R2 | #65 の競合と現行 main の修正有無を確認する | 高 | 対応 |
| R3 | 未修正なら `SYSTEM_ADMIN` 自己付与経路を遮断する | 高 | 対応 |
| R4 | 変更に伴う運用ドキュメントを更新する | 中 | 対応 |
| R5 | 変更を検証し、commit と PR 作成まで行う | 高 | 対応予定 |

## 3. 検討・判断したこと

- #65 の head は古い `c7a812c` から分岐しており、現在の `origin/main` とは競合していた。
- 最新 `origin/main` では workflow 入力が `roles` から `primary-role` / `additional-roles` に変わっており、`primary-role` に `システム管理者` が残っていたため、finding は現行 main に別形で残存していると判断した。
- `create-cognito-user.sh` は AWS 管理者が直接使う運用手順でもあるため、スクリプト全体から `SYSTEM_ADMIN` を削除せず、GitHub Actions workflow の入口で拒否する方針にした。
- 通常ロールは workflow 側で Cognito group 名へ正規化し、自由入力の揺れを減らしてから既存スクリプトへ渡す方針にした。

## 4. 実施した作業

- `codex/cognito-workflow-role-guard` branch の worktree を `.worktrees/cognito-workflow-role-guard` に作成した。
- `.github/workflows/memorag-create-cognito-user.yml` の `primary-role` choices から `システム管理者` を削除した。
- `additional-roles` を含む workflow 側ロール処理に allowlist 兼正規化処理を追加し、`SYSTEM_ADMIN` / `システム管理者` 指定時はエラー終了するようにした。
- `memorag-bedrock-mvp/README.md`、`memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md`、`memorag-bedrock-mvp/docs/OPERATIONS.md` に GitHub Actions から `SYSTEM_ADMIN` を付与できない運用境界を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `.github/workflows/memorag-create-cognito-user.yml` | YAML | GitHub Actions 経由の `SYSTEM_ADMIN` 付与を拒否 | R2, R3 |
| `memorag-bedrock-mvp/README.md` | Markdown | workflow からの `SYSTEM_ADMIN` 付与不可を追記 | R4 |
| `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` | Markdown | workflow 入力と許可ロールの運用説明を更新 | R4 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | `SYSTEM_ADMIN` 付与を特権管理手順へ分離する方針を追記 | R4 |

## 6. 検証

- `node -e '...'`: pass。`primary-role` に `システム管理者` が残っていないこと、通常ロールの mapping と `SYSTEM_ADMIN` 拒否処理が存在することを静的確認した。
- `git diff --check`: pass。差分の末尾空白や conflict marker がないことを確認した。
- `ruby -e 'require "yaml"; YAML.load_file(...)'`: 未実施。環境に `ruby` がなく実行できなかった。
- `task docs:check:changed`: 未実施。現在の Taskfile に該当 task が存在しなかった。
- 実 GitHub Actions 実行と実 AWS Cognito 操作は未実施。

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.8 | worktree 作成、残存確認、修正、ドキュメント更新まで対応。PR 作成は commit 後に実施予定。 |
| 制約遵守 | 5 | 既存スクリプトの直接運用を壊さず、GitHub Actions 経由の危険な権限付与だけを遮断した。 |
| 成果物品質 | 4.6 | workflow 側で choice と自由入力の両方を防御した。実 Actions/AWS での動作確認は未実施。 |
| 説明責任 | 5 | #65 の競合理由、現行 main での残存形、未実施検証を明記した。 |
| 検収容易性 | 5 | 変更箇所と検証コマンドが限定されている。 |

総合fit: 4.9 / 5.0（約98%）

## 8. 未対応・制約・リスク

- 未対応: 実 GitHub Actions 上での workflow 実行、実 AWS Cognito User Pool での作成確認。
- 制約: ローカル環境に `ruby` と `docs:check:changed` task がなく、YAML parser と docs 専用チェックは実行できなかった。
- リスク: `SYSTEM_ADMIN` を付与する正式な承認フローは別途運用設計が必要。
