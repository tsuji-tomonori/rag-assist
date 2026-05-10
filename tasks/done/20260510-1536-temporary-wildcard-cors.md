# CORS wildcard temporary fix

状態: done
タスク種別: 修正

## 背景

2026-05-10 に API Gateway `/prod/me` が 502 を返し、Lambda 起動時に `CORS_ALLOWED_ORIGINS is required in production` で落ちているログが確認された。
現時点では本番用の独自ドメインがないため、ユーザー指示により CORS は一時的に `*` とする。

## 目的

production Lambda が `CORS_ALLOWED_ORIGINS` 未設定または `*` 拒否で起動失敗しないようにし、ドメイン確定までの一時措置として wildcard CORS を明示的に設定する。

## スコープ

- API runtime config の production CORS validation
- CDK Lambda environment
- API/infra tests
- 運用ドキュメント

## なぜなぜ分析サマリ

- 問題文: production API の `/prod/me` 呼び出し時に Lambda が起動できず、API Gateway が 502 を返した。
- 確認済み事実:
  - Lambda ログに `CORS_ALLOWED_ORIGINS is required in production` が出ている。
  - API config は production で `CORS_ALLOWED_ORIGINS` の明示指定を必須にしている。
  - CDK の `apiEnvironment` は `CORS_ALLOWED_ORIGINS` を設定していない。
  - 現時点では本番用の独自ドメインがないため、ユーザーは一時的に `*` を指定した。
- 推定原因:
  - production fail-closed validation を追加した際、deploy 用 CDK environment への `CORS_ALLOWED_ORIGINS` 追加が漏れた。
  - さらに既存 validation は production の `*` を禁止しているため、単に env を `*` にしても起動失敗が残る。
- 根本原因:
  - production config validation と CDK runtime environment / 現在のドメイン未確定運用条件が同期していなかった。
- 影響範囲:
  - API Lambda 起動全体。`/me` 以外の API route も同じ cold start で失敗しうる。
- 対応方針:
  - 一時措置として production の `CORS_ALLOWED_ORIGINS=*` を許容する。
  - CDK の API Lambda env に `CORS_ALLOWED_ORIGINS: "*"` を明示する。
  - docs / PR / レポートに、一時措置でありドメイン確定後に allowlist へ戻す残リスクを記録する。

## 計画

1. API config test を `*` 許容に更新する。
2. contract の `ApiRuntimeEnv` に `CORS_ALLOWED_ORIGINS` を追加する。
3. CDK の `apiEnvironment` に `CORS_ALLOWED_ORIGINS: "*"` を追加し、infra test で検証する。
4. `docs/OPERATIONS.md` の production CORS 記述を一時措置に合わせて更新する。
5. API/infra の対象テストと `git diff --check` を実行する。

## ドキュメント保守計画

`memorag-bedrock-mvp/docs/OPERATIONS.md` の主要環境変数に、ドメイン未確定期間のみ production でも `*` を許容する一時措置であることを明記する。

## 受け入れ条件

- production config が `CORS_ALLOWED_ORIGINS=*` で起動できる。
- CDK が API Lambda に `CORS_ALLOWED_ORIGINS: "*"` を設定する。
- `CORS_ALLOWED_ORIGINS` 未設定の production config は引き続き拒否される。
- 一時措置のセキュリティリスクと恒久対応方針が docs / PR / レポートに記録されている。
- 変更範囲に見合う API/infra の対象テストが pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- api-hardening.test.ts`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `git diff --check`

## 実施結果

- API config で production の `CORS_ALLOWED_ORIGINS=*` を一時許容した。
- CDK の `apiEnvironment` と contract 型へ `CORS_ALLOWED_ORIGINS` を追加した。
- infra assertion test と CloudFormation snapshot に Lambda env の `CORS_ALLOWED_ORIGINS: "*"` を反映した。
- `docs/OPERATIONS.md` と API design docs に、一時措置とドメイン確定後の allowlist 復帰方針を記録した。

## 実行した検証

- `npm ci`: pass。3 件の既存 vulnerability 報告あり。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/contract`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: 初回 fail、`packages/contract/infra.d.ts` 同期後 pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- api-hardening.test.ts`: pass。script の glob により API 全体 199 tests を実行。rebase 後にも再実行済み。
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass。snapshot 更新用。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass。15 tests。rebase 後にも再実行済み。
- `git diff --check`: pass。

## PR レビュー観点

- wildcard CORS が認証境界を解除していないこと。
- ドメイン確定後に allowlist へ戻す運用リスクが明記されていること。
- CDK と runtime config の環境変数定義が同期していること。

## リスク

- `Access-Control-Allow-Origin: *` は任意 origin からブラウザ経由の API 呼び出しを許可するため、Cognito 認証と権限チェックを前提とした一時措置に限定する必要がある。
- ドメイン確定後に allowlist 化しないと、外部公開面が必要以上に広い状態が残る。
