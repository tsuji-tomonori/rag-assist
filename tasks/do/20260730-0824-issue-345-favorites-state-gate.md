# Issue #345: お気に入り画面の共通状態証跡を required gate へ追加する

## 種別

- 修正

## 背景

Issue #345 と Draft PR #462 は、8 AppViews の共通状態契約を画面単位で required E2E へ収束している。
2026-07-29 時点では `history` と `admin` のみ `AC-SQ016-007` automated evidence があり、
`favorites` は実装済みの loading / empty / error / permission / retry 境界を持つ一方、
required gate では happy-path の confirmed zero しか画面単位に検証されていない。

## 原因分析（なぜなぜ）

1. なぜ `favorites` の `AC-SQ016-007` が `blocked` なのか。
   - 実際の HTTP 500 / 403 と retry recovery を画面境界で実行する required E2E がないため。
2. なぜ happy-path の zero 件 E2E だけでは不十分なのか。
   - 未確認・失敗・権限拒否を zero 件として誤表示しないことと、private detail を表示しないことを証明できないため。
3. なぜ共通 primitive / controller の unit test だけでは不十分なのか。
   - `FavoritesWorkspace`、`useAppShellState`、API adapter、retry callback の結線を含む feature evidence にならないため。
4. なぜ画面単位の証跡が抜けたのか。
   - 品質マトリクスは evidence file の存在を軸単位で確認するが、各 AppView の必須状態シナリオまでは機械的に強制していないため。
5. 根本原因は何か。
   - 共通状態契約を feature へ適用した後、`favorites` 固有の失敗・権限・回復シナリオを required selector に追加する収束作業が未実施だったこと。

## 確認済み事実

- `FavoritesWorkspace` は未確認 count を表示せず、confirmed empty を明示する。
- `useAppShellState` は `favorites` を `useResourceStateController` で読み込み、同じ loader を retry に使う。
- HTTP 403 は permission state、HTTP 500 は error state へ変換される。
- `E2E-UI-STATE-001` は `@ui-quality` により required Chromium gate の対象である。
- `history` / `admin` の既存状態証跡と、PR #461 の共通 primitive 修正には重複しない。

## スコープ

- `favorites` の loading → HTTP 500 → retry → confirmed empty を画面境界で検証する。
- `favorites` の HTTP 403 を permission として検証する。
- false zero と private detail 非表示を検証する。
- `SQ-016` 正本、UI/UX 正本、machine-readable matrix、生成マトリクスを同じ証跡へ同期する。

## スコープ外

- favorite resume journey の新規実装。
- 代表 screen reader、実 browser 400% zoom、touch / 実機検証。
- 他5 AppViews の `AC-SQ016-007` status 更新。
- merge、deploy、release。

## 受け入れ条件

- [ ] `E2E-UI-STATE-001` が `favorites` の loading、HTTP 500、retry、confirmed empty、HTTP 403 を実画面境界で検証する。
- [ ] loading / error / permission 中に `0 件` または confirmed empty を表示しない。
- [ ] raw HTTP error の private detail を表示しない。
- [ ] retry 後に recovered state、explicit empty、`0 件` を表示し、読み込み回数を固定する。
- [x] `favorites / AC-SQ016-007` の automated のみを `pass` とし、manual / overall と他5画面は `blocked` を維持する。
- [x] `REQ_SERVICE_QUALITY_016`、`DES_UI_UX_001`、machine-readable matrix、生成文書が同じ証跡を参照する。
- [ ] targeted E2E、lint、typecheck、unit、trace / semantic / docs checks が成功する。
- [ ] Draft PR #462 を更新し、日本語の受け入れ条件コメント、セルフレビュー、Issue #345 の進捗記録を残す。

## リスクとロールバック

- required UI gate が2シナリオ増えるため実行時間が増える。
- API route gate の解放漏れはテスト hang を起こすため、loading assertion 直後に必ず解放する。
- 問題時はこの task の E2E 2件と favorites のマトリクス・正本文書差分を同時に戻す。

## 未完了として維持する項目

- favorite resume journey。
- 代表 screen reader、実 browser 400% zoom、touch / 実機検証。
- CI final head の完了確認。

## 2026-07-30 ローカル検証

- pass: `npx eslint apps/web/e2e/visual-regression.spec.ts`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`（61 files / 443 tests）
- pass: `npm run build -w @memorag-mvp/web`
- pass: `npm run docs:web-trace:test`
- pass: `npm run test:web-semantic-ui`
- pass: `npm run docs:web-inventory:check`
- pass: `python3 scripts/validate_docs.py`
- pass: `npm run docs:hidden-unicode:check`
- pass: Playwright test listing（追加2件を検出）
- blocked: targeted Playwright execution。実行環境に Chromium がなく、browser 取得は配布証明書と実行時刻の不整合で失敗した。final-head GitHub Actions を判定根拠にする。
- note: timezone 未指定の Web unit は既存 date-format assertion 2件が実行環境 timezone で失敗した。JSTを明示した再実行は全件成功し、本差分との非関連を確認した。
