# oRPC contract package 導入

状態: do

## 背景

`memorag-bedrock-mvp` は `apps/api`、`apps/web`、`infra`、`benchmark` に分かれているが、web と benchmark が API schema とは別の手書き型や直接 fetch を持っている。API 内部型を他 workspace から借りる構成では依存境界が崩れるため、共有 contract package を single source of truth にする。

## 目的

`memorag-bedrock-mvp/packages/contract` を追加し、Zod schema、oRPC contract、共有型を集約する。初回移行では chat と benchmark の主要 endpoint に対象を絞り、既存 REST route は維持したまま `/rpc/*` を追加する。

## スコープ

- `packages/contract` workspace の追加
- `system.health`、`chat.create`、`chat.startRun`、`benchmark.query`、`benchmark.search` の contract 定義
- API 側の oRPC router と `/rpc/*` handler 追加
- web chat wrapper の oRPC client 化
- benchmark query/search client の oRPC client 化
- infra env 型の `import type` + `satisfies` 適用
- OpenAPI / docs 影響の確認と必要最小限の更新

## スコープ外

- documents、questions、history、debug、admin の全面移行
- SSE 本体、S3 presigned upload、Lambda response streaming の oRPC transport 移行
- 既存 REST route の削除

## 作業計画

1. 既存 schema、route、client、benchmark、infra、検証 script を確認する。
2. contract package を追加し、API 内部実装に依存しない schema と router 型を定義する。
3. API が contract を実装する oRPC router を追加し、既存認証・認可境界を維持して `/rpc/*` に接続する。
4. web と benchmark を contract 由来の `ApiClient` 型で oRPC client 化する。
5. infra env object に contract 側型を type-only で適用する。
6. docs 更新要否を確認し、必要なら最小限更新する。
7. 変更範囲に応じた typecheck/test/docs check を実行し、失敗は修正する。
8. レポート、commit、push、PR、受け入れ条件コメント、セルフレビューコメント、task done 移動まで実施する。

## ドキュメント保守計画

- API contract、OpenAPI、workspace 構成、検証手順に影響するため、`memorag-bedrock-mvp/README.md`、`memorag-bedrock-mvp/docs/`、API examples、OpenAPI 生成手順の該当箇所を検索する。
- Durable docs の更新が必要な場合は同じ PR で反映する。不要な場合は作業レポートと PR 本文に理由を記録する。

## 受け入れ条件

- [x] `memorag-bedrock-mvp/packages/contract` が workspace として追加され、build/typecheck 可能である。
- [x] contract package が初回対象の Zod schema、oRPC contract、`ApiClient` 型、JSON/limits/infra 型を提供する。
- [x] API は contract を実装する `/rpc/*` endpoint を追加し、chat/benchmark の既存 permission check を維持する。
- [x] 既存 REST route は削除されず、移行中の互換性が維持される。
- [x] web は API 内部型を import せず、contract 由来の `ApiClient` 型で chat API wrapper を呼ぶ。
- [x] benchmark は `/benchmark/query` / `/benchmark/search` の直接 fetch と重複 response 型を contract 由来 client/type に寄せる。
- [x] infra は contract runtime を import せず、env/config 型を `import type` と `satisfies` で使う。
- [x] OpenAPI 生成経路と関連 docs の影響が確認され、必要な更新または不要理由が記録される。
- [x] 変更範囲に見合う検証が実行され、未実施項目は理由付きで記録される。
- [ ] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントが日本語で投稿される。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run build --workspaces --if-present`
- Taskfile に適切な repository-level verification があれば、定義を確認したうえで追加実行を検討する。

## PR レビュー観点

- API 内部型への逆依存が増えていないこと。
- `/rpc/*` が既存 auth middleware と permission check の内側にあること。
- debug 付き chat / benchmark 実行で認可境界が弱まっていないこと。
- Zod schema と OpenAPI 生成が分岐していないこと。
- benchmark 期待語句・dataset 固有値を実装へ入れていないこと。

## リスク

- oRPC package API と既存 TypeScript / module 設定の相性差分。
- `@orpc/openapi` 生成への移行が既存 OpenAPI テストと完全互換でない可能性。
- 初回 PR では transport 移行を限定するため、一部 endpoint は当面 REST と oRPC contract が併存する。
