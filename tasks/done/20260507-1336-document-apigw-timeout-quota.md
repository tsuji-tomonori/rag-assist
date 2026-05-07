# API Gateway integration timeout quota のデプロイ前提明記

状態: done

## 背景

CDK deploy で `AWS::ApiGateway::Method` の `TimeoutInMillis` が 29,000ms を超える場合、デプロイ先アカウント / リージョンの API Gateway quota `Maximum integration timeout in milliseconds` を事前に引き上げておく必要がある。ユーザーは quota 引き上げ済みであり、今後のデプロイ手順にこの作業が必要であることを明記したい。

## 目的

MemoRAG MVP のデプロイ手順で、同期 API の 60 秒 integration timeout を使う前提として API Gateway quota 引き上げが必要なことを明示する。

## スコープ

- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md`
- 必要に応じて `memorag-bedrock-mvp/README.md`
- 作業完了レポート

## 計画

1. 既存のデプロイ手順と運用チェックを確認する。
2. API Gateway quota 引き上げの必要条件をデプロイ前チェックに明記する。
3. GitHub Actions deploy 手順にも失敗条件と必要作業を明記する。
4. 変更範囲に応じた最小検証を実行する。
5. レポート、commit、PR、受け入れ条件確認コメント、セルフレビューを行う。

## ドキュメント保守方針

今回の変更はデプロイ運用手順の明確化であるため、永続的な運用 docs を更新する。要件・API contract・アプリ挙動は変更しないため、要求 docs と API docs は更新対象外とする。

## 受け入れ条件

- API Gateway quota `Maximum integration timeout in milliseconds` を 60,000ms 以上へ引き上げる必要があることがデプロイ前提として明記されている。
- 対象 quota はデプロイ先アカウント / リージョン単位で必要であることが分かる。
- quota 未設定時に `Timeout should be between 50 ms and 29000 ms` で deploy が失敗し得ることが分かる。
- 通常 REST API と chat streaming / WebSocket idle timeout を混同しない表現になっている。
- 変更した Markdown に trailing whitespace などの機械的問題がない。

## 検証計画

- `git diff --check`
- 変更 Markdown の目視確認

## PR レビュー観点

- デプロイ手順として必要な作業が具体的か。
- 実施していない AWS deploy や quota 操作を実施済みとして書いていないか。
- docs と現行 CDK 設定に矛盾がないか。

## リスク

- 実際の AWS quota 値はローカルから確認しないため、PR では「手順の明記」として扱い、実環境の再 deploy 成功は未検証として報告する。
