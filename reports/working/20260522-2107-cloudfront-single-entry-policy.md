# CloudFront単一入口構成の正式方針化 作業レポート

- 作成日: 2026-05-22
- 対象タスク: `tasks/done/20260522-2107-cloudfront-single-entry-policy.md`
- タスク種別: ドキュメント更新

## 受けた指示

CloudFrontを唯一の本番公開入口として正式採用し、SPA、REST API、WebSocket APIを同一originの相対パスで扱う方針を進める。CORSは本番で広く許可するのではなく、same-origin化により最小化する。S3 OAC、CloudFront behavior、Cognito + PKCE、application middleware認可、WebSocket短命ticket、direct origin access防御、移行順、完了条件を明文化する。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | CloudFront単一入口構成を正式方針として記録する | 対応 |
| R2 | 本番CORS wildcard禁止とdev系allowlist方針を記録する | 対応 |
| R3 | S3 private bucket + OAC、S3 website endpoint不使用を記録する | 対応 |
| R4 | `/api/*`、`/ws/*` behaviorとprefix削除方針を記録する | 対応 |
| R5 | Cognito認証とapplication middleware認可を分けて記録する | 対応 |
| R6 | WebSocket短命ticket方式を記録する | 対応 |
| R7 | 後続実装で検証可能な受け入れ条件を整理する | 対応 |

## 検討・判断の要約

- 方針決定は `ARC_ADR_005` として記録し、要件は `REQ_TECHNICAL_CONSTRAINT_003` として分離した。
- `docs/DOCS_STRUCTURE.md` の「要件とアーキテクチャを混在させない」方針に従った。
- ユーザー提示の完了条件は、後続実装で検証できる受け入れ条件として `AC-TC003-001` から `AC-TC003-035` に整理した。
- 本タスクではAWS実環境やアプリケーションコードは変更せず、実施していないインフラ検証を完了扱いにしていない。

## 実施作業

- 専用worktree `codex/cloudfront-single-entry` を `origin/main` から作成した。
- `tasks/do/20260522-2107-cloudfront-single-entry-policy.md` を作成した。
- `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md` を追加した。
- `docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/01_技術制約_TECHNICAL_CONSTRAINT/REQ_TECHNICAL_CONSTRAINT_003.md` を追加した。
- `docs/ARCHITECTURE.md`、`docs/REQUIREMENTS.md`、`docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md` の索引・トレーサビリティを更新した。
- PR #335 を作成し、受け入れ条件確認コメントとセルフレビューコメントをGitHub Appsで投稿した。
- PRコメント後にtask mdを `tasks/done/` へ移動した。
- PRレビューのBlocker 2件に対応し、hidden Unicode制御文字検出とWebSocket behaviorのHost header方針を追加した。
- Minor指摘に対応し、TC-003のDraft理由・昇格条件と、TC-003の後続実装追跡タスクを追加した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md` | CloudFront単一入口構成のADR |
| `docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/01_技術制約_TECHNICAL_CONSTRAINT/REQ_TECHNICAL_CONSTRAINT_003.md` | CloudFront単一入口と本番CORS最小化の技術制約 |
| `docs/ARCHITECTURE.md` | ADR索引とASR対応の更新 |
| `docs/REQUIREMENTS.md` | TC-003索引とトレーサビリティの更新 |
| `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md` | 変更管理トレーサビリティの更新 |
| `tasks/done/20260522-2107-cloudfront-single-entry-policy.md` | 完了済み作業task md |
| `tasks/todo/20260522-2120-cloudfront-single-entry-implementation.md` | TC-003後続実装の追跡task md |
| `scripts/check-hidden-unicode.mjs` | hidden / bidirectional Unicode制御文字検出スクリプト |

## 検証

### 実行した検証

- `git diff --check`: pass
- `pre-commit run --files docs/ARCHITECTURE.md docs/REQUIREMENTS.md docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/01_技術制約_TECHNICAL_CONSTRAINT/REQ_TECHNICAL_CONSTRAINT_003.md tasks/done/20260522-2107-cloudfront-single-entry-policy.md reports/working/20260522-2107-cloudfront-single-entry-policy.md`: pass
- `node` inline hidden/bidirectional Unicode control character check for review-specified files: pass
- `npm run docs:hidden-unicode:check`: pass
- `node --check scripts/check-hidden-unicode.mjs`: pass
- `pre-commit run --files .pre-commit-config.yaml package.json scripts/check-hidden-unicode.mjs docs/ARCHITECTURE.md docs/REQUIREMENTS.md docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/01_技術制約_TECHNICAL_CONSTRAINT/REQ_TECHNICAL_CONSTRAINT_003.md tasks/todo/20260522-2120-cloudfront-single-entry-implementation.md tasks/done/20260522-2107-cloudfront-single-entry-policy.md reports/working/20260522-2107-cloudfront-single-entry-policy.md`: pass

### 未実施・制約

- AWS実環境でのCloudFront、S3、API Gateway、Cognito、WebSocket接続確認: 未実施。理由: 本タスクは方針文書化であり、インフラ実装を含まないため。
- API middleware、SPA相対パス化、WebSocket ticket実装のテスト: 未実施。理由: 本タスクではコード実装を含まないため。
- `./node_modules/.bin/eslint scripts/check-hidden-unicode.mjs --max-warnings=0`: 未実施。理由: このworktreeに `node_modules` がなく、実行ファイルが存在しなかったため。代替として `node --check` とpre-commitを実行した。

## PR

- PR: `https://github.com/tsuji-tomonori/rag-assist/pull/335`
- PR作成: `gh pr create` を使用。理由: GitHub Appsの利用可能ツールにPR作成ツールが見つからなかったため。
- PRコメント: GitHub Appsで受け入れ条件確認コメントとセルフレビューコメントを投稿済み。
- CI確認: `gh pr checks 335` を実行し、`validate-semver-label` pass、`Lint, type-check, test, build, and synth` pendingを確認した。

## Fit評価

総合fit: 4.7 / 5.0（約94%）

理由: ユーザー提示方針の主要要素をADRと技術制約に分離して正式文書化し、受け入れ条件も検証可能な粒度へ整理した。一方で、実AWS構成とアプリケーション実装は後続タスクの範囲であり、本タスクでは未検証のため満点ではない。

## 未対応・リスク

- CloudFront behavior、OAC、API Gateway origin、Cognito callback、WebSocket authorizer、DynamoDB connection tableは未実装。
- 既存SPAやAPIにdirect origin設定が残っているかのコード調査は、後続のPhase 1実装タスクで行う必要がある。
- 後続PRでは、実インフラ・アプリケーション実装時に `TC-003` の各受け入れ条件を実環境または自動テストで検証する必要がある。
