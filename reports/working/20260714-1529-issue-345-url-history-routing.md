# Issue #345 URL/history routing 作業レポート

- 実施日時: 2026-07-14 15:29 JST
- 対象 task: `tasks/do/20260714-issue-345-url-history-routing.md`
- 対象要件: `FR-094`, `FR-097`
- 依存: draft PR #348 / `codex/issue-345-uiux-foundation` head `8e8cf588`

## 受けた指示・要件整理

全 `AppView` と承認済み document workspace state を canonical URL に反映し、利用者 navigation の back/forward、reload、bookmark/direct deep link を復元する。invalid/obsolete/conflicting/denied target は silent fallback せず、protected data の fetch/render 前に安全な state と programmatic notice へ復帰させる。

## 検討・判断

- route parsing/serialization を hook から純粋 module へ分離した。
- 利用者が明示した view 遷移だけ `pushState` とし、normalization、permission recovery、document transient state は `replaceState` とした。
- `?view=` の後方互換性と既存 document path family を維持し、CloudFront/deploy routing は変更しなかった。
- URL へ新たな秘密・prompt/chunk/internal memo を追加せず、既存 view/document identifiers と filter state の範囲に限定した。
- exact allowlist で未知/重複/空 query、不正 sort、未定義 hash、malformed/path-escaping segment を排除した。

## 実施作業・成果物

- `apps/web/src/app/routing/appRoute.ts` と unit test を追加した。
- `useAppShellState` に初期 normalization、push/replace、popstate restoration、document canonical path、permission/invalid notice を実装した。
- `AppRoutes` は permission 解決前と guard 不一致で何も描画せず、既存の暗黙 history fallback を削除した。
- `AppShell` に permission alert と invalid status を追加した。
- `E2E-UI-ROUTE-001` / `002` で history/reload/direct document URL、denied admin non-fetch、obsolete/unknown query normalization を検証した。
- `FR-094` / `FR-097`、`DES_UI_UX_001`、requirements trace、generated inventory を同期した。
- requirements baseline validator を task lifecycle (`todo/do/done`) の exactly-one 検査へ修正した。

## 検証結果

- route/navigation unit: 3 files / 18 tests pass。
- Web unit: 38 files / 321 tests pass。
- Chromium targeted E2E: NAV/ROUTE 4 tests pass。
- Web typecheck、production build、repository ESLint: pass。
- docs validator unit: 11 tests pass。
- `task docs:check`: pass（semantic trace 8 tests、95 APIs / 570 API docs、generated inventory freshness を含む）。
- API requirement trace node test: 1 pass。
- staged pre-commit hooks: pass。
- `git diff --check`: pass。

誤って Node test file を Vitest 単独指定した初回コマンドは `No test suite found` となった。正しい `node --import tsx --test` 入口で再実行して成功した。全 Web test と docs check の初回不整合は mobile navigation レポート記載のとおり修復・再実行済みである。

## 指示への fit 評価

- visible view/URL、push/replace policy、reload/back/forward/direct、invalid/denied recovery の各受け入れ条件に自動 evidence がある。
- denied admin route で `/admin/*` request が発生せず、UI permission が API authorization を拡張していない。
- docs/source/test/generated trace は同期し、No Mock Product UI に反する production fallback を追加していない。

## 未対応・制約・リスク

- admin/questions の filter/selection/scroll restoration と document 143-operation IA は別 task の残余であり、`FR-097` 全体の完了は主張しない。
- full API coverage は本マイルストーンでは未実施。API runtime は変更せず、変更した trace table は対象 node test で検証した。PR CI では full coverage が実行される。
- PR #348 未 merge のため本 branch は foundation head 依存。default branch へ merge する前に依存を解消し、main 差分へ収束させる必要がある。
- PR 作成、受け入れ条件コメント、セルフレビュー、task lifecycle 更新はこの report 作成後の workflow で行う。
