# oRPC contract package 導入 作業完了レポート

## 受けた指示

`apps/api` から型を借りず、`memorag-bedrock-mvp/packages/contract` を Zod schema、oRPC contract、型定義の single source of truth として追加する。API は contract を実装し、web と benchmark は contract 由来の `ApiClient` 型で oRPC client を作り、infra は env/config 型を `import type` + `satisfies` で使う。

## 要件整理

- 初回移行は chat と benchmark の主要 endpoint に絞る。
- 既存 REST route、SSE、presigned upload、Lambda response streaming は維持する。
- web/benchmark が API 内部型や重複 API response 型へ依存しないようにする。
- `/rpc/*` は既存の認証・認可境界の内側に置く。
- OpenAPI 生成への影響を確認し、今回の互換性範囲を記録する。

## 実施作業

- `memorag-bedrock-mvp/packages/contract` workspace を追加し、JSON/limits/infra 型、chat/search/benchmark/system schema、`apiContract`、`ApiClient` 型を定義した。
- API に `apps/api/src/orpc/router.ts` と `/rpc/*` handler を追加し、`chat:create`、`chat:admin:read_all`、`benchmark:query` の既存 permission check を維持した。
- `access-control-policy.test.ts` に `/rpc/*` の auth middleware coverage を追加した。
- web に `shared/api/orpc.ts` を追加し、chat wrapper を `ApiClient` 経由に差し替えた。SSE は既存 REST streaming を維持した。
- benchmark に `api-client.ts` を追加し、query/search/conversation runner を oRPC client 経由に差し替えた。
- infra の Lambda environment object に contract 由来型を `import type` + `satisfies` で適用した。
- README に contract package と `/rpc/*` の初回移行範囲、REST 併存方針を追記した。
- App test と benchmark test を oRPC request envelope に合わせて更新した。

## 判断

`/openapi.json` は今回 oRPC 生成へ切り替えず、既存 Hono OpenAPI 生成を維持した。現時点で oRPC OpenAPI へ全面切替すると、未移行の documents/questions/history/debug/admin など既存 REST route の OpenAPI coverage を落とすため。contract package は初回対象 endpoint の source of truth とし、REST OpenAPI は段階移行中の互換仕様として残す。

## 検証

- `npm run typecheck -w @memorag-mvp/contract`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/benchmark`: pass
- `npm run typecheck -w @memorag-mvp/infra`: pass
- `npm run test -w @memorag-mvp/api`: pass, 170 tests
- `npm run test -w @memorag-mvp/web`: pass, 177 tests
- `npm run test -w @memorag-mvp/benchmark`: pass, 50 tests
- `npm run lint`: pass
- `npm run build --workspaces --if-present`: pass
- `npm run docs:openapi:check`: pass。sandbox 内では `tsx` の `/tmp` IPC pipe listen が `EPERM` になったため、同一コマンドを権限付きで再実行した。
- `git diff --check`: pass

## 成果物

- `memorag-bedrock-mvp/packages/contract`
- `memorag-bedrock-mvp/apps/api/src/orpc/router.ts`
- `memorag-bedrock-mvp/apps/web/src/shared/api/orpc.ts`
- `memorag-bedrock-mvp/benchmark/api-client.ts`
- `tasks/do/20260509-2049-orpc-contract-package.md`

## fit 評価

要求された依存方向は満たした。web/benchmark は API 内部型ではなく contract 由来の `ApiClient` 型を使う。infra は runtime import を避ける。API route の既存 REST 互換と認可境界も維持した。

## 未対応・制約・リスク

- documents/questions/history/debug/admin の contract 移行は未対応で、後続 PR 対象。
- SSE、S3 presigned upload、Lambda response streaming は transport 移行せず既存実装を維持。
- oRPC OpenAPI 生成への全面切替は、未移行 REST route の coverage を落とさない段階で実施する。
- `npm install` 実行時に既存依存も含む audit warning として 3 vulnerabilities が表示されたが、本タスクでは修正していない。
