# 要件定義（1要件1ファイル）

- 要件ID: `FR-027`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 要件

- FR-027: システム管理者は Phase 2 の管理画面から、ユーザー作成、ユーザー管理、ロール付与、管理操作履歴、全ユーザー利用状況一覧、コスト監査を permission に応じて実行または参照できること。

## 受け入れ条件（この要件専用）

- AC-FR027-001: `user:create` を持つ利用者は管理画面から管理対象ユーザーを作成できること。
- AC-FR027-002: `user:read` を持つ利用者は管理画面で管理対象ユーザー一覧を参照できること。
- AC-FR027-003: `user:suspend` を持つ利用者は管理対象ユーザーを停止できること。
- AC-FR027-004: `user:unsuspend` を持つ利用者は停止中の管理対象ユーザーを再開できること。
- AC-FR027-005: `user:delete` を持つ利用者は確認操作後に管理対象ユーザーを管理台帳から削除状態にできること。
- AC-FR027-006: `access:policy:read` を持つ利用者はロールと permission の対応を参照できること。
- AC-FR027-007: `access:role:assign` を持つ利用者は管理対象ユーザーへ role group を付与できること。
- AC-FR027-008: `access:policy:read` を持つ利用者は管理画面で管理操作履歴を参照できること。
- AC-FR027-009: `usage:read:all_users` を持つ利用者は全ユーザー利用状況一覧を参照できること。
- AC-FR027-010: `cost:read:all` を持つ利用者は service/component 別の概算コスト監査情報を参照できること。
- AC-FR027-011: Phase 2 管理 API は UI 表示制御だけに依存せず、route ごとに `requirePermission` で保護されること。

## 要件の源泉・背景

- 源泉: Phase 1 で対象外にしたユーザー管理、ロール付与、コスト監査、全ユーザー利用状況一覧。
- 背景: 既存 RBAC には `USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR` と関連 permission が定義済みだった。
- 背景: Phase 1 では Cognito Admin API、監査ログ、権限変更履歴、誤操作対策が必要なため管理 UI から外していた。
- 背景: Phase 2 の初期実装では本番 Cognito 直接変更ではなく、管理台帳 API と permission 境界を先に成立させる。

## 要件の目的・意図

- 目的: 管理者が権限に応じてユーザー、ロール、管理操作履歴、利用状況、コストを同一管理画面で確認できるようにする。
- 意図: 実際の Cognito 管理連携や監査ログの強化を後続 adapter に分離し、UI/API contract を先に安定させる。
- 意図: コスト監査は AWS 請求の正本ではなく、運用判断のための概算として明示する。
- 区分: 機能要求。

## 関連文書

- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_011.md`
- `3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- `3_設計_DES/41_API_API/DES_API_001.md`
