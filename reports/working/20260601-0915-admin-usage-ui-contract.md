# 作業完了レポート: admin usage / UI contract 補強

## 受けた指示

- `.workspace/plan-060101.txt` の継続として、UsageEvent / admin usage / cost audit 実装の完了条件に対する不足を確認し、実装・検証まで進める。
- リポジトリルールに従い、未実施の検証は実施済み扱いにしない。

## 要件整理

- `/admin/usage` は UsageEvent が存在しない場合でも `users` field を欠落させず、`users: []` を返す。
- `/admin/usage` は token totals と `dataCompleteness` を返す。
- `usage:read:all_users` を持たないユーザーは `/admin/usage` で 403 になる。
- UI は API が `users: []` を返した場合に「未計測または利用なし」を表示し、推定・一部未計測・未計測を混同しない。

## 検討・判断

- 既存実装は `/admin/usage` 呼び出し時に admin 自身のゼロ利用行を ledger に作り、UsageEvent がない場合も `users` に 0 行ユーザーを返していた。
- plan の acceptance は「UsageEvent なしなら `users: []`」なので、利用実績がないゼロ行は usage summary から除外する方針にした。
- 既存 403 contract test は維持し、空 usage response は独立した fresh server contract test で固定した。

## 実施作業

- `MemoragService.listUsageSummaries()` で、UsageEvent または legacy 利用実績を持たないユーザーを usage summary から除外した。
- `api-contract.test.ts` に `/admin/usage` empty response の contract test を追加した。
- `AdminUsagePanel` の空状態 title を「未計測または利用なし」に変更した。
- `AdminWorkspace.test.tsx` に推定・一部未計測・利用なし・missing cost item の表示テストを追加した。

## 成果物

- `/admin/usage` empty response contract: `users: []`, token totals 0, `dataCompleteness` 0。
- UI contract: 空 usage は「未計測または利用なし」、estimated は「推定」、missing は「一部未計測」/「未計測」と表示。

## 検証

- `npm test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts src/contract/api-contract.test.ts`: pass（script 展開により API test 261 件実行）
- `npm test -w @memorag-mvp/web -- src/features/admin/components/AdminWorkspace.test.tsx`: pass（7 件）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `git diff --check`: pass

## Fit 評価

- UT-ADMIN-USAGE-001/002/003 相当の API contract を補強した。
- UT-UI-USAGE-001/002/003 相当の UI 表示 contract を補強した。
- 作業範囲は admin usage/cost 表示と contract test に限定した。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- PR 作成、PR コメント、task md の `tasks/done/` 移動は未実施。
- 現在の作業は既存 dirty worktree 上で継続しており、origin/main からの専用 worktree 作成フローは未完了。
