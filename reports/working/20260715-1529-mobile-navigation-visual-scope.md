# Mobile navigation visual scope 修復レポート

## 受けた指示

Issue #345 の stacked PR を依存順に確認し、必要な修正と再検証を行って順次 main へマージする。

## 要件整理

- PR #350 を latest main へ収束させる。
- local/CI の failure を未解決のままマージしない。
- visual baseline は expected / actual / diff を目視してから更新する。
- production UI/API/RAG/認可を不要に変更しない。

## 検討・判断

- 再統合後 smoke 13件中 `E2E-UI-NAV-002` だけが expected 320x720 / actual 320x805 で失敗した。
- 画像比較では navigation overlay は一致し、差分は背後の chat suggestion / composer に限定された。
- `page` の full-page snapshot は navigation 契約より観測範囲が広く、shared-state 変更による無関係な高さ差へ結合していた。
- 単に新しい full-page baseline を承認せず、`.mobile-navigation-panel` を対象にし、snapshot時だけ背景を不透明化して背後contentを比較から除外した。
- `navigation` landmark だけでは個人設定が欠落したため、panel全体を正しい責務境界とした。

## 実施作業

- PR #349 merge 後の latest main を PR #350 branch へ mergeした。
- `E2E-UI-NAV-002` の visual assertion を full page から mobile navigation panel へ限定した。
- test-only style でpanel背景を不透明化した。
- 全destination、current/focus、個人設定を含む scoped baseline を再生成し目視確認した。

## 成果物

- `apps/web/e2e/visual-regression.spec.ts`
- `apps/web/e2e/visual-regression.spec.ts-snapshots/mobile-navigation-320-chromium-linux.png`
- `tasks/do/20260715-1525-mobile-navigation-visual-scope.md`

## 検証結果

- 初回 `npm run test:e2e:smoke -w @memorag-mvp/web`: 12/13 success、visual mismatch 1件を検出。
- 修正後対象 Playwright: 1/1 success。
- 修正後 `npm run test:e2e:smoke -w @memorag-mvp/web`: 13/13 success。
- `npm run test:coverage -w @memorag-mvp/web`: 338/338 success。statements 91.14%、branches 85.08%、functions 91.92%、lines 94.03%。
- `npm run typecheck -w @memorag-mvp/web`: success。
- `npm run build -w @memorag-mvp/web`: success。
- `npm exec -- eslint apps/web/e2e/visual-regression.spec.ts --max-warnings=0`: success。
- `task docs:check`: success。
- `git diff --check`: success。
- Playwright はローカルAPI/Webのport待受がsandboxで `EPERM` となったため、都度ユーザー承認を得てsandbox外で実行した。

## 指示への fit 評価

総合fit: 5.0 / 5.0。検出した失敗をbaseline全面更新で隠さず、test責務をnavigation panelへ限定して原因を除去し、対象からbroader smoke/coverage/docsまで再検証した。

## 未対応・制約・リスク

- representative screen reader、実touch、実browser 200%/400% zoom、real-device、Firefox/WebKit は既存manual/automated quality taskの対象で、本修正では未実施。
- PR required Playwright gate は `tasks/todo/20260714-issue-345-ui-automated-quality-gates.md` で後続実装する。
- production behavior、API/RAG/authorization、benchmark/dataset/no-mock 境界は変更していない。
