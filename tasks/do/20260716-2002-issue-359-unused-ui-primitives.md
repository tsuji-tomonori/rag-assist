# Issue #359 未使用 UI primitive の根拠付き削除

- 状態: do
- タスク種別: 修正
- 対象 issue: #359 Phase 1c
- 作業ブランチ: `codex/issue-359-unused-ui-primitives`
- 起点: `origin/main` (`e12abb07`)

## 受けた指示

未使用と確認できる Web 共通 UI primitive のみを削除し、同じパスまたは参照が再導入された場合に失敗する guard を追加する。`Badge` は `StatusBadge` から使用されているため削除しない。Web とリポジトリ全体の検証、生成 Web docs の同期、PR の競合確認、GitHub Apps を優先した PR 作成、受け入れ条件コメント、セルフレビュー、完了レポートまで実施する。

## なぜなぜ分析 / RCA

### 現象

`apps/web/src/shared/ui/IconButton.tsx` と `apps/web/src/shared/ui/Panel.tsx` が共通 primitive として残り、barrel export と生成 Web inventory に掲載されているが、製品 UI・テスト・E2E・ツールから利用されていない。

### なぜ 1: なぜ未使用ファイルが残ったか

共通 UI の初期整備時に作られた primitive が、利用箇所の移行または廃止後も削除されなかったため。

### なぜ 2: なぜ未使用状態を検知できなかったか

typecheck / build は未使用の export とファイルを許容し、現在の semantic UI test に廃止 primitive の不在を確認する契約がなかったため。

### なぜ 3: なぜ生成 docs にも残ったか

生成 inventory はソースファイルの存在を正しく列挙するため、未使用判定を行わず、残存ファイルを有効な UI 構成要素として反映していたため。

### 根本原因

共通 UI primitive の廃止時に、参照ゼロの証跡、barrel export の削除、生成 inventory の同期、再導入防止 guard を一体で完了条件にする契約が不足していた。

### 恒久対策

参照ゼロを確認した `IconButton` / `Panel` のファイルと export を削除し、semantic UI contract test に「削除済みパスが存在しない」「barrel export と Web ソースに廃止 primitive 参照がない」「利用中の `Badge` / `StatusBadge` は保持される」という guard を追加する。生成 inventory はソース変更後に再生成して freshness check を通す。

## 事前証跡

| 観点 | `IconButton` | `Panel` | `Badge` |
| --- | --- | --- | --- |
| JSX 利用 | 0 件 | 0 件 | `StatusBadge.tsx` 内で利用 |
| static import | 0 件 | 0 件 | `StatusBadge.tsx` が import |
| dynamic import / パス文字列 | 0 件 | 0 件 | 対象外 |
| barrel export | `shared/ui/index.ts` のみ | `shared/ui/index.ts` のみ | `shared/ui/index.ts` から公開 |
| 生成 docs | `web-components.md`、`web-features/shared.md`、`web-accessibility.md`、`web-ui-inventory.json` に掲載 | `web-components.md`、`web-features/shared.md`、`web-ui-inventory.json` に掲載 | `Badge` / `StatusBadge` として掲載 |
| 判定 | 削除可能 | 削除可能 | 削除不可、保持 |

検索対象は `.github/`、`apps/`、`packages/`、`scripts/`、`tools/`、`skills/`、`docs/` とし、定義ファイル自身、履歴目的の `tasks/` / `reports/`、生成 docs は利用判定から分離した。`IconButton` / 共通 `Panel` の完全一致名、`shared/ui/IconButton` / `shared/ui/Panel`、`.js` / `.jsx` / `.ts` / `.tsx` パス、dynamic import を確認した。

## 競合・並行作業確認

- PR #361: `.github/workflows/web-ui-quality.yml`、`Taskfile.yml`、Web quality 設定・E2E・CSS・仕様 docs が中心で、`apps/web/src/shared/ui/{IconButton,Panel,index}.tsx` と `tools/web-inventory/semantic-ui-contract.test.mjs` は対象外。
- root shim 作業 `codex/issue-359-web-root-shims`: 事前確認時点で差分なし。共通 UI primitive と生成 Web docs を変更しない想定。
- PR #338: chat / API / Web docs を含み、生成 Web docs の一部が重複する。生成物は現行 `origin/main` と本 PR のソースから再生成し、競合時は generator による再生成で解消する。製品ソースの対象ファイルは重複しない。

## 作業範囲

- `IconButton.tsx` / `Panel.tsx` と barrel export の削除
- semantic UI contract の再導入防止 guard
- 影響する生成 Web inventory / docs の同期
- task / 作業完了レポート

## 対象外

- `Badge` / `StatusBadge` の削除・挙動変更
- 製品 UI の表示、操作、アクセシビリティ、API、認可境界の変更
- PR #361、PR #338、root shim 作業の変更取り込み
- merge / deploy / release

## 受け入れ条件

- [ ] JSX / import / dynamic import / export / パス参照がゼロである証跡に基づき、`IconButton.tsx` と `Panel.tsx` が削除されている。
- [ ] `apps/web/src/shared/ui/index.ts` から `IconButton` / `Panel` export が削除されている。
- [ ] `Badge.tsx` と `StatusBadge.tsx` および両者の依存関係が保持されている。
- [ ] 削除済みパス、barrel export、Web ソース参照の再導入を検知する guard があり、既存の semantic UI 検証経路で実行される。
- [ ] 製品 UI の表示・操作・アクセシビリティ・実データ由来の状態に変更がない。
- [ ] 生成 Web inventory / docs が現行ソースと同期し freshness check が成功する。
- [ ] Web の targeted test、full coverage、typecheck、build が成功する。
- [ ] `npm run ci` が成功する。
- [ ] `npm run docs:web-inventory:check`、`npm run docs:web-trace:test`、`npm run test:web-semantic-ui` が成功する。
- [ ] PR #361、root shim 作業、PR #338 との重複・競合リスクを PR 本文と作業レポートに記録する。
- [ ] 日本語 PR 本文、受け入れ条件確認コメント、セルフレビューコメント、作業完了レポートを作成する。

## 検証計画

1. 廃止 primitive guard の targeted 実行
2. `npm run test:web-semantic-ui`
3. `npm run docs:web-inventory` と `npm run docs:web-inventory:check`
4. `npm run docs:web-trace:test`
5. `npm run test:coverage -w @memorag-mvp/web`
6. `npm run typecheck -w @memorag-mvp/web`
7. `npm run build -w @memorag-mvp/web`
8. `npm run ci`

## ドキュメント影響

製品仕様・運用手順・API は変更しないため canonical docs の更新は不要。ソースから自動生成される Web component / accessibility / inventory のみ同期対象とする。
