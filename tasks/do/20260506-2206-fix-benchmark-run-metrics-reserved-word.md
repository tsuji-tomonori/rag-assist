# Benchmark run metrics 更新の DynamoDB 予約語修正

状態: do

## 背景

CodeBuild benchmark runner の POST_BUILD で `node infra/scripts/update-benchmark-run-metrics.mjs` が失敗した。
DynamoDB の `UpdateExpression` に `metrics` を直接指定しており、`metrics` が予約語として扱われたため `ValidationException: reserved keyword: metrics` が発生している。

## 目的

Benchmark 実行結果の S3 アップロード後、run record への metrics 更新が DynamoDB 予約語エラーで失敗しないようにする。

## スコープ

- 対象: `memorag-bedrock-mvp/infra/scripts/update-benchmark-run-metrics.mjs`
- 必要に応じて同スクリプトのテストを追加・更新する
- durable docs は、運用手順や API contract の変更ではないため原則更新不要と判断する

## 計画

1. `UpdateExpression` で `metrics` を直接参照しないよう `ExpressionAttributeNames` を使う。
2. `UpdateItemCommand` の入力を検証できるテストを追加する。
3. infra の対象テストと差分チェックを実行する。
4. 作業レポートを作成し、commit / PR / PR コメントまで進める。

## 受け入れ条件

- AC1: `update-benchmark-run-metrics.mjs` の `UpdateExpression` が `metrics` を属性名として直接使わない。
- AC2: DynamoDB `UpdateItemCommand` に `ExpressionAttributeNames` が設定され、`metrics` がエイリアス経由で更新される。
- AC3: `metrics` 抽出・DynamoDB 属性値変換の既存挙動が維持される。
- AC4: 関連テストまたは同等の機械的検証が pass している。
- AC5: 実施した検証と未実施の検証が report / PR に明記されている。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `git diff --check`
- DynamoDB 実サービスを使う CodeBuild 再実行は、この作業環境からは未実施として明記する。

## 検証結果

- `npm ci`: pass
- `npm run test -w @memorag-mvp/infra`: pass
- `npm run typecheck -w @memorag-mvp/infra`: pass
- `git diff --check`: pass
- `pre-commit run --files memorag-bedrock-mvp/infra/scripts/update-benchmark-run-metrics.mjs memorag-bedrock-mvp/infra/test/update-benchmark-run-metrics.test.ts tasks/do/20260506-2206-fix-benchmark-run-metrics-reserved-word.md reports/working/20260506-2206-fix-benchmark-run-metrics-reserved-word.md`: pass

## 未実施の検証

- AWS 上の CodeBuild benchmark runner 再実行: この作業環境から実 DynamoDB テーブルと CodeBuild runner を直接使わないため未実施。

## PR レビュー観点

- `metrics` 以外の属性名が予約語リスクを持たないか。
- mock で確認する `UpdateItemCommand` 入力が本番スクリプトの実行経路を通っているか。
- docs と実装の同期、変更範囲に見合うテスト、RAG の根拠性・認可境界への影響。

## リスク

- DynamoDB 実アクセスはローカル検証できないため、AWS 上の再実行確認は PR 後の CI / CodeBuild 実行に依存する。
