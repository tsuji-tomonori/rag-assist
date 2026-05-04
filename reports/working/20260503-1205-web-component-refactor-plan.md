# Web コンポーネント分割 実行計画

保存先: `reports/working/20260503-1205-web-component-refactor-plan.md`

## 1. 受けた指示

- `rag-assist` の専用 worktree とブランチを作成する。
- `memorag-bedrock-mvp/apps/web` の God Component 化した `App.tsx` を対象に、設計、実装、テストを行う。
- 作業前に実行計画を立て、レポートを作成し、タスクを分割する。
- きりの良いタイミングでテスト確認を行い、`git commit` と `git push` を行う。
- 全作業完了後、GitHub Apps を使って `main` 向け PR を作成する。
- 最後までやり切り、実施していない検証は実施済みとして書かない。

## 2. Done 条件

| ID | Done 条件 | 検証方法 |
|---|---|---|
| D1 | 専用 worktree と `codex/web-component-refactor` ブランチがある | `git worktree list`, `git branch --show-current` |
| D2 | `App.tsx` の UI 部品/画面責務が複数ファイルへ分離されている | `git diff --stat`, TypeScript compile |
| D3 | 既存 UI の主要動作を壊していない | `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web` |
| D4 | TypeScript の型整合性が保たれている | `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web` |
| D5 | 作業レポートと completion status が残っている | `reports/working/*.md`, `.codex/completion-status.json` |
| D6 | commit/push 済みで PR が `main` 向けに作成されている | `git status`, GitHub Apps PR 作成結果 |

## 3. タスク分割

| Milestone | 内容 | 状態 |
|---|---|---|
| M1 | Worktree/branch 作成、現状調査、計画レポート作成 | in_progress |
| M2 | shared 部品を切り出す: `Icon`, 表示フォーマッタ、ダウンロード/ファイル名 utility | pending |
| M3 | feature 画面を切り出す: debug/history/documents/benchmark | pending |
| M4 | app shell を切り出す: `RailNav`, `TopBar`, `AppRoutes` 相当の描画関数 | pending |
| M5 | テスト/型チェックを実行し、失敗を修正する | pending |
| M6 | 作業完了レポートと completion status を作成する | pending |
| M7 | stage、commit、push、GitHub Apps で PR 作成 | pending |

## 4. 実装方針

- 影響範囲を抑えるため、状態管理と API 呼び出しは初回では `App.tsx` に残し、JSX と純粋部品を先に分離する。
- `api.ts` のドメイン分割と CSS Modules 化は影響範囲が大きいため、今回の主変更からは外し、将来作業としてレポートに残す。
- import 経路は既存 tsconfig に合わせて相対 import を使い、新しい path alias は導入しない。
- CSS は既存 `styles.css` を維持し、クラス名変更を避ける。
- 既存 `App.test.tsx` を統合テストとして活用し、リファクタによる振る舞い差分を検出する。

## 5. 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `git diff --check`

## 6. ドキュメント更新判断

- 今回はユーザー可視の UI 挙動や API 仕様を変更せず、内部コンポーネント構成の整理を行うため、恒久ドキュメントの更新は原則不要。
- 作業計画と判断は `reports/working/` の作業レポートに残す。
- 実装中に保守者向けの構成説明が必要になった場合のみ、最小範囲で README または docs 更新を検討する。
