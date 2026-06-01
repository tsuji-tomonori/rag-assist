# 管理画面の group 管理・audit/cost export・品質 Action card を補完する

保存先: `tasks/todo/20260516-1618-admin-group-audit-quality-ops.md`

## 状態

- todo

## タスク種別

- 機能追加

## 背景

Phase J3 で admin dashboard の統合表示は進んだが、仕様 10/11/13/14 の一部として、グループ CRUD/membership 階層、品質/解析 Action card、dashboard aggregation API、audit/cost export は後続課題として残っている。

## 目的

管理者がユーザー・グループ・品質/解析アクション・監査/コスト export を実データに基づいて扱えるようにし、未実装値を固定件数や demo fallback で表示しない管理運用 UI/API を追加する。

## 対象範囲

- `apps/api/src/routes/admin-routes.ts`
- user/group directory adapter
- `apps/web/src/features/admin/`
- audit/cost export route
- access-control policy / OpenAPI docs

## 実行計画

1. department/project/team/admin/folderPolicy/system/custom group の初期対応範囲を決める。
2. membership full/readOnly、親子関係、循環禁止、影響 folder/document 数を扱う。
3. quality/extraction metadata から Action card を生成し、架空件数を表示しない。
4. audit/cost export は signed URL、権限、audit 記録を伴う形で実装する。
5. dashboard aggregation API を追加する場合は permission 別に返却 field を制限する。

## 受け入れ条件

- group CRUD/membership は管理権限で保護され、循環参照を拒否する。
- folderPolicy/system group など通常利用者に出すべきでない group は UI で制御される。
- quality/analysis Action card は実データ由来で、未実装値を固定件数で埋めない。
- audit/cost export は権限、signed URL、audit log、期限を持つ。
- API route 追加時は OpenAPI docs と `access-control-policy.test.ts` が更新される。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts`
- `npm run test -w @memorag-mvp/api -- src/authorization.test.ts`
- `npm run test -w @memorag-mvp/web`
- `npm run docs:openapi:check`
- `git diff --check`

## PRレビュー観点

- 管理画面が権限外 API loader を呼んでいないか。
- export に機微情報や署名付き URL を過剰保持していないか。
- quality/analysis count が実データに基づいているか。

## 関連

- `docs/spec/gap-phase-j3.md`
- `tasks/done/20260514-2250-j3-admin-dashboard-unified.md`
