# 性能テスト CodeBuild ログ URL 永続化と運用文書更新

## 保存先

`reports/tasks/20260506-2004-benchmark-codebuild-log-persistence.md`

## 背景

CodeBuild ログを失敗時でも DL 可能にするには、実行履歴に CodeBuild のログ URL が保存されている必要がある。従来は API がログ URL を返す契約を持っていなかったため、CodeBuild 側で履歴テーブルへログ URL を保存する処理も不足していた。

## 目的

性能テスト CodeBuild 実行開始時にログ URL を実行履歴へ保存し、Web/API から失敗時でもログ確認へ進める状態を作る。

## 対象範囲

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `memorag-bedrock-mvp/README.md`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`

## 方針

- CodeBuild プロジェクトに `BENCHMARK_RUNS_TABLE_NAME` を渡す。
- CodeBuild install phase でログ URL と build ID を DynamoDB の実行履歴へ保存する。
- `CODEBUILD_BUILD_URL` が空の場合は AWS Console の build URL を組み立てる。
- CodeBuild ロールへ benchmark runs table の write 権限を付与する。
- CDK snapshot と運用ドキュメントを更新する。

## 必要情報

- Benchmark runs table 名
- CodeBuild build ID
- CodeBuild project ARN / region
- DynamoDB update-item の対象 key
- 運用時に参照するログ DL の説明

## 実行計画

1. CDK stack で CodeBuild 環境変数へ benchmark runs table 名を追加する。
2. CodeBuild install phase に DynamoDB update-item を追加し、`codeBuildBuildId` と `codeBuildLogUrl` を保存する。
3. CodeBuild project role に table write 権限を付与する。
4. CDK snapshot を更新し、infra テストで差分を固定する。
5. README と運用ドキュメントへログ DL の扱いを追記する。

## ドキュメントメンテナンス計画

- README の性能テスト説明に、失敗時は CodeBuild ログから原因調査する導線を追加する。
- `docs/OPERATIONS.md` に、実行履歴から CodeBuild ログを取得できることを記載する。
- API 詳細は API 契約 task 側で管理する。

## 受け入れ条件

| ID | 条件 |
|---|---|
| AC-INFRA-001 | CodeBuild に `BENCHMARK_RUNS_TABLE_NAME` が設定される。 |
| AC-INFRA-002 | CodeBuild install phase で `codeBuildBuildId` と `codeBuildLogUrl` が DynamoDB に保存される。 |
| AC-INFRA-003 | `CODEBUILD_BUILD_URL` がない場合のフォールバック URL がある。 |
| AC-INFRA-004 | CodeBuild role が benchmark runs table に書き込める。 |
| AC-INFRA-005 | CDK snapshot が更新され、infra テストが通っている。 |
| AC-INFRA-006 | README と運用ドキュメントが更新されている。 |

## 受け入れ条件チェック

| ID | 判定 | 根拠 |
|---|---|---|
| AC-INFRA-001 | PASS | PR #129 の `memorag-mvp-stack.ts` で環境変数を追加済み。 |
| AC-INFRA-002 | PASS | PR #129 の CodeBuild install phase に DynamoDB `update-item` を追加済み。 |
| AC-INFRA-003 | PASS | PR #129 で `CODEBUILD_BUILD_URL` が空の場合の Console URL 組み立てを追加済み。 |
| AC-INFRA-004 | PASS | PR #129 で `benchmarkRunsTable.grantWriteData(benchmarkProject)` を追加済み。 |
| AC-INFRA-005 | PASS | PR #129 で snapshot を更新し、infra test と typecheck を実行済み。 |
| AC-INFRA-006 | PASS | PR #129 で `README.md` と `docs/OPERATIONS.md` を更新済み。 |

## 検証計画

- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`
- 実環境確認を行う場合は、失敗する性能テスト実行を 1 件作成し、履歴から CodeBuild ログ URL が開けることを確認する。

## PRレビュー観点

- install phase の DynamoDB 更新が benchmark runner の既存処理を妨げないか。
- CodeBuild role への write 権限付与が benchmark runs table に限定されているか。
- snapshot 差分がログ URL 永続化に必要な変更だけになっているか。

## 未決事項・リスク

- 実 AWS 上での失敗実行からのログ表示確認は未実施。PR #129 では CDK snapshot、infra test、typecheck で構成変更を検証している。
