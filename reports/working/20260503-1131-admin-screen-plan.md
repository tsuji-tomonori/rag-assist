# 管理画面実装計画レポート

保存先: `reports/working/20260503-1131-admin-screen-plan.md`

## 1. 受けた指示

- worktree を作成し、新規ブランチで作業する。
- 管理画面で実装できていないものを設計、実装、テストする。
- きりの良いタイミングでテスト確認を行い、git commit と push を行う。
- すべて完了後に GitHub Apps で `main` 向け PR を作成する。
- 最初に実行計画を立て、レポートを作成し、タスク分割してから一気通貫で進める。

## 2. 現状整理

- 作業用 worktree: `.worktrees/admin-screen-completion`
- 作業ブランチ: `feature/admin-screen-completion`
- 既存 `main` には Phase 1 管理導線と Phase 2 のユーザー管理、ロール付与、利用状況、コスト監査の API/UI 契約が入っている。
- 既存レポートでは、Web 管理画面からのユーザー作成、権限変更履歴、停止/再開/削除の監査ログ、誤操作対策が後続課題として残っている。
- 実 Cognito Admin API や AWS Billing/CUR 直結は、本番認証情報、承認フロー、監査設計が必要なため、今回は既存の管理台帳 API 契約に閉じて実装する。

## 3. タスク分割

| ID | タスク | Done 条件 | 検証 |
|---|---|---|---|
| T1 | 管理台帳 API 設計 | ユーザー作成 API と監査ログ API の schema、route、service、RBAC 方針が決まる | API policy test 対象に入る |
| T2 | API 実装 | `/admin/users` 作成、`/admin/audit-log` 一覧、管理操作の監査記録が動く | API contract test |
| T3 | Web 管理画面実装 | 管理画面からユーザー作成、削除確認、操作履歴確認ができる | Web UI test |
| T4 | docs 更新 | FR-027、API/data/HLD/NFR の該当箇所が現行挙動と一致する | docs check または `git diff --check` |
| T5 | 検証・修正 | 変更範囲の typecheck/test/diff check が通る | selected commands pass |
| T6 | commit/push/PR | 日本語 gitmoji commit を作成し push、GitHub Apps で main 向け PR 作成 | PR URL を確認 |

## 4. Done 条件

- 管理画面に未実装だったユーザー作成と管理操作監査ログが実装されている。
- 追加 API は `authMiddleware` と route-level `requirePermission` で保護されている。
- UI は permission に応じて表示され、未権限ユーザーへ操作 UI を出さない。
- ユーザー削除は確認ダイアログを通す。
- 変更に対応するテストとドキュメントが更新されている。
- 最終作業レポートを `reports/working/` に保存している。
- commit、push、GitHub Apps による `main` 向け PR 作成が完了している。

## 5. 検証方針

- Web UI 変更: `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`、`npm --prefix memorag-bedrock-mvp/apps/web run test`
- API route/RBAC/schema 変更: `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`、`npm --prefix memorag-bedrock-mvp/apps/api test`
- docs/report 変更: `git diff --check`
- 必要に応じて headless browser または既存 UI test で管理画面操作を確認する。

## 6. リスクと制約

- Cognito 実ユーザー作成は今回の対象外。管理台帳上のユーザー作成として API/UI 契約を先に固める。
- 実請求データ連携は今回の対象外。既存の概算コスト監査を維持する。
- 権限変更の監査ログは object store の管理台帳 JSON に保存するため、本番では永続 store と保全要件の追加検討が必要。
