# 作業完了レポート

保存先: `reports/working/20260509-0102-openapi-auth-metadata-colocation.md`

## 1. 受けた指示

- `memorag-bedrock-mvp/apps/api/src/authorization.ts` に API ごとの認可 metadata を集約すると競合が起きるため避けたい。
- それぞれの zod による OpenAPI 定義の metadata として定義できないか確認し、対応する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | API ごとの認可一覧を `authorization.ts` に集約しない | 高 | 対応 |
| R2 | 各 Hono/zod-openapi route 定義の metadata として認可情報を置く | 高 | 対応 |
| R3 | 生成 Markdown の出力内容は維持する | 高 | 対応 |
| R4 | metadata 欠落・401/403 欠落の検証を維持する | 高 | 対応 |
| R5 | 変更後に docs / API test / typecheck を再実行する | 高 | 対応 |

## 3. 検討・判断したこと

- `authorization.ts` には role、permission、metadata 計算 helper だけを残し、route 一覧は削除した。
- 各 route の `looseRoute({ ... })` 内に `x-memorag-authorization: routeAuthorization({...})` を明示し、OpenAPI 定義と endpoint 実装の近くで認可仕様を保守できる形にした。
- `route-utils.ts` は route config に含まれる `x-memorag-authorization` を見て 401 / 403 response を補うだけにし、path/method lookup を行わないようにした。
- access-control policy test は中央 route 一覧に依存せず、生成 OpenAPI の metadata と route source を突き合わせる形へ変更した。

## 4. 実施した作業

- `authorization.ts` から `routeAuthorizationPolicies`、path/method key、policy map を削除した。
- `route-utils.ts` から path/method lookup を削除し、route config 内 metadata を読む実装に変更した。
- `admin-routes.ts`、`document-routes.ts`、`chat-routes.ts`、`question-routes.ts`、`conversation-history-routes.ts`、`debug-routes.ts`、`benchmark-routes.ts`、`system-routes.ts` の各 route 定義へ `x-memorag-authorization` を追加した。
- `access-control-policy.test.ts` を OpenAPI metadata 由来の policy で handler 側 permission check を検証する形へ変更した。
- `docs:openapi` を再実行し、生成 Markdown の内容が維持されることを確認した。
- PR CI が最新 `origin/main` との merge ref で API test 失敗になったため、`origin/main` を取り込んで再検証した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/routes/*.ts` | TypeScript | 各 OpenAPI route 定義内の `x-memorag-authorization` | route 定義への metadata 分散 |
| `memorag-bedrock-mvp/apps/api/src/authorization.ts` | TypeScript | route 一覧集約の削除、metadata helper 維持 | 競合リスク低減 |
| `memorag-bedrock-mvp/apps/api/src/routes/route-utils.ts` | TypeScript | route config 内 metadata から 401/403 を補完 | script 推測なし |
| `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` | TypeScript test | OpenAPI metadata と handler permission check の整合検証 | 回帰防止 |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | `authorization.ts` 集約を外し、各 route 定義へ metadata を移した。 |
| 制約遵守 | 5 | Markdown 生成器ではなく OpenAPI route metadata を source of truth にしている。 |
| 成果物品質 | 4.8 | endpoint 近傍に metadata があり競合しにくい。共通 helper は role 計算に限定した。 |
| 説明責任 | 5 | 追加作業レポートに判断と検証を記録した。 |

総合fit: 4.95 / 5.0（約99%）

## 7. 実行した検証

- `npm --prefix memorag-bedrock-mvp run docs:openapi`: pass
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test:coverage -w @memorag-mvp/api`: pass（`origin/main` 取り込み後、165 tests）
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- 生成 Markdown の内容は同一のため、今回の追加対応では generated docs に差分は出ていない。
- `routeAuthorization` helper は role 計算を共通化するため残している。API ごとの metadata 自体は各 route 定義に分散した。
- PR CI の初回失敗は、古い branch と最新 `main` の merge ref で追加テストが入り、ローカル branch 側で再現条件が不足していたことが原因。`origin/main` 取り込み後の API coverage では再現せず pass した。
