# CloudFront単一入口構成の正式方針化

- 状態: done
- タスク種別: ドキュメント更新
- 作成日: 2026-05-22

## 背景

ユーザーから、CORS調整を主目的にするのではなく、CloudFrontをブラウザ公開入口として統一し、SPA、REST API、WebSocket APIを同一originの相対パスで扱う方針が提示された。

## 目的

CloudFront単一入口構成を、後続の実装・検証・PRレビューで参照できる正式なリポジトリ文書として記録する。

## 範囲

- `docs/` にCloudFront単一入口構成のアーキテクチャ決定を追加する。
- `docs/` に本番CORS最小化、相対パス、OAC、REST/WebSocket経路、認証認可、短命ticket方式を検証可能な技術制約として追加する。
- 作業完了レポートを `reports/working/` に残す。

## 対象外

- CDK、API middleware、WebSocket ticket発行、Cognito Hosted UI連携の実装。
- 実AWS環境でのCloudFront、S3、API Gateway、Cognito、DynamoDB動作確認。

## 計画

1. 既存のSWEBOK-lite文書構成と採番を確認する。
2. アーキテクチャ決定文書を追加する。
3. 技術制約文書を追加する。
4. Markdown差分と末尾空白を検証する。
5. 作業レポート、commit、push、PR、受け入れ条件コメントまで進める。

## ドキュメント保守方針

新規docsは `docs/DOCS_STRUCTURE.md` に従い、アーキテクチャ決定と要件を混在させない。要件側は1要件1ファイルとし、受け入れ条件を同一ファイルに記載する。

## 受け入れ条件

- AC-001: CloudFrontを唯一の公開入口とし、SPA、REST API、WebSocket APIを同一originの相対パスで扱う方針が `docs/` に記録されている。
- AC-002: 本番APIで `Access-Control-Allow-Origin: *` を許可しない方針と、local/dev/previewだけallowlistを使う方針が記録されている。
- AC-003: S3 SPA bucketはprivate bucket + CloudFront OAC経由とし、S3 website endpointを使わない方針が記録されている。
- AC-004: `/api/*` と `/ws/*` のCloudFront behavior、prefix削除、RESTの `AllViewerExceptHostHeader`、WebSocket upgrade/query転送の方針が記録されている。
- AC-005: Cognito Hosted UI + Authorization Code + PKCE、Cognito authorizer、application middlewareによる業務認可順序が記録されている。
- AC-006: WebSocket接続は短命ticket + `$connect` Lambda authorizerで扱う方針が記録されている。
- AC-007: ユーザー提示の完了条件を、後続実装で検証可能な受け入れ条件として整理している。
- AC-008: `git diff --check` がpassしている。

## 検証計画

- `git diff --check`
- 変更Markdownの目視確認
- 可能であれば `pre-commit run --files <changed-files>`

## PRレビュー観点

- docsと実装予定の責務分離が明確であること。
- 本番CORSを広げる設計になっていないこと。
- RAGの権限境界と根拠性を弱めていないこと。
- 実施していないAWS環境検証を実施済みと書いていないこと。

## PRレビュー対応

- hidden / bidirectional Unicode制御文字検出を `scripts/check-hidden-unicode.mjs` とpre-commit hookへ追加した。
- `/ws/*` behaviorでviewer `Host` をAPI Gateway WebSocket originへ転送しない方針をADRとTC-003へ追記した。
- TC-003がDraftである理由と、Accepted / Verified相当へ昇格する条件を追記した。
- `design TBD` の追跡先として `tasks/todo/20260522-2120-cloudfront-single-entry-implementation.md` を追加した。

## リスク

- 本タスクは方針文書化であり、実AWS構成とアプリケーション実装は後続PRで別途必要になる。
- PR #335 作成後、受け入れ条件コメントとセルフレビューコメントをGitHub Appsで投稿済み。
