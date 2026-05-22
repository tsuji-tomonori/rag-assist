# PR #326 benchmark seed auth boundary 作業レポート

## 受けた指示
- `POST /documents` の legacy 経路で、通常 writer が benchmark seed 形式の body により group scope 必須チェックを迂回できる可能性を塞ぐ。
- benchmark seed 形式の body は必ず `benchmark:seed_corpus` を要求する。
- 通常 writer では no-scope でも group scope 付きでも benchmark seed metadata 混入を拒否するテストを追加する。

## 要件整理
| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | `rag:doc:write:group` のみでは benchmark seed 形 body を `POST /documents` できない | 対応 |
| R2 | `benchmark:seed_corpus` では benchmark seed body を group scope なしで `POST /documents` できる | 対応 |
| R3 | 通常 writer が group scope 付きでも benchmark seed metadata を混ぜた場合は拒否 | 対応 |
| R4 | `authorizeDocumentUpload` の単体テストで seed body は seed 権限専用と固定 | 対応 |
| R5 | 関連 API テスト、typecheck、diff check を通す | 対応 |

## 検討・判断
- `authorizeDocumentUpload` の先頭で `isBenchmarkSeedUpload(body)` を判定し、seed 形 body は `benchmark:seed_corpus` がない限り 403 にした。
- 通常文書の `rag:doc:write:group` 許可は benchmark seed 形ではない body に限定されるため、folder scope 必須の通常文書経路と seed 登録経路が分離される。
- `/documents/uploads` 系は upload session の purpose で既に分離されているため、今回の修正は `POST /documents` legacy 経路に限定した。

## 実施作業
- `apps/api/src/routes/benchmark-seed.ts` の `authorizeDocumentUpload` 判定順序を変更。
- `apps/api/src/contract/api-contract.test.ts` に、RAG_GROUP_MANAGER が benchmark seed 形 body を no-scope / group scope 付きのどちらでも `POST /documents` できない contract test を追加。
- 同テスト内の authorization unit で、manager が seed body を送る場合は 403 になることを追加確認。

## 成果物
| 成果物 | 内容 |
|---|---|
| `apps/api/src/routes/benchmark-seed.ts` | benchmark seed body は seed 権限専用に変更 |
| `apps/api/src/contract/api-contract.test.ts` | 通常 writer の seed metadata 迂回防止テストを追加 |
| `tasks/do/20260521-0131-pr326-benchmark-seed-auth-boundary.md` | 作業 task |

## 検証
- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts` 成功
- `npm run typecheck -w @memorag-mvp/api` 成功
- `git diff --check` 成功

## Fit 評価
総合fit: 5.0 / 5.0

理由: 指摘された `POST /documents` legacy 経路の benchmark seed 形 body による scope 迂回を、認可判定順序の修正と contract/unit テストで固定した。BENCHMARK_RUNNER の seed 登録は維持し、通常 writer の混入は no-scope / group scope 付きの両方で拒否している。

## 未対応・制約・リスク
- リモート CI の完了はこのレポート作成時点では未確認。
- `tsx` の直接実行は sandbox の IPC pipe 制約で EPERM になったため、対象 contract テストは承認後に sandbox 外で実行した。
