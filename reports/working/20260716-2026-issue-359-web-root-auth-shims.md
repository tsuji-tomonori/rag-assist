# Issue #359 Web root auth shim 収束 作業レポート

- 作成日時: 2026-07-16 20:26 JST
- Issue: #359 Phase 1b
- branch: `codex/issue-359-web-root-shims`
- base: `origin/main` / `e12abb07`
- task: `tasks/done/20260716-1958-issue-359-web-root-auth-shims.md`
- PR: #368 `https://github.com/tsuji-tomonori/rag-assist/pull/368`

## 受けた指示

- `App.tsx` と全 auth consumer を feature 正規 path へ変更して root `LoginPage.tsx` / `authClient.ts` を削除する。
- root の重複 test を feature 実体と同居させ、login / sign-up / confirm / new-password / logout 契約を維持する。
- `src/api.ts` は production/test/open PR 参照を棚卸しし、安全性を証明できない場合は独立 task に分ける。
- root CI、Web coverage/typecheck/build、Web inventory/trace/semantic、login E2E/smoke を検証する。
- no-mock production UI、a11y metadata、README/docs 影響、PR #361/#338 の競合を確認する。

## 要件整理と判断

- root `LoginPage.tsx` と `authClient.ts` はそれぞれ feature 実体を再 export する1行 shim だった。
- root test の方が認証拒否、pending、初回パスワード変更、sign-up/confirm を広く保持していたため、単純削除せず feature test へ統合した。
- `src/api.ts` は production import がない一方、約700行の `api.test.ts`、`App.test.tsx`、auth test が依存している。さらに open PR #338 が `App.test.tsx` を変更中のため、今回の auth shim 削除とは分離した。
- PR #361 は Taskfile/package/playwright/CSS/generated docs を変更中だが、今回 package/Taskfile を変更しないため直接 path overlap はない。
- PR #338 は `App.test.tsx`、`useAppShellState*`、chat feature、generated Web docs を変更中である。今回 `App.test.tsx` を変更しなかったが、`useAppShellState*` の auth type import 行には rebase 時の軽微な競合可能性がある。

## RCA 要約

- confirmed: 2026-05-03 の feature 分割後も root 再 export と root test/consumer が残り、正規 entry が一意になっていなかった。
- inferred: 互換性確保後の終了条件と legacy path 再導入 guard がなく、近い root 相対 import が継続した。
- root cause: feature 分割の Done 条件に全 consumer 移行、test の実体同居、legacy entry 禁止が含まれていなかった。

## 実施作業

- `App.tsx`、`AppShell`、app components/hooks/tests、auth component/hook の `AuthSession` / auth function import を `features/auth` 正規 path へ変更した。
- root `LoginPage.tsx` と `authClient.ts` を削除した。
- root `LoginPage.test.tsx` の5 journey と feature 側のパスワード条件 test を `features/auth/components/LoginPage.test.tsx` に統合した。
- root `authClient.test.ts` を `features/auth/api/authClient.test.ts` へ移し、documents/runtime config も正規 module を直接参照させた。
- `features/auth/authBoundary.test.ts` を追加し、legacy root entry 2本が再導入されると失敗する guard を設けた。
- `src/api.ts` 削除を `tasks/todo/20260716-1958-issue-359-web-api-barrel-removal.md` へ分離した。

## 成果物

- feature 正規 path を直接参照する Web auth consumer
- root `LoginPage.tsx` / `authClient.ts` の削除
- feature 実体と同居する Login/auth client contract test
- legacy root auth entrypoint 再導入 guard
- root API barrel follow-up task

## UI / no-mock / accessibility レビュー

- production TSX の JSX、表示値、API/state/config 由来、loading/error/notice/permission state は変更していない。
- 固定件数、架空ユーザー、demo fallback、未実装操作を production UI に追加していない。
- Login form の visible label、accessible name、button role/disabled state、`role="alert"` / `role="status"`、`aria-live`、keyboard 操作は変更していない。
- component test で login、remember、pending、alert/status、new-password、sign-up/confirm、password requirement state を維持した。
- 手動 screen reader、real device、200%/400% zoom は UI behavior 変更がないため追加実施していない。

## ドキュメント影響

- README、`docs/`、API、運用手順に記載される挙動・公開契約は変更していないため手修正不要と判断した。
- `npm run docs:web-inventory:check` が成功し、feature 実体を正本とする generated inventory が fresh であることを確認した。
- task/report はリポジトリ運用規約に従って追加した。

## 検証結果

| コマンド | 結果 | 要約 |
| --- | --- | --- |
| `npm test -w @memorag-mvp/web -- src/features/auth/components/LoginPage.test.tsx src/features/auth/api/authClient.test.ts src/features/auth/authBoundary.test.ts` | pass | 3 files / 21 tests |
| `npm run typecheck -w @memorag-mvp/web` | pass | TypeScript error 0 |
| `npm run test:coverage -w @memorag-mvp/web` | pass | 61 files / 441 tests、statements 90.8% |
| `npm run build -w @memorag-mvp/web` | pass | Vite build 成功。既存の 500 kB chunk warning あり |
| `npm run docs:web-inventory:check` | pass | inventory fresh |
| `npm run docs:web-trace:test` | pass | 1 test |
| `npm run test:web-semantic-ui` | pass | 1 test |
| `npm run ci` | pass | lint、全 workspace typecheck/test/build。API 801、Web 441、infra 38、benchmark 102、contract 1 test pass |
| `git diff --check` | pass | whitespace error 0 |
| `npm run test:e2e -w @memorag-mvp/web -- e2e/visual-regression.spec.ts --grep 'ログイン画面\|チャット空状態'` | pass | ユーザー承認の sandbox 外実行。Chromium 2/2（login visual 845ms、sign-in 後 chat empty 736ms）、計5.7秒 |
| `npm run test:e2e:smoke -w @memorag-mvp/web` | 未実施 | 広域 smoke suite は今回差分外。対象 login journey 2件を直接実行して受け入れを確認 |
| `git diff --exit-code origin/main -- apps/web/playwright.config.ts apps/web/package.json apps/api/package.json package.json` | pass | E2E 起動経路は main と差分0。今回差分外の sandbox 制約と確認 |

## 指示への fit 評価

- Login/auth root shim の正規 path 収束、test 移管、再導入 guard、契約維持、no-mock/a11yレビュー、root/Web/docs 自動検証は満たした。
- `src/api.ts` は安全性と open PR overlap を理由に独立 task とし、不確かな一括削除を行わなかった。
- sandbox 外の対象 login E2E 2件が成功し、login journey の受け入れ条件を確認した。

## 未対応・制約・リスク

- 対象 login E2E は sandbox 外で成功した。実行対象は localhost の test API/Web と Chrome のみで、外部/production 状態変更はない。広域 smoke suite は実施していない。
- `src/api.ts` と `api.test.ts` の feature/shared 分割は follow-up task で行う。
- PR #338 の `useAppShellState*` 変更と auth type import 行が rebase 時に競合する可能性がある。挙動上の重複はない。
- build の chunk-size warning と `npm install` が報告した dependency vulnerability は今回の import-only scope 以前からの既存事項で、本 task では変更していない。

## PR lifecycle

- 初回 commit `b8487594` を push した。
- GitHub Apps の PR 作成は60秒 timeout し、同一 head の PR が存在しないことを確認してから `gh` fallback で PR #368 を作成した。
- `semver:patch` label を設定した。
- 日本語の受け入れ確認コメントとセルフレビューコメントを投稿した。
- sandbox 外の対象 login E2E 2件の成功を task/report/PR へ反映した。
