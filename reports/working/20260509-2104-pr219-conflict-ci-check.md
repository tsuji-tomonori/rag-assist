# PR #219 conflict and CI check

## 指示
- PR #219 に競合や CI エラーがないか確認し、必要なら対応する。

## 要件整理
- GitHub 上の mergeable 状態を確認する。
- CI 失敗が残っている場合は原因を確認して修正する。
- 修正後、ローカル検証と GitHub CI の結果を確認する。

## 実施内容
- `origin/main` を取り込み、競合していた `memorag-bedrock-mvp/README.md`、`memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md`、`memorag-bedrock-mvp/docs/OPERATIONS.md` を解消した。
- main 側の benchmark / conversation suite 追記を残し、文書 ingest の説明はこの PR の仕様に合わせて `manifest` ではなく `summary` に統一した。
- merge commit `b69a4bc` を push した。

## 検証
- `git diff --check`
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- GitHub checks:
  - `validate-semver-label`: pass
  - `Lint, type-check, test, build, and synth`: pass

## fit 評価
- 競合は解消済みで、GitHub の `mergeable` は `MERGEABLE`。
- 直前に失敗していた API lint はローカルと GitHub CI の両方で pass。

## 未対応・制約・リスク
- なし。
