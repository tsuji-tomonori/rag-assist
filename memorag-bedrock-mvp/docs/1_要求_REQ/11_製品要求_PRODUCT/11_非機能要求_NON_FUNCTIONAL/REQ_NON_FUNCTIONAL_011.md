# 要件定義（1要件1ファイル）

- 要件ID: `NFR-011`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 要件

- NFR-011: 画面と API は Cognito group に基づく最小権限で機能を利用可能にすること。

## 受け入れ条件（この要件専用）

- AC-NFR011-001: API は保護対象 endpoint で bearer token を検証できること。
- AC-NFR011-002: API は担当者向け問い合わせ管理を `answer:edit` 権限で制御できること。
- AC-NFR011-003: Web UI は `CHAT_USER` に対して担当者一覧と debug trace 一覧を事前取得しないこと。
- AC-NFR011-004: local 開発では `AUTH_ENABLED=false` または `VITE_AUTH_MODE=local` により `SYSTEM_ADMIN` 相当の検証セッションを利用できること。

## 要件の源泉・背景

- 源泉: `reports/working/20260502-1140-forbidden-scope-fix.md`、`reports/bugs/20260502-1135-question-escalation-forbidden.md`、`apps/api/src/authorization.ts`。
- 背景: 通常利用者の問い合わせ送信後に権限外の `/questions` と `/debug-runs` を読み込み、不要な 403 が発生したため。

## 要件の目的・意図

- 意図: 利用者のロールに応じて必要なデータだけを読み込み、不要な権限付与と不要な 403 を避ける。
- 意図: サーバー側認可を正とし、Web 側の機能表示制御は UX と不要リクエスト抑制に使う。

## 関連文書

- `3_設計_DES/41_API_API/DES_API_001.md`
- `docs/GITHUB_ACTIONS_DEPLOY.md`
