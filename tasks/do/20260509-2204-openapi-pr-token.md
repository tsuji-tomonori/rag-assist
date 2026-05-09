# OpenAPI docs PR 作成権限エラー対応

状態: do

## 背景

`.github/workflows/memorag-openapi-docs.yml` の `peter-evans/create-pull-request@v6` 実行で、ブランチ push は成功したが `GitHub Actions is not permitted to create or approve pull requests.` により PR 作成が失敗した。

## 目的

OpenAPI 生成ドキュメント更新 workflow が、リポジトリ設定で `GITHUB_TOKEN` による PR 作成が許可されていない場合でも、用意された GitHub App または PAT token で PR 作成できるようにする。

## スコープ

- `.github/workflows/memorag-openapi-docs.yml` の token 解決と PR 作成ステップを修正する。
- 必要に応じて README の運用説明を更新する。
- 変更に見合う最小限の検証を実施する。

## 計画

1. 現行 workflow と関連ドキュメントを確認する。
2. `create-pull-request` に渡す token を `OPENAPI_DOCS_PR_TOKEN` があれば優先し、なければ `GITHUB_TOKEN` に戻す形へ変更する。
3. token を使う場合の運用説明を README に追記する。
4. YAML/Markdown 差分の検証を実行する。
5. work report、commit、push、PR 作成、受け入れ条件コメント、セルフレビューコメントまで実施する。

## ドキュメントメンテナンス計画

CI workflow の運用前提が変わるため、`memorag-bedrock-mvp/README.md` の OpenAPI 生成ドキュメント workflow 説明を更新する。

## 受け入れ条件

- [ ] `memorag-openapi-docs` workflow が PR 作成 token を明示的に渡す。
- [ ] `OPENAPI_DOCS_PR_TOKEN` が設定されている場合はその token を使い、未設定時は `github.token` を使う。
- [ ] `GITHUB_TOKEN` の repository setting 制約が残る場合の設定または secret 方針が README に記載されている。
- [ ] YAML/Markdown 差分に対して `git diff --check` が通る。
- [ ] PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `git diff --check`
- `pre-commit run --files .github/workflows/memorag-openapi-docs.yml memorag-bedrock-mvp/README.md tasks/do/20260509-2204-openapi-pr-token.md reports/working/<report>.md`（利用可能な場合）

## PR レビュー観点

- workflow 権限を過剰に広げていないこと。
- token 未設定時の既存挙動を壊していないこと。
- README が未実施の GitHub 設定変更を実施済み扱いしていないこと。

## リスク

- repository settings の `Allow GitHub Actions to create and approve pull requests` が無効なまま、かつ `OPENAPI_DOCS_PR_TOKEN` も未設定の場合は PR 作成失敗が継続する。
- ローカルでは GitHub Actions 上の PR 作成動作そのものは実行できないため、最終確認は workflow 再実行に依存する。
