# 作業完了レポート: admin usage contract 補強

## 受けた指示

- `.workspace/plan-060101.txt` の継続として、UsageEvent / admin usage / cost audit 実装の完了条件に対する不足を確認し、実装・検証まで進める。

## 要件整理

- UT-ADMIN-USAGE-002: 1ユーザーに UsageEvent が複数件ある場合、`/admin/usage` は `inputTokens`、`outputTokens`、`totalTokens` を合算して返す。
- route / schema / OpenAPI contract 経由でも、UsageEvent 集計が壊れていないことを確認する。

## 検討・判断

- service test では UsageEvent 合算を確認済みだった。
- ただし HTTP route と OpenAPI response schema を通した contract は `users` 配列の存在確認が中心で、チャット後の token 合算を直接固定していなかった。
- 既存 major endpoint contract は `/chat` と `/chat-runs` を実行してから `/admin/usage` を確認しているため、ここに合算 assertion を足すのが最小で効果的と判断した。

## 実施作業

- `apps/api/src/contract/api-contract.test.ts` の major endpoint contract に `/admin/usage` の token 合算 assertion を追加した。
- `local-dev` の usage row が存在し、`inputTokens` / `outputTokens` が 0 より大きいことを確認した。
- `totalTokens = inputTokens + outputTokens`、`llmCallCount >= 2`、totals の token 合算、completeness の actual/estimated event 存在を確認した。

## 成果物

- `/admin/usage` が route / schema 経由で UsageEvent 由来の token usage を返す contract を補強。
- UT-ADMIN-USAGE-002 の evidence を service-level から HTTP contract-level へ広げた。

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/contract/api-contract.test.ts`: fail（repo root から直接実行したため test 内の `process.cwd()` 前提とずれ、fixture / child tsx path 解決に失敗）
- `npm test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`: pass（script 展開により API test 261 件実行）
- `git diff --check`: pass

## Fit 評価

- `.workspace/plan-060101.txt` の admin usage 集計要件に対し、API response と OpenAPI schema の境界を通した検証を追加できた。
- 直接実行の失敗は実装起因ではなくコマンド実行ディレクトリ起因であり、正規 workspace script で再実行して pass を確認した。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- PR 作成、PR コメント、task md の `tasks/done/` 移動は未実施。
- 現在の作業は既存 dirty worktree 上で継続しており、origin/main からの専用 worktree 作成フローは未完了。
