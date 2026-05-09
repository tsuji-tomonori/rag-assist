# Benchmark log error hardening

状態: validation

## 背景

性能テストのログ取得で、API Lambda role が CloudWatch Logs の `logs:GetLogEvents` を実行できず、AWS の認可エラー詳細がフロントエンドの例外へそのまま出ている。

## 目的

Benchmark CodeBuild log の取得権限を修正し、API の内部エラー詳細をレスポンスへ返さない。詳細は Hono 側のエラーログに残す。

## Scope

- `memorag-bedrock-mvp` API の Hono error handler。
- benchmark CodeBuild log reader と download route。
- benchmark CodeBuild log group に対する API Lambda IAM policy。
- API/infra の回帰テスト。
- API エラー応答 hardening 用 skill。

## Plan

1. API error response hardening skill を追加する。
2. `app.onError` を、非 HTTP 例外はログのみ詳細出力し、レスポンスは固定文言にする実装へ変更する。
3. benchmark log reader の CloudWatch Logs 権限 resource を実際の log stream ARN に合うよう修正する。
4. benchmark logs endpoint で AWS SDK 由来の例外詳細がレスポンスへ出ないことをテストする。
5. CDK test で `logs:GetLogEvents` resource を検証する。

## Documentation Maintenance Plan

- behavior は API エラー応答方針と運用ログ取得の安全性に関わるため、必要なら docs / OpenAPI の記述更新を行う。
- skill 追加により今後の API エラー応答レビュー手順を明文化する。

## 受け入れ条件

- [x] Benchmark CodeBuild log 取得で必要な `logs:GetLogEvents` が API Lambda role に付与される。
- [x] `logs:GetLogEvents` の resource ARN が benchmark CodeBuild log stream を対象にできる。
- [x] Hono の非 HTTP 例外レスポンスに AWS ARN、role、resource、SDK 生メッセージなどの内部詳細が含まれない。
- [x] 内部詳細は Hono 側の error log に残る。
- [x] benchmark logs endpoint の失敗時レスポンスが安全な固定文言になる。
- [x] 関連テストが実行され、未実施がある場合は理由が記録される。

## Validation Plan

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `git diff --check`

## Validation Result

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass。意図した IAM resource 変更により snapshot を更新。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `git diff --check`: pass

## PR Review Points

- API レスポンスに内部エラー詳細を残していないこと。
- IAM 権限が benchmark CodeBuild log group に限定されていること。
- benchmark dataset 固有の分岐や RAG 回答挙動変更を含まないこと。

## Risks

- 既存 UI が 500 応答の詳細文言に依存している場合は表示文言が変わる。
- デプロイ済み環境は CDK deploy されるまで IAM 修正が反映されない。
