# 権限周りバグ調査

- 状態: done
- 作成日時: 2026-05-07 20:13 JST
- ブランチ: `codex/access-control-audit`

## 背景

ユーザーから「権限周りにおいてバグがないか調査して」と依頼された。API route、middleware、RBAC、所有者境界、store 操作、schema、外部公開設定を確認し、権限漏れや過剰公開の有無を調査する。

## 目的

権限境界のバグ候補を根拠付きで洗い出し、再現性・影響・修正方針を整理する。修正可能な明確なバグが見つかった場合は、最小修正と回帰テスト追加まで行う。

## スコープ

- `memorag-bedrock-mvp` の API route、middleware、認可 helper、security tests。
- user、role、question、chat、document、benchmark などの権限境界に関わる service/store。
- response schema、OpenAPI、環境変数、外部公開設定。
- ドキュメント更新要否と検証コマンド選定。

## 計画

1. route、middleware、permission 定義、既存 security test を確認する。
2. service/store の `list`、`get`、`update`、`delete`、`scan` が caller scope を維持しているか確認する。
3. 機微フィールドを返す route と public/local auth 設定を確認する。
4. バグ候補を分類し、必要なら最小修正とテスト追加を行う。
5. 関連テストを実行し、結果を作業レポートに残す。

## ドキュメント保守方針

挙動変更や運用手順変更が発生した場合は README、`docs/`、`memorag-bedrock-mvp/docs/`、OpenAPI 例の更新要否を確認する。調査のみで仕様変更がない場合は、作業レポートに「更新不要」と明記する。

## 受け入れ条件

- API route と認証・認可境界の対応関係を確認している。
- 所有者・担当者境界が必要な service/store 操作を確認している。
- 機微フィールド返却と public endpoint / local auth 設定のリスクを確認している。
- バグが見つかった場合、影響・原因・修正・回帰テストを提示または実装している。
- 実行した検証と未実施検証を正直に記録している。
- 作業完了レポートを `reports/working/` に残している。

## 検証計画

- `git diff --check`
- API 変更がある場合: `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- 調査のみの場合: 関連ファイルの静的確認と、必要に応じた対象テスト確認

## PR レビュー観点

- docs と実装の同期。
- 変更範囲に見合うテスト。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと。

## リスク

- 静的調査だけでは runtime 環境変数やデプロイ済み authorizer の実態を完全には確認できない。
- 外部 IDP / Cognito の実設定はリポジトリ外のため、IaC または設定ファイルから確認できる範囲に限られる。

## 完了結果

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/156
- 受け入れ条件確認コメント: 追加済み。
- セルフレビューコメント: 追加済み。
- 主な修正: `GET /chat-runs/{runId}/events` の専用 streaming Lambda で `chat:read:own` または `chat:admin:read_all` を要求するよう修正。
- 検証: `npm ci`、targeted streaming test、API typecheck、API 全体 test、`git diff --check` が pass。
