# 要件定義（1要件1ファイル）

- 要件ID: `NFR-011`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 要件

- NFR-011: Phase 1 の RAG 運用管理 API と Web UI は、文書管理、問い合わせ対応、debug/評価の各操作を Cognito group と role 別 permission で強制的に分離できること。

## 受け入れ条件（この要件専用）

- AC-NFR011-001: API は保護対象 endpoint で bearer token を検証できること。
- AC-NFR011-002: `RAG_GROUP_MANAGER` は文書一覧、文書アップロード、文書削除を実行できること。
- AC-NFR011-003: `RAG_GROUP_MANAGER` は `rag:doc:read` を持つこと。
- AC-NFR011-004: `POST /questions` は `chat:create` を要求すること。
- AC-NFR011-005: `GET /questions` は `answer:edit` を要求すること。
- AC-NFR011-006: `GET /questions/{questionId}` は `answer:edit` を要求すること。
- AC-NFR011-007: `POST /questions/{questionId}/answer` は `answer:publish` を要求すること。
- AC-NFR011-008: `POST /questions/{questionId}/resolve` は `answer:publish` を要求すること。
- AC-NFR011-009: 一般チャット利用者は問い合わせ管理操作を実行できないこと。
- AC-NFR011-010: `ANSWER_EDITOR` はユーザー管理権限なしで問い合わせ一覧を参照できること。
- AC-NFR011-011: Web UI は `CHAT_USER` に対して担当者一覧と debug trace 一覧を事前取得しないこと。
- AC-NFR011-012: local 開発では `AUTH_ENABLED=false` または `VITE_AUTH_MODE=local` により `SYSTEM_ADMIN` 相当の検証セッションを利用できること。
- AC-NFR011-013: local RBAC 検証では `LOCAL_AUTH_GROUPS` で Cognito group 相当の role を指定できること。
- AC-NFR011-014: Phase 1 ではユーザー作成、ユーザー停止、ロール付与、ロール一覧編集、アクセス policy 編集、コスト監査、全ユーザー利用状況一覧を提供しないこと。

## 要件の源泉・背景

- 源泉: Phase 1 管理画面スコープの決定事項 D1-D10、`reports/working/20260502-1140-forbidden-scope-fix.md`、`reports/bugs/20260502-1135-question-escalation-forbidden.md`、`apps/api/src/authorization.ts`。
- 背景: 管理画面を全機能管理者コンソールではなく RAG 運用管理に限定するため、先に API の強制境界を明確化する必要がある。
- 背景: 通常利用者の問い合わせ送信後に権限外の `/questions` と `/debug-runs` を読み込み、不要な 403 が発生したため、UI 事前取得も role に応じて分離する必要がある。

## 要件の目的・意図

- 目的: UI 表示制御だけに依存せず、API 側で誤操作と権限外情報参照を防ぐ。
- 意図: 文書管理、問い合わせ対応、debug/評価を Phase 1 の管理対象として安全に分離する。
- 意図: 利用者のロールに応じて必要なデータだけを読み込み、不要な権限付与と不要な 403 を避ける。
- 意図: サーバー側認可を正とし、Web 側の機能表示制御は UX と不要リクエスト抑制に使う。
- 区分: 非機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `NFR-011` |
| 説明 | Phase 1 RAG 運用管理 API と Web UI の role-based authorization |
| 根拠 | API を唯一の強制境界にする方針 |
| 源泉 | Phase 1 管理画面スコープ決定、403 障害分析 |
| 種類 | 非機能要求 |
| 依存関係 | `authMiddleware`、`requirePermission`、`authorization.ts`、`DES_API_001`、Web の Cognito group 判定 |
| 衝突 | local 開発では検証容易性のため `AUTH_ENABLED=false` と `VITE_AUTH_MODE=local` を維持する |
| 受け入れ基準 | `AC-NFR011-001` から `AC-NFR011-014` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-05-02 初版、同日 conflict 解決で権限境界と UI 事前取得抑制を統合 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 管理 UI 実装前に API 境界を固める必要がある |
| 十分性 | OK | 文書管理、問い合わせ対応、debug/評価の Phase 1 範囲を含む |
| 理解容易性 | OK | API と permission を受け入れ条件に分解している |
| 一貫性 | OK | 既存 RBAC と Cognito group 方針に沿う |
| 標準・契約適合 | OK | 社内資料保護と最小権限の方針に合う |
| 実現可能性 | OK | `app.ts` と `authorization.ts` で実装可能 |
| 検証可能性 | OK | authorization test と API contract test で確認可能 |
| ニーズ適合 | OK | Phase 1 の RAG 運用管理範囲に対応する |

## 関連文書

- `3_設計_DES/41_API_API/DES_API_001.md`
- `docs/GITHUB_ACTIONS_DEPLOY.md`
