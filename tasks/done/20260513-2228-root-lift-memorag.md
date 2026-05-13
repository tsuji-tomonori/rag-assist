# MemoRAG MVP root 化

- 状態: done
- タスク種別: 修正
- 作成日時: 2026-05-13 22:28 JST
- 完了日時: 2026-05-13 22:56 JST
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/284

## 背景

`memorag-bedrock-mvp/` 配下にアプリ本体、npm workspace、CDK、benchmark、docs、Taskfile が一段ネストされている。リポジトリ root からの CI、Taskfile、docs はこの nested path を直接参照しており、root 化時には参照不整合が発生する。

## 目的

`memorag-bedrock-mvp/` 配下の MVP 本体を repository root に引き上げ、root を npm workspace / Taskfile / CI / docs の実行基準にする。

## スコープ

- `memorag-bedrock-mvp/` 直下のアプリ本体、workspace、infra、benchmark、docs、tools、設定ファイルの root 移動。
- root `Taskfile.yaml` と nested `Taskfile.yml` の統合。
- GitHub Actions、README、deploy docs、E2E docs、CDK CodeBuild buildspec の path 修正。
- `.gitignore` の統合。
- 作業レポート、commit、PR、受け入れ条件コメント、セルフレビューコメント。

## スコープ外

- npm package name の変更。
- AWS stack name、resource tag、Project tag の変更。
- RAG API / Web UI の機能変更。
- `docs/spec-recovery/` 内の過去レポート引用の全面置換。

## なぜなぜ分析サマリ

- 問題文: root 化すると、root 側 workflow / Taskfile / docs / CDK buildspec が nested path を前提にしているため、CI や運用コマンドが失敗する。
- 確認済み事実:
  - root `Taskfile.yaml` は `dir: memorag-bedrock-mvp` で nested Taskfile に委譲している。
  - `.github/workflows/memorag-ci.yml`、`memorag-deploy.yml`、`memorag-create-cognito-user.yml`、`memorag-openapi-docs.yml` に `memorag-bedrock-mvp` path がある。
  - `infra/lib/memorag-mvp-stack.ts` の CodeBuild buildspec は `$CODEBUILD_SRC_DIR/memorag-bedrock-mvp` へ `cd` している。
  - root と nested に別々の `.gitignore` がある。
- 推定原因:
  - MVP 本体を nested package として追加した後、root が wrapper として残り、CI/Taskfile/docs が wrapper 経由で運用されている。
- 根本原因:
  - repository root と product root が一致しておらず、実行基準ディレクトリが複数存在する。
- 対策:
  - root を唯一の product root として、実体ファイルを移動し、参照 path と Taskfile を root 基準に統合する。
  - 検証で workspace、CI 相当、CDK、compose の root 実行を確認する。

## 実施計画

1. ファイルを root に移動し、衝突ファイルを統合する。
2. GitHub Actions と CDK buildspec の path を root 基準に修正する。
3. README / deploy docs / E2E docs の実行手順を root 基準に修正する。
4. snapshot と検証コマンドを更新・実行する。
5. 作業レポート、commit、push、PR、コメント、task done 更新を行う。

## ドキュメント保守計画

- root README は repository root が MVP root である前提に更新する。
- deploy docs は CloudFormation template path と実行ディレクトリを root 前提に更新する。
- E2E README は `apps/web` path 前提に更新する。
- 通常 docs 内の `memorag-bedrock-mvp/` prefix は root 化後の実パスと一致するよう更新する。
- `docs/spec-recovery/` 内の過去レポート引用は履歴証跡として今回の置換対象外にする。

## 受け入れ条件

- [x] `apps/`, `packages/`, `infra/`, `benchmark/`, `docs/`, `tools/`, npm workspace 設定が repository root に配置されている。
- [x] GitHub Actions から `working-directory: memorag-bedrock-mvp` と root 化で壊れる artifact/cache/path 指定が除去または修正されている。
- [x] root Taskfile で主要な `verify`, `dev:api`, `dev:web`, `cdk:test`, `cdk:synth:yaml` と互換 `memorag:*` alias が利用できる。
- [x] CDK の CodeBuild buildspec が root 前提になり、関連 snapshot が更新されている。
- [x] README / deploy docs / E2E docs / `.gitignore` が root 化後の構成と矛盾しない。
- [x] 選定した検証を実行し、未実施がある場合は理由を記録している。
- [x] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿している。

## 検証計画

- `git diff --check`
- `npm ci`
- `npm run ci`
- `task verify`
- `task cdk:test`
- `task cdk:synth:yaml`
- `docker compose config`

## 検証結果

- `npm ci`: 成功。3 件の vulnerability は今回の root 化とは別件として未修正。
- `npm run ci`: 成功。初回は CDK snapshot mismatch で失敗し、snapshot 更新後に再実行して成功。
- `UPDATE_SNAPSHOTS=1 npm test -w @memorag-mvp/infra`: 成功。
- `task --list`: 成功。root タスクと互換 alias を確認。
- `task verify`: 成功。
- `task cdk:test`: 成功。
- `task cdk:synth:yaml`: 成功。既存の CDK Nag / feature flag 警告のみ出力。
- `docker compose config`: 成功。sandbox 制約のため権限確認後に実行。
- `git diff --check`: 成功。
- 旧 path 参照検索: 通常 workflows/docs/skills/code で root 化により壊れる旧 path が残っていないことを確認。`docs/spec-recovery/` は履歴証跡として除外。

## PR レビュー観点

- CI / Taskfile / docs の path 不整合が残っていないこと。
- package name や stack name を同時変更せず、移動 PR の原因切り分け性を保っていること。
- RAG の根拠性、認可境界、benchmark 固有値の実装混入に影響していないこと。

## リスク

- 大量の `git mv` により diff が大きくなる。
- `docs/spec-recovery/` 内の過去レポート引用まで全面置換すると証跡の意味が変わる可能性があるため、通常 docs と実行導線を優先する。
- `npm ci` は lockfile と node_modules の状態により時間がかかる可能性がある。
