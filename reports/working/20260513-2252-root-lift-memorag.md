# MemoRAG MVP root 化 作業完了レポート

- 作成日時: 2026-05-13 22:52 JST
- 対象ブランチ: `codex/root-lift-memorag`
- 対象 worktree: `.worktrees/root-lift-memorag`

## 受けた指示

`rag-assist` において `memorag-bedrock-mvp/` 配下に一段ネストされている MVP 本体を repository root に引き上げる方針を、計画に沿って実行する。

## 要件整理

- `apps/`, `packages/`, `infra/`, `benchmark/`, `docs/`, `tools/` と npm workspace 設定を repository root へ移動する。
- root wrapper の Taskfile と nested Taskfile を統合し、主要タスクと互換 `memorag:*` alias を残す。
- GitHub Actions、CDK CodeBuild buildspec、README、deploy docs、E2E docs、`.gitignore` の nested path 前提を修正する。
- package name、AWS stack name、resource name は同時変更しない。
- 検証結果と未解決リスクを実施済み以上に書かない。

## 検討・判断

- 差分の原因切り分けを優先し、npm package name `memorag-bedrock-mvp` と CDK stack name `MemoRagMvpStack` は維持した。
- `docs/spec-recovery/` 内の過去レポート引用は履歴証跡として残し、通常 docs と運用導線の旧 path を root 基準へ更新した。
- `infra/lib/memorag-mvp-stack.ts` の CodeBuild buildspec は root checkout 前提に変更したため、CDK snapshot を更新した。

## 実施作業

- `memorag-bedrock-mvp/` 配下の MVP 本体、workspace、infra、benchmark、docs、tools、設定ファイルを repository root へ移動した。
- root `Taskfile.yaml` を廃止し、root `Taskfile.yml` に実体タスクと互換 alias を統合した。
- `.github/workflows/memorag-ci.yml`、`memorag-deploy.yml`、`memorag-create-cognito-user.yml`、`memorag-openapi-docs.yml`、`e2e.yml` の working directory、cache、artifact、path trigger を root 基準へ修正した。
- README、GitHub Actions deploy docs、E2E README、benchmark dataset README、AGENTS、関連 skills、通常 docs の旧 path 参照を root 基準へ更新した。
- `.gitignore` を統合し、root 化後の CDK/local data/generated docs ignore に合わせた。
- benchmark の root path 期待値に合わせて `conversation-run.test.ts` を修正した。

## 検証結果

- `npm ci`: 成功。既存依存関係監査として 3 件の vulnerability が報告されたが、今回の root 化とは別件として未修正。
- `npm run ci`: 成功。初回は CDK snapshot mismatch で失敗し、snapshot 更新後に再実行して成功。
- `UPDATE_SNAPSHOTS=1 npm test -w @memorag-mvp/infra`: 成功。CodeBuild buildspec path 変更に伴う snapshot を更新。
- `task --list`: 成功。root タスクと互換 `memorag:*` alias を確認。
- `task verify`: 成功。
- `task cdk:test`: 成功。
- `task cdk:synth:yaml`: 成功。既存の Cognito MFA / API Gateway WAF / CDK feature flag 警告のみ出力。
- `docker compose config`: 成功。sandbox の cache 作成制約により権限確認後に実行。
- `git diff --check`: 成功。
- 旧 path 検索: 通常 workflows/docs/skills/code では root 化で壊れる `memorag-bedrock-mvp` 参照が残っていないことを確認。`docs/spec-recovery/` の過去引用は除外。

## Fit 評価

- 指示への fit: 4.8/5
- 理由: 計画どおり root 化、CI/Taskfile/docs/CDK/compose の参照修正、検証、作業レポートまで実施した。`docs/spec-recovery/` の履歴引用は意味を変えないため残しており、完全な文字列消去ではなく意図的な除外として扱った。

## 未対応・制約・リスク

- `npm ci` で報告された 3 件の vulnerability は今回の path 移動スコープ外として未対応。
- `docs/spec-recovery/` には過去レポート・入力棚卸として `memorag-bedrock-mvp/` 参照が残る。
- GitHub Actions の実 CI 結果は PR 作成後に別途確認が必要。
