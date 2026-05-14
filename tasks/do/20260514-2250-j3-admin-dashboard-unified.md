# J3 admin dashboard unified

- 状態: do
- タスク種別: 機能追加
- 作成日: 2026-05-14
- ブランチ: `codex/phase-j3-admin-dashboard-unified`
- 対象 scope: `docs/spec/gap-phase-j3.md` の `J3-admin-dashboard-unified` 最小 slice

## 背景

Phase J3 gap 調査で、管理ダッシュボード、ユーザー・グループ、ロール・権限、利用状況・コスト、監査ログの現行 UI/API 差分が整理された。後続実装では、既存 API と permission gate を維持しながら、管理 workspace を overview と各管理 section に分け、仕様 10/11/12/13/14 の最小 UI 条件へ近づける。

## 目的

`AdminWorkspace` を overview / users / roles / usage-cost / audit / alias の section または tab で整理し、clickable action と read-only KPI を区別する。Usage/cost/audit は現行 API の read-only 表示を改善し、role assign は保存済み理由を装わず変更前後の差分を表示する。

## Scope

- `apps/web/src/features/admin/components/AdminWorkspace.tsx`
- `apps/web/src/features/admin/components/AdminWorkspace.test.tsx`
- `apps/web/src/features/admin/components/panels/*.tsx`
- 必要な CSS と generated web inventory
- 作業レポート

## Scope-out

- group CRUD / membership hierarchy
- 汎用 audit store / export
- cost export / 実請求 / 異常検知
- role create/update/delete / custom role editor
- benchmark runner / seed / promotion
- debug replay / raw trace export
- 固定 seed / demo fallback
- API route/auth 変更。ただし必要が出た場合は security skill、ACL policy、OpenAPI docs 更新要否を判断する。

## 実装方針

1. 既存 permission gate と `useAdminData` の data loader 条件を維持する。
2. Web 側で既存 props/API データから dashboard view model を作り、権限外 card は表示しない。
3. Action card は button、KPI は read-only article/div で明確に分ける。
4. Usage/cost/audit では未提供・空状態・推定表示を明示し、固定値や demo fallback は入れない。
5. Role assign UI は差分表示を追加し、reason は API 未対応として保存済みのように表示しない。

## 受け入れ条件

- [ ] `AdminWorkspace` が overview / users / roles / usage-cost / audit / alias の sections または tabs として整理されている。
- [ ] Dashboard card model があり、clickable action と read-only KPI が型または構造上区別されている。
- [ ] 既存 permission gate と data loader 条件を弱めず、権限外 card/panel/API load を増やしていない。
- [ ] Usage/cost/audit の read-only 表示が、推定・未提供・空状態を固定値なしで明示している。
- [ ] Role assign UI が変更前後の差分を表示し、理由入力・保存を実装済みのように見せていない。
- [ ] 本番 UI に固定ユーザー、固定グループ、固定容量、固定コスト、demo fallback を追加していない。
- [ ] Web admin tests、web typecheck、`git diff --check` を実行し、結果を記録している。実行できない検証は理由を記録している。
- [ ] Web inventory が変わる場合、`npm run docs:web-inventory` と `npm run docs:web-inventory:check` を実行し、生成差分を commit している。
- [ ] 作業レポートを `reports/working/` に作成し、PR に受け入れ条件確認コメントとセルフレビューコメントを投稿している。

## 検証計画

- `npm run test -w @memorag-mvp/web -- AdminWorkspace useAdminData`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run docs:web-inventory`
- `npm run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- docs と実装の同期
- 変更範囲に見合う Web test / typecheck
- admin permission / data loader 境界の維持
- No Mock Product UI 遵守
- benchmark/debug/alias 境界を弱めていないこと

## リスク

- 管理 UI の構造変更により既存テストのセレクタが変わる可能性がある。
- Web inventory 生成差分が広く出る可能性がある。
- API 追加なしのため、dashboard aggregation、group CRUD、audit/cost export、reason 永続化は後続課題として残る。
