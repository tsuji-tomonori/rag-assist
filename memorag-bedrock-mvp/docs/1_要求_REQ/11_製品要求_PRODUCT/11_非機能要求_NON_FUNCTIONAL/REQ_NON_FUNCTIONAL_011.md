# 要件定義（1要件1ファイル）

- 要件ID: `NFR-011`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 要件

- NFR-011: Phase 1/2 の管理 API と Web UI は、文書管理、問い合わせ対応、debug/評価、性能テスト、ユーザー管理、ロール付与、利用状況、コスト監査の各操作を Cognito group と role 別 permission で強制的に分離できること。

## 受け入れ条件（この要件専用）

- AC-NFR011-001: API は保護対象 endpoint で bearer token を検証できること。
- AC-NFR011-002: `RAG_GROUP_MANAGER` は文書一覧、文書アップロード、文書削除を実行できること。
- AC-NFR011-003: `RAG_GROUP_MANAGER` は `rag:doc:read` を持つこと。
- AC-NFR011-004: `POST /questions` は `chat:create` を要求すること。
- AC-NFR011-005: `GET /questions` は `answer:edit` を要求すること。
- AC-NFR011-006: `GET /questions/{questionId}` は `answer:edit` を要求し、問い合わせ作成者本人の場合のみ内部メモを除いた詳細取得を許可し、非担当者・非作成者には ticket 存在有無を識別させないこと。
- AC-NFR011-007: `POST /questions/{questionId}/answer` は `answer:publish` を要求すること。
- AC-NFR011-008: `POST /questions/{questionId}/resolve` は `answer:publish` を要求し、問い合わせ作成者本人の場合のみ回答済みの自身の ticket の解決済み化を許可し、非担当者・非作成者には ticket 存在有無を識別させないこと。
- AC-NFR011-009: 一般チャット利用者は問い合わせ管理操作を実行できないこと。
- AC-NFR011-010: `ANSWER_EDITOR` はユーザー管理権限なしで問い合わせ一覧を参照できること。
- AC-NFR011-011: Web UI は `CHAT_USER` に対して担当者一覧と debug trace 一覧を事前取得しないこと。
- AC-NFR011-012: local 開発では `AUTH_ENABLED=false` または `VITE_AUTH_MODE=local` により `SYSTEM_ADMIN` 相当の検証セッションを利用できること。
- AC-NFR011-013: local RBAC 検証では `LOCAL_AUTH_GROUPS` で Cognito group 相当の role を指定できること。
- AC-NFR011-014: Phase 1 では管理者向けのユーザー停止、Web UI/API によるロール付与、ロール一覧編集、アクセス policy 編集、コスト監査、全ユーザー利用状況一覧を提供しないこと。
- AC-NFR011-015: 保護対象 API route は静的 policy test により `authMiddleware` と route-level permission の対応が検証されること。
- AC-NFR011-016: `GET /me` は認証済みユーザーの `groups` と role から算出した `permissions` を返すこと。
- AC-NFR011-017: フロントエンドの Phase 1 管理導線は JWT payload を直接解釈せず、`GET /me` の `permissions` に基づいて表示されること。
- AC-NFR011-018: `documents` view の表示は文書管理 permission に基づいて制御されること。
- AC-NFR011-019: `admin` view の Phase 1 導線は文書管理、問い合わせ対応、debug/評価、性能テストの permission に基づいて制御されること。
- AC-NFR011-020: チャット上部には文書削除操作を表示せず、削除は文書管理導線に集約すること。
- AC-NFR011-021: `POST /admin/users` は `user:create` を要求すること。
- AC-NFR011-022: `GET /admin/users` は `user:read` を要求すること。
- AC-NFR011-023: `GET /admin/audit-log` は `access:policy:read` を要求すること。
- AC-NFR011-024: `/admin/users/{userId}/roles` は `access:role:assign` を要求すること。
- AC-NFR011-025: `/admin/usage` は `usage:read:all_users` を要求すること。
- AC-NFR011-026: `/admin/costs` は `cost:read:all` を要求すること。
- AC-NFR011-027: `admin` view の Phase 2 導線はユーザー作成、ユーザー管理、ロール、管理操作履歴、利用状況、コスト監査の permission に基づいて制御されること。
- AC-NFR011-028: `GET /me` は静的 policy test で認証必須かつ追加 role permission なしの route として検証されること。
- AC-NFR011-029: `POST /benchmark/query` は `benchmark:query` を要求し、`RAG_GROUP_MANAGER` による管理画面の benchmark run 起動権限 `benchmark:run` と分離されること。
- AC-NFR011-030: `POST /benchmark/search` は `benchmark:query` を要求し、`BENCHMARK_RUNNER` が通常利用者向け `POST /search` を直接実行できないことを contract test で検証すること。

## 要件の源泉・背景

- 源泉: Phase 1 管理画面スコープの決定事項 D1-D10、`reports/working/20260502-1140-forbidden-scope-fix.md`、`reports/bugs/20260502-1135-question-escalation-forbidden.md`、`apps/api/src/authorization.ts`。
- 背景: 管理画面を全機能管理者コンソールではなく RAG 運用管理に限定するため、先に API の強制境界を明確化する必要がある。
- 背景: 通常利用者の問い合わせ送信後に権限外の `/questions` と `/debug-runs` を読み込み、不要な 403 が発生したため、UI 事前取得も role に応じて分離する必要がある。

## 要件の目的・意図

- 目的: UI 表示制御だけに依存せず、API 側で誤操作と権限外情報参照を防ぐ。
- 意図: 文書管理、問い合わせ対応、debug/評価、性能テスト、ユーザー管理、ロール付与、利用状況、コスト監査を安全に分離する。
- 意図: 利用者のロールに応じて必要なデータだけを読み込み、不要な権限付与と不要な 403 を避ける。
- 意図: サーバー側認可を正とし、Web 側の機能表示制御は UX と不要リクエスト抑制に使う。
- 区分: 非機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `NFR-011` |
| 説明 | Phase 1/2 管理 API と Web UI の role-based authorization |
| 根拠 | API を唯一の強制境界にする方針 |
| 源泉 | Phase 1 管理画面スコープ決定、403 障害分析 |
| 種類 | 非機能要求 |
| 依存関係 | `authMiddleware`、`requirePermission`、`authorization.ts`、`GET /me`、`FR-024`、`FR-025`、`FR-027`、`DES_API_001` |
| 衝突 | local 開発では検証容易性のため `AUTH_ENABLED=false` と `VITE_AUTH_MODE=local` を維持する |
| 受け入れ基準 | `AC-NFR011-001` から `AC-NFR011-030` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-05-02 初版、同日 conflict 解決で権限境界、UI 事前取得抑制、静的 policy test を統合、同日 Phase 1 管理画面導線と self sign-up 最小権限を `FR-024` / `FR-025` として分離、2026-05-03 Phase 2 のユーザー作成と管理操作履歴を追加、2026-05-04 問い合わせ作成者本人の詳細取得と解決済み化を追加、同日 `/me` 静的保護確認と benchmark query 権限分離を追加、同日 search benchmark runner の通常検索境界分離を追加 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 管理 UI 実装前に API 境界を固める必要がある |
| 十分性 | OK | 文書管理、問い合わせ対応、debug/評価の Phase 1 範囲を含む |
| 理解容易性 | OK | API と permission を受け入れ条件に分解している |
| 一貫性 | OK | 既存 RBAC と Cognito group 方針に沿う |
| 標準・契約適合 | OK | 社内資料保護と最小権限の方針に合う |
| 実現可能性 | OK | `app.ts` と `authorization.ts` で実装可能 |
| 検証可能性 | OK | authorization test、API contract test、access-control-policy test で確認可能 |
| ニーズ適合 | OK | Phase 1 の RAG 運用管理範囲に対応する |

## 関連文書

- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/02_Phase_1_RAG運用管理/REQ_FUNCTIONAL_024.md`
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/01_通常利用者セルフサインアップ/REQ_FUNCTIONAL_025.md`
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/03_Phase_2_管理・監査/REQ_FUNCTIONAL_027.md`
- `3_設計_DES/41_API_API/DES_API_001.md`
- `docs/GITHUB_ACTIONS_DEPLOY.md`
