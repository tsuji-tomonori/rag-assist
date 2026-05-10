# Document ingest Lambda timeout limit

## 指示

- `DocumentIngestRunWorkerFunction` の `Duration.minutes` を 15 分にする。
- pull 後の状態を前提に見直す。

## 要件整理

- 対象 Lambda の CDK 定義で `timeout: Duration.minutes(15)` にする。
- 合成テンプレート上の `Timeout` が 900 秒になることを検証する。
- 関連する運用文書に古い 30 分記述が残る場合は実装と同期する。
- deploy は実環境更新のため実行済み扱いにしない。

## 検討・判断

- pull 後の `main` では `DocumentIngestRunWorkerFunction` が `timeout: Duration.minutes(30)` になっており、Lambda の 15 分上限を超えていた。
- ユーザー指示は timeout 修正のため、`memorySize: 4096` は変更対象外とした。
- ただし対象 AWS 環境では `MemorySize <= 3008` の制約が残るため、deploy 失敗リスクとして明記する。
- `memorag-bedrock-mvp/docs/OPERATIONS.md` に 30 分 timeout の記述が残っていたため、15 分へ同期した。

## 実施作業

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` の `DocumentIngestRunWorkerFunction` timeout を 15 分に変更。
- CDK assertion test で対象 Lambda の `Timeout` が 900 秒であることを確認するテストを追加。
- CDK snapshot の対象 Lambda timeout を 900 秒へ更新。
- `memorag-bedrock-mvp/docs/OPERATIONS.md` の運用記述を 15 分 timeout に更新。

## 成果物

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `tasks/do/20260510-2240-ingest-lambda-timeout-limit.md`

## 実行した検証

- `npm ci`: pass。worktree に `node_modules` がなく、初回 `task memorag:cdk:test` が `tsc: not found` で失敗したため実行。
- `task memorag:cdk:test`: pass。
- `git diff --check`: pass。

## 未対応・制約・リスク

- `cdk deploy` は実行していない。
- `memorySize: 4096` は今回の指示対象外として変更していない。対象 AWS 環境で `MemorySize <= 3008` の制約が続く場合、deploy は引き続き失敗する。
- `npm ci` で `3 vulnerabilities (1 moderate, 2 high)` が表示されたが、今回の timeout 修正とは別件として未対応。

## fit 評価

総合fit: 4.5 / 5.0

理由: 指示された timeout 変更、テスト追加、snapshot/docs 同期、検証まで実施した。一方で memory size の deploy 制約は指示対象外として残しているため、deploy 全体の成功までは保証していない。
