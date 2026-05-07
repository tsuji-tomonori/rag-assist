# API domain route split

## 背景

前段で `app.ts` から OpenAPI route 定義を `routes/api-routes.ts` に移したが、`api-routes.ts` が 1600 行超になり、今後はこの file が競合点になる懸念がある。

## 目的

API 領域ごとに route 定義を分割し、変更競合をさらに減らす。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/routes/api-routes.ts` の aggregator 化
- API 領域別 route module の追加
- 共有 helper / type の最小分離
- 分割後の静的 access-control policy test の維持

## 非スコープ

- endpoint、request/response schema、status code の変更
- permission の追加・削除・緩和
- route の domain を越えた仕様変更

## 作業計画

1. 現行 `api-routes.ts` の route 群と helper 依存を整理する。
2. 共通 context / route helper を shared module に分離する。
3. API 領域別 route module に移動し、aggregator は register 呼び出しだけにする。
4. 静的 policy test の source 読み取りを `routes/**/*.ts` に対応させる。
5. API test / typecheck / diff check / pre-commit を実行する。

## ドキュメント保守方針

公開 API 仕様は変更しない。実装ファイル構成に関する既存 docs / agent rule が追加更新を必要とする場合のみ最小更新する。

## 受け入れ条件

- [ ] `routes/api-routes.ts` が API 領域別 route module の登録呼び出し中心になっている。
- [ ] admin/document/chat/question/conversation/debug/benchmark など主要 API 領域が別 file に分かれている。
- [ ] endpoint、request/response shape、route-level permission、auth middleware 対象が変わらない。
- [ ] `access-control-policy.test.ts` が分割後の route file 群を検証できる。
- [ ] API typecheck、API test、`git diff --check`、pre-commit が pass する。
- [ ] 作業レポートが `reports/working/` に保存され、PR #181 に受け入れ条件確認とセルフレビューが投稿される。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `git diff --check`
- `pre-commit run --files ...`

## PR レビュー観点

- 分割により `api-routes.ts` が新たな競合点になっていないか。
- module 間の共有 helper が過大になっていないか。
- route 登録順序、permission check、error handling が維持されているか。
- 静的 policy test が新しい file 構成でも route 追加漏れを検出できるか。

## リスク

- 大きな機械移動により、route 登録順序や helper scope が意図せず変わる可能性がある。
- 静的 policy test の source 抽出が file 分割に追従できないと、認可回帰検出が弱くなる。

## 状態

do
