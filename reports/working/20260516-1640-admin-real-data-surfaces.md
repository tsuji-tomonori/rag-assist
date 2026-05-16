# 作業完了レポート

保存先: `reports/working/20260516-1640-admin-real-data-surfaces.md`

## 1. 受けた指示

- Worker C として `/home/t-tsuji/project/rag-assist/.worktrees/full-spec-gap-implementation` の `codex/full-spec-gap-implementation` branch で作業する。
- 編集範囲は Web admin feature の `apps/web/src/features/admin/**` と同配下テストに限定する。
- `apps/api`、schemas、authorization、docs、generated docs、package files は編集しない。
- Admin quality / action-card / group / export surface は、API が実データを提供する場合だけ表示する。
- fake groups、counts、costs、export URLs を表示しない。
- API fields が欠落する場合は unavailable / empty state を正直に表示し、非機能 controls を出さない。
- focused web tests を追加・更新する。
- commit は行わない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | API field 欠落時に fake data を表示しない | 高 | 対応 |
| R2 | group/role 欠落時に `CHAT_USER` fallback を送信しない | 高 | 対応 |
| R3 | 非機能 action/export controls を表示しない | 高 | 対応 |
| R4 | focused web tests を追加・更新する | 高 | 対応 |
| R5 | 指定 ownership 外を編集しない | 高 | 概ね対応。task/report はリポジトリルールに従い作成 |
| R6 | commit しない | 高 | 対応 |

## 3. 検討・判断したこと

- Admin API wrapper が欠落 list field を `[]` に変換しており、未提供と提供された空配列を UI が区別できないため、`null` を未提供として扱う方針にした。
- `CHAT_USER` の既定値は API 由来の role/group ではないため、roles field 未提供時は group を送信せず、role assign control も出さない方針にした。
- Alias publish は承認済み alias がない場合に実質的な対象がないため、button 自体を表示しない方針にした。
- Docs はユーザー指定で編集しない。作業記録は task md とこの report に限定した。

## 4. 実施した作業

- `apps/web/src/features/admin/api/*` の list 系 API wrapper を、該当 field 欠落時に `null` を返すよう更新した。
- `costApi` は cost summary の必須 field が欠ける場合に `null` を返すようにした。
- `useAdminData` と `AdminWorkspace` / panels の型と表示を `null` aware に更新した。
- Overview の action card は count が `null` の場合に表示しないようにした。
- User panel は roles 未提供時に role select / assign を表示せず、user create でも `groups: undefined` を送るようにした。
- Alias panel は aliases / auditLog 未提供状態を表示し、承認済み alias がある場合だけ publish control を表示するようにした。
- Focused tests を追加・更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/web/src/features/admin/api/*.ts` | TypeScript | 欠落 API field を `null` として扱う API wrapper | R1 |
| `apps/web/src/features/admin/components/**` | TSX | unavailable / empty state と非機能 control 非表示 | R1, R2, R3 |
| `apps/web/src/features/admin/hooks/useAdminData.ts` | TypeScript | `null` 状態を保持する admin data hook | R1 |
| `apps/web/src/features/admin/**/*.test.ts*` | Test | 欠落 field、fake group 防止、publish control 表示条件の検証 | R4 |
| `tasks/done/20260516-1631-admin-real-data-surfaces.md` | Markdown | 受け入れ条件と検証結果 | リポジトリルール |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | UI/API wrapper/test の範囲で fake fallback と非機能 controls を抑制した |
| 制約遵守 | 4 | Web admin feature 外の docs/package/API 本体は編集していない。task/report はリポジトリルールのため追加 |
| 成果物品質 | 5 | 未提供と空状態を分離し、focused tests と typecheck を通した |
| 説明責任 | 5 | 未実施の commit/PR と初回 test filter 失敗を明記した |
| 検収容易性 | 5 | 変更ファイルと検証コマンドを明示できる状態にした |

総合fit: 4.8 / 5.0（約96%）

## 7. 実行した検証

- `npm run test -w @memorag-mvp/web -- apps/web/src/features/admin`: fail。workspace 相対 path ではなく repository 相対 path を渡したため、test file が見つからなかった。
- `npm run test -w @memorag-mvp/web -- src/features/admin`: pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `git diff --check`: pass。

## 8. 未対応・制約・リスク

- commit / push / PR 作成はユーザー指示 `Do not commit` に従い未実施。
- `apps/web/src/app/hooks/useAppShellState.ts` は ownership 外のため編集していない。現状の caller は count を number として渡すため、overview action-card の `null` gating は今後 API 未提供を渡す caller が現れた場合に効く。
- リポジトリには作業開始前から Worker C 範囲外の変更が存在していたため、触れずに残している。
