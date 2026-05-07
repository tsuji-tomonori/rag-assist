# 権限周りバグ調査 作業完了レポート

- 作成日時: 2026-05-07 20:13 JST
- 作業ブランチ: `codex/access-control-audit`
- 対象 task: `tasks/do/20260507-2013-access-control-audit.md`

## 受けた指示

ユーザーから「権限周りにおいてバグがないか調査して」と依頼された。`/plan` 後の `go` により、計画に沿って調査、必要な修正、検証、PR 準備まで進める方針とした。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | API route と認証・認可境界を確認する | 対応 |
| R2 | 所有者・担当者境界と store 操作を確認する | 対応 |
| R3 | 機微フィールド返却、public endpoint、local auth 設定を確認する | 対応 |
| R4 | 明確なバグがあれば最小修正と回帰テストを追加する | 対応 |
| R5 | 実行した検証と未実施検証を正直に記録する | 対応 |

## 検討・判断の要約

- `skills/security-access-control-reviewer/SKILL.md` に沿って、`app.ts`、`auth.ts`、`authorization.ts`、`access-control-policy.test.ts`、streaming Lambda、service/store、CDK の認証設定を確認した。
- `app.ts` の protected route は既存 static policy test と概ね同期していた。
- `GET /chat-runs/{runId}/events` は本番 CDK で専用 streaming Lambda へ配線されるため、Hono handler とは別に認可境界を確認した。
- Hono 側は `chat:read:own` を要求する一方、streaming Lambda は所有者一致または `chat:admin:read_all` のみを見ており、所有者でも `chat:read:own` がないユーザーが run events を読める不整合をバグとして扱った。
- ユーザー停止・再開については、現行設計書に「Cognito Admin API への実変更は後続 adapter/運用設計で扱う」と明記されているため、今回の修正対象から外した。

## 実施作業

- `memorag-bedrock-mvp/apps/api/src/chat-run-events-stream.ts`
  - streaming Lambda の Cognito groups から permission を算出し、`chat:read:own` または `chat:admin:read_all` がない場合は 403 を返すよう修正した。
  - 所有者以外の読み取りは従来どおり `chat:admin:read_all` のみに限定した。
- `memorag-bedrock-mvp/apps/api/src/contract/chat-run-events-stream.test.ts`
  - 所有者でも `chat:read:own` がない場合は 403 になる回帰テストを追加した。
  - `SYSTEM_ADMIN` が他ユーザーの run events を読めることを確認するテストを追加した。
- `tasks/do/20260507-2013-access-control-audit.md`
  - 調査 task と受け入れ条件を作成した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/chat-run-events-stream.ts` | streaming Lambda の route-level permission 不一致を修正 |
| `memorag-bedrock-mvp/apps/api/src/contract/chat-run-events-stream.test.ts` | 欠落 permission と admin read-all の回帰テスト |
| `tasks/do/20260507-2013-access-control-audit.md` | 作業 task と受け入れ条件 |
| `reports/working/20260507-2013-access-control-audit.md` | この作業レポート |

## 検証

- `npm ci`: pass
- `./node_modules/.bin/tsx --test apps/api/src/contract/chat-run-events-stream.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass。159 tests pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## ドキュメント更新判断

今回の変更は既存の設計・route policy に実装を合わせる修正であり、公開 API の仕様や必要 permission の変更ではない。そのため README、`docs/`、OpenAPI 例の更新は不要と判断した。

## 指示への fit 評価

総合fit: 4.7 / 5.0（約94%）

理由: 権限境界を調査し、明確な実装不整合を修正し、回帰テストと API 全体テストまで実施した。外部 Cognito 実環境のデプロイ済み設定そのものはリポジトリ外のため未確認であり、npm audit が moderate 1 件を報告した点は今回スコープ外として残した。

## 未対応・制約・リスク

- デプロイ済み AWS 環境の実 authorizer / Cognito group 設定は未確認。リポジトリ内の CDK とテストから確認した。
- `npm ci` 後に npm audit が moderate severity 1 件を報告した。今回の権限バグ修正とは別スコープのため未修正。
- ユーザー停止・再開は現行設計上、管理台帳更新が主で Cognito Admin API の実変更は後続設計扱い。必要なら別タスクで Cognito disable / enable 連動を検討する。
