# API route split conflict resolution 作業レポート

## 指示

- PR #181 の競合を解消する。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | `origin/main` を取り込む | 対応 |
| R2 | merge conflict を解消する | 対応 |
| R3 | API route 分割構成を維持する | 対応 |
| R4 | main 側の API 挙動変更を失わない | 対応 |
| R5 | 必要な検証を実行する | 対応 |

## 検討・判断

- 競合は `memorag-bedrock-mvp/apps/api/src/app.ts` のみだった。
- PR #181 側の薄い `app.ts` 構成を維持し、main 側の monolithic route 定義は再導入しない方針にした。
- main 側の API 変更は `benchmarkSearchUser` の user override 廃止だったため、分割後の `routes/benchmark-routes.ts` に同じ 400 応答を反映した。
- main 側のその他変更は merge でそのまま取り込んだ。

## 実施作業

- `origin/main` を merge。
- `app.ts` の conflict を、薄い app assembly 構成で解消。
- `benchmark-routes.ts` に main 側の `Benchmark search user override is not supported` 変更を反映。
- 競合解消後に API typecheck / API test / diff check を実行。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/app.ts` | route 分割後の薄い app 構成を維持 |
| `memorag-bedrock-mvp/apps/api/src/routes/benchmark-routes.ts` | main 側 benchmark search override 廃止を反映 |
| `reports/working/20260508-0000-resolve-api-route-split-conflicts.md` | 本作業レポート |

## 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass。162 tests pass。
- `git diff --check`: pass

## Security / Access-Control Review

- 新規 route は追加していない。
- route-level permission と auth middleware 対象は変更していない。
- main 側の benchmark search user override 廃止を維持し、dataset user override の再導入を避けた。
- 静的 access-control policy test は API test 内で pass している。

## Fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: 競合を解消し、PR #181 の route 分割構成と main 側の benchmark search hardening を両立した。API typecheck と全 API test は pass。満点でない理由は、GitHub Actions 結果が PR 更新後まで未確認のため。

## 未対応・制約・リスク

- PR 更新後の GitHub Actions 結果は別途確認が必要。
