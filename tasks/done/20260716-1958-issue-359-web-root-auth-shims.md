# Issue #359 Web root auth shim の feature entry 収束

- 状態: done
- 種別: 修正
- Issue: #359 Phase 1b
- 作業ブランチ: `codex/issue-359-web-root-shims`
- 基準: `origin/main` / `e12abb07`

## 指示・目的

`apps/web/src` 直下に残る `LoginPage.tsx` と `authClient.ts` の互換 shim を廃止し、認証 UI と認証 client の参照先を `features/auth` 配下の正規 entry に一本化する。ログイン、サインアップ、確認コード、初回パスワード変更、ログアウトの既存契約は変更しない。

## 完了チェックリスト / Done 条件

- [x] 作業前 RCA、参照グラフ、open PR 重複、受け入れ条件を本 task に固定する。
- [x] `App.tsx` と全 auth consumer/test を feature path へ移行する。
- [x] root `LoginPage.tsx`、`LoginPage.test.tsx`、`authClient.ts`、`authClient.test.ts` を削除し、保持すべき test を feature 側へ統合する。
- [x] legacy root shim の再導入を検出する guard test を追加する。
- [x] production UI のデータ由来、認証状態、アクセシブルな name/role/state を変更していないことをレビューする。
- [x] 対象 test、Web full coverage/typecheck/build、root CI、Web inventory/trace/semantic、login E2E/smoke を実行し、成功させる。
- [x] 作業レポート、commit/push、main 向け PR、受け入れ確認コメント、セルフレビュー、task done 更新を完了する。

## なぜなぜ分析 / RCA

### confirmed

1. `apps/web/src/LoginPage.tsx` は feature component を再 export する1行だけの shim だが、`App.tsx` と root `LoginPage.test.tsx` が参照している。
2. `apps/web/src/authClient.ts` は feature client を再 export する1行だけの shim だが、app shell、auth hook/component、関連 test が root 相対 path を参照している。
3. feature 側 `LoginPage.test.tsx` は3 test、root 側は5 testで、root 側だけに認証拒否、pending、`NEW_PASSWORD_REQUIRED`、sign-up/confirm journey の契約がある。
4. root `authClient.test.ts` は365行あり、認証 client 実体の契約 test であるため、削除ではなく feature API 配下への移管が必要である。
5. 2026-05-03 の feature 分割で互換 re-export が追加され、その後の consumer/test 移行が完了しないまま残った。

### inferred

- 段階移行時の互換性確保を優先した結果、正規配置と root entry が併存し、後続実装が近い root path を使い続けた。
- 重複した test 配置が root shim を実装の正本のように見せ、削除可能性を見えにくくしている。

### root cause

- feature 分割完了時に「全 consumer を正規 path へ移す」「legacy path を禁止する guard」「test を実体と同居させる」という完了条件がなく、互換 shim の終了条件が未定義だった。

### open_question

- 手動 screen reader / real-device 確認は自動検証環境では実施できない可能性がある。未実施の場合は PR とレポートに残余リスクを明記する。

## 参照グラフ（作業前）

```text
App.tsx ───────────────> src/LoginPage.tsx ─────> features/auth/components/LoginPage.tsx
root LoginPage.test.tsx ┘

AppShell / app hooks / app components ─┐
features/auth hook / component ────────┼─> src/authClient.ts ─> features/auth/api/authClient.ts
root authClient.test.ts ────────────────┘
```

移行後は production/test consumer から feature 実体へ直接 import し、root shim path を消す。

## `src/api.ts` の分割判断

- `src/api.ts` は28行の広域 barrel で、production import は確認されなかった。
- 一方、約700行の `src/api.test.ts` が全 feature/shared export と動的 import を検証し、`App.test.tsx` と `authClient.test.ts` も依存する。
- open PR #338 が `App.test.tsx` を変更中で root `api.ts` type import を前提としており、同時削除は rebase と test architecture の変更範囲を広げる。
- そのため本 task では削除せず、`tasks/todo/20260716-1958-issue-359-web-api-barrel-removal.md` に独立 task として分離する。

## open PR overlap

- PR #361: workflow、Taskfile、Web package/playwright、CSS、generated docs 等を変更中。今回の auth source/test とは直接重複しない。package/Taskfile を変更せず競合を抑える。
- PR #338: `App.test.tsx`、`useAppShellState*`、chat feature、generated Web docs 等を変更中。本 task では `App.test.tsx` を変更せず、auth import の一部は将来の rebase で軽微な競合リスクがあることを PR に明記する。

## 受け入れ条件

- [x] `apps/web/src/LoginPage.tsx` と `apps/web/src/authClient.ts` が存在しない。
- [x] active source/test に root `LoginPage` / `authClient` import が0件で、guard test が再導入を検知する。
- [x] root test の固有契約が feature test に統合され、login / sign-up / confirm / new-password / logout が維持される。
- [x] production UI に固定値、架空 fallback、未実装操作を追加していない。
- [x] 認証 UI の name/role/state、label、error/status announcement、keyboard 操作を弱めていない。
- [x] `npm run ci` が成功する。
- [x] `npm run test:coverage -w @memorag-mvp/web` が成功する。
- [x] `npm run docs:web-inventory:check`、`npm run docs:web-trace:test`、`npm run test:web-semantic-ui` が成功する。
- [x] login flow の Playwright E2E/smoke が成功する。
- [x] README / `docs/` / API / 運用手順の挙動記述は変更不要と確認し、generated inventory が fresh である。

## 完了記録

- PR: #368 `https://github.com/tsuji-tomonori/rag-assist/pull/368`
- 初回 commit: `b8487594`
- 受け入れ確認コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/368#issuecomment-4991329078`
- セルフレビューコメント: `https://github.com/tsuji-tomonori/rag-assist/pull/368#issuecomment-4991329080`
- GitHub Apps は60秒 timeout し、同一 head の PR が未作成であることを確認してから `gh` fallback を使用した。
- sandbox 内では `tsx` IPC `listen EPERM` だったが、ユーザー承認の sandbox 外実行で対象 login E2E が Chromium 2/2 pass（login visual 845ms、sign-in 後 chat empty 736ms、計5.7秒）した。localhost の test API/Web と Chrome のみを利用し、外部/production 状態は変更していない。
