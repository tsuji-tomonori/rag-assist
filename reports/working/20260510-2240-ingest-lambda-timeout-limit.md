# Document ingest Lambda timeout limit

## 指示

- `DocumentIngestRunWorkerFunction` の `Duration.minutes` を 15 分にする。
- pull 後の状態を前提に見直す。
- Service Quotas で memory 上限を上げられなさそうなため、`memorySize` を 3008 にする。

## 要件整理

- 対象 Lambda の CDK 定義で `timeout: Duration.minutes(15)` にする。
- 対象 Lambda の CDK 定義で `memorySize: 3008` にする。
- 合成テンプレート上の `Timeout` が 900 秒になることを検証する。
- 合成テンプレート上の `MemorySize` が 3008 MB になることを検証する。
- 関連する運用文書に古い 30 分記述が残る場合は実装と同期する。
- deploy は実環境更新のため実行済み扱いにしない。

## 検討・判断

- pull 後の `main` では `DocumentIngestRunWorkerFunction` が `timeout: Duration.minutes(30)` になっており、Lambda の 15 分上限を超えていた。
- 追加指示で Service Quotas による引き上げではなく、対象 AWS 環境の制約内である `memorySize: 3008` に変更する方針になった。
- `memorag-bedrock-mvp/docs/OPERATIONS.md` に 4096MB memory / 30 分 timeout 由来の記述が残っていたため、3008MB memory / 15 分 timeout へ同期した。

## 実施作業

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` の `DocumentIngestRunWorkerFunction` timeout を 15 分に変更。
- `DocumentIngestRunWorkerFunction` の memory size を 3008 MB に変更。
- CDK assertion test で対象 Lambda の `MemorySize` が 3008 MB、`Timeout` が 900 秒であることを確認するテストを追加。
- CDK snapshot の対象 Lambda memory size と timeout を同期。
- `memorag-bedrock-mvp/docs/OPERATIONS.md` の運用記述を 3008MB memory / 15 分 timeout に更新。

## 成果物

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `tasks/done/20260510-2240-ingest-lambda-timeout-limit.md`

## 実行した検証

- `npm ci`: pass。worktree に `node_modules` がなく、初回 `task memorag:cdk:test` が `tsc: not found` で失敗したため実行。
- `task memorag:cdk:test`: pass。
- `git diff --check`: pass。

## 未対応・制約・リスク

- `cdk deploy` は実行していない。
- `cdk deploy` は未実施のため、実環境での deploy 成功までは未確認。
- `npm ci` で `3 vulnerabilities (1 moderate, 2 high)` が表示されたが、今回の timeout 修正とは別件として未対応。

## fit 評価

総合fit: 4.5 / 5.0

理由: 指示された timeout と memory size の変更、テスト追加、snapshot/docs 同期、検証まで実施した。一方で `cdk deploy` は未実施のため、実環境 deploy の完了までは保証していない。
