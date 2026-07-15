# Issue #345 mobile navigation 作業レポート

- 実施日時: 2026-07-14 15:29 JST
- 対象 task: `tasks/do/20260714-issue-345-mobile-navigation.md`
- 対象要件: `FR-094`, `SQ-016`, `NFR-017`
- 依存: draft PR #348 / `codex/issue-345-uiux-foundation` head `8e8cf588`

## 受けた指示・要件整理

Issue #345 全体をマイルストーン PR に分割して完了へ進める。第2マイルストーンでは、最大権限を含む persona が 320px でも全許可 `AppView` と個人設定へ到達でき、権限外 destination を隠し、keyboard/focus/semantic state と responsive overflow を検証可能にする。API authorization を UI 表示制御で代替しない。

## 検討・判断

- desktop rail を維持し、720px 以下は disclosure menu に切り替えた。
- destination 定義を permission-aware list に集約し、desktop/mobile の項目差を防いだ。
- menu は modal dialog ではなく navigation disclosure とし、current item への初期 focus、Escape と選択後の trigger focus return を実装した。
- 400% zoom は 320px reflow automation を相当 evidence として扱うが、実 browser zoom の実施済みとはしない。
- test fixture の user/permission は Playwright/test のみで使用し、production fallback へ入れていない。

## 実施作業・成果物

- `RailNav.tsx`、`RailNav.test.tsx`、`responsive.css`、`layout.css`、menu icon を更新した。
- safe-area inset、`100dvh`、panel 内 scroll、44–48px target、長文折返し、focus-visible ring を追加した。
- standard user と maximum-permission persona を分離した `E2E-UI-NAV-001` / `002` を追加した。
- 320x720 visual baseline `mobile-navigation-320-chromium-linux.png` を生成し、重なり・欠落・横 overflow がないことを目視した。
- `FR-094`、`DES_UI_UX_001`、trace manifest と generated Web inventory を同期した。

## 検証結果

- route/navigation unit: 3 files / 18 tests pass。
- Web unit: 38 files / 321 tests pass。
- Chromium targeted E2E: NAV/ROUTE 4 tests pass（NAV は standard/max permission、320/375px、keyboard、focus、overflow、reduced-motion）。
- Web typecheck、production build、repository ESLint: pass。
- docs validator unit: 11 tests pass。
- `task docs:check`: pass（semantic trace 8 tests、95 APIs / 570 API docs、generated inventory freshness を含む）。
- API requirement trace node test: 1 pass。
- staged pre-commit hooks: pass。
- `git diff --check`: pass。

初回全 Web test は、権限解決前を fail-closed にしたことで既存 `renderAuthenticatedApp` が chat 描画前に返る race を 6件検出した。test helper を chat region 待機へ修正し、321件を再実行して成功した。初回 docs check は baseline validator が task を `todo` 固定で探索して失敗したため、`todo/do/done` の exactly-one lifecycle 検査へ修正し、validator 11件と docs check を再実行して成功した。

## 指示への fit 評価

- 320px reachability、権限別非表示、keyboard/current/expanded/name/focus return、横 overflow、reduced motion の自動証跡は要件に適合する。
- server-authoritative permission、RAG、API schema/store、benchmark/dataset 分岐を変更していない。
- docs/source/test/generated evidence は同期した。

## 未対応・制約・リスク

- 代表 screen reader、実 touch、実 browser 400% zoom、safe-area/virtual-keyboard を伴う real-device は未実施。
- accessibility role/name/state は Testing Library と Playwright role query で確認したが、screen reader 実利用 evidence の代替ではない。
- 上記は `tasks/todo/20260714-issue-345-manual-a11y-evidence.md` の残余とし、本 task を `done` へ移さない。
- Firefox/WebKit と axe required gate は後続 quality-gate task の範囲。
- full API coverage は本マイルストーンでは未実施。変更した API artifact は要件 trace table のみで、対象 node test を実行した。PR CI では full API coverage が実行される。
- draft PR #349 と日本語の受け入れ条件・セルフレビューを登録したが、manual evidence が未達のため本 task は `tasks/do/` を維持する。
