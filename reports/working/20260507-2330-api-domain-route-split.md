# API 領域別 route 分割 作業レポート

## 指示

- `memorag-bedrock-mvp/apps/api/src/routes/api-routes.ts` が次の競合点になるため、API ごとに file 分割したい。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | `api-routes.ts` を aggregator に薄くする | 対応 |
| R2 | API 領域別に route 定義を分割する | 対応 |
| R3 | endpoint、schema、permission、auth middleware 対象を変えない | 対応 |
| R4 | 静的 access-control policy test を分割後の route file 群へ対応させる | 対応 |
| R5 | API typecheck / test / diff check / pre-commit を実行する | 対応 |

## 検討・判断

- `api-routes.ts` は route 登録順序を維持する aggregator に限定した。
- 領域は `system`、`admin`、`document`、`chat`、`question`、`conversation-history`、`debug`、`benchmark` に分けた。
- `benchmark seed` の upload whitelist と delete authorization は document route と test export の両方から使うため、`benchmark-seed.ts` に分離した。
- `looseRoute` と `sleep` は複数 route file で使うため、`route-utils.ts` に移動した。
- 静的 policy test は `src/routes/*.ts` を列挙して読み、今後の route file 追加にも追従しやすくした。

## 実施作業

- `routes/api-routes.ts` を 25 行の aggregator に縮小。
- 以下の route module を追加:
  - `admin-routes.ts`
  - `benchmark-routes.ts`
  - `chat-routes.ts`
  - `conversation-history-routes.ts`
  - `debug-routes.ts`
  - `document-routes.ts`
  - `question-routes.ts`
  - `system-routes.ts`
- 共有 module として `route-context.ts`、`route-utils.ts`、`benchmark-seed.ts` を追加。
- `access-control-policy.test.ts` を `src/routes/*.ts` の読み取りに対応。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/routes/api-routes.ts` | 領域別 route module の登録 aggregator |
| `memorag-bedrock-mvp/apps/api/src/routes/*-routes.ts` | API 領域別 route 定義 |
| `memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts` | benchmark seed upload/delete 認可 helper |
| `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` | 分割後 route source の静的 policy 検証 |

## 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass。162 tests pass。
- `git diff --check`: pass
- `pre-commit run --files ...`: pass

## Security / Access-Control Review

- 新規 endpoint は追加していない。
- 既存 route の method、path、schema、status code、permission check は維持した。
- auth middleware 対象は `app.ts` の `protectedApiPaths` のまま変更していない。
- route-level permission の静的検証は `src/routes/*.ts` 全体を読む形にした。
- RAG の根拠性、認可境界、benchmark dataset 固有分岐は変更していない。

## Fit 評価

総合fit: 4.9 / 5.0（約98%）

理由: `api-routes.ts` は 1654 行から 25 行になり、主要 API 領域を別 file に分割できた。API typecheck と全 API test は pass し、静的 policy test も分割後に追従した。満点でない理由は、`document-routes.ts` が 524 行でまだ大きく、将来 upload / ingest-run / reindex にさらに分割する余地があるため。

## 未対応・制約・リスク

- `document-routes.ts` は document upload、document ingest run、reindex を含むため、次に競合しそうならさらに分ける余地がある。
- GitHub Actions の結果は PR 更新後に確認が必要。
