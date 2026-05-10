# Document ingest Lambda timeout limit

状態: done

## 背景

CDK deploy で `DocumentIngestRunWorkerFunction` の Lambda 設定が AWS Lambda の制約に抵触した。ユーザーから `Duration.minutes` を 15 分にし、Service Quotas で memory 上限を上げずに `memorySize` を 3008 にする指示を受けた。

## 目的

`DocumentIngestRunWorkerFunction` の Lambda timeout と memory size を対象 AWS 環境の上限内に戻し、同じ設定が CDK テストで確認できるようにする。

## タスク種別

修正

## なぜなぜ分析サマリ

- confirmed: 現在の CDK 定義では `DocumentIngestRunWorkerFunction` が `timeout: Duration.minutes(30)` になっている。
- confirmed: Lambda の timeout は 15 分以下にする必要がある。
- confirmed: ユーザーは `Duration.minutes` を 15 分にすることを指示した。
- inferred: PDF ingest OOM 対策の一部として timeout が 30 分に拡張されたが、Lambda の実行時間上限を超えていた。
- confirmed: `memorySize: 4096` は対象 AWS 環境の `<= 3008` 制約に引き続き抵触する。
- root cause: CDK 定義で Lambda サービス上限を超える timeout が指定され、テストで対象 worker の timeout 上限を明示的に検出していなかった。
- remediation: CDK 定義を `Duration.minutes(15)` と `memorySize: 3008` に戻し、対象 worker の `Timeout: 900` と `MemorySize: 3008` を assertion で確認する。

## 作業範囲

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- 必要な snapshot 更新

## ドキュメント保守方針

`memorag-bedrock-mvp/docs/OPERATIONS.md` に 30 分 timeout の記述が残っていたため、実装と同期して 15 分に更新する。

## 受け入れ条件

- `DocumentIngestRunWorkerFunction` の CDK 定義が `timeout: Duration.minutes(15)` である。
- `DocumentIngestRunWorkerFunction` の CDK 定義が `memorySize: 3008` である。
- CDK テンプレート上で対象 Lambda の `Timeout` が `900` 秒、`MemorySize` が `3008` MB であることをテストで確認できる。
- `task memorag:cdk:test` または同等の CDK test が pass する。
- deploy は実行していない場合、実施済みとして報告しない。
- `cdk deploy` は未実施の場合、実施済みとして報告しない。

## 検証計画

- `task memorag:cdk:test`
- `git diff --check`

## PR レビュー観点

- Lambda timeout が 15 分を超えていないこと。
- snapshot と assertion が同じ期待値を示すこと。
- memory size が対象 AWS 環境の上限内に収まっていること。

## リスク

`cdk deploy` は実環境更新を伴うため、このタスクでは未実施とする。

## 実施結果

- `DocumentIngestRunWorkerFunction` の timeout を `Duration.minutes(15)` に変更した。
- `DocumentIngestRunWorkerFunction` の memory size を `3008` に変更した。
- CDK assertion test と snapshot を更新した。
- `memorag-bedrock-mvp/docs/OPERATIONS.md` を 3008MB memory / 15 分 timeout に同期した。
- `task memorag:cdk:test`: pass。
- `git diff --check`: pass。
- `cdk deploy`: 未実施。
