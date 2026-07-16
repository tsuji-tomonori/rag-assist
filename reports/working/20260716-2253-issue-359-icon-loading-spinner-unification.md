# Issue #359 Icon / LoadingSpinner primitive 一本化 作業レポート

- 実施日: 2026-07-16
- 対象 issue: #359 Phase 3b
- ブランチ: `codex/issue-359-icon-loading-spinner-unification`
- 起点: PR #373 final head `fab8471c2cd8fdb17d1478393ad6e7ae7213cd98`
- 依存順: PR #367 → PR #373 → 本タスク PR
- 状態: partially complete（draft PR #378、PR #361 の visual tolerance merge dependency）

## 受けた指示

Icon / LoadingSpinner の production entry を `shared/ui` に一本化し、互換 API、accessibility、No Mock、generated inventory を維持する。全 consumer を移行し、legacy path の再導入を静的 guard で拒否する。ローカルから root CI、GitHub E2E、draft stacked PR、受け入れ条件確認、セルフレビュー、latest-head CI まで完遂し、merge / deploy / release は行わない。

## 要件整理と判断

- `Icon` は既存の name union、SVG path、`.icon-*` class、decorative `aria-hidden` を維持する。
- `LoadingSpinner` は label なしを decorative、label ありを named `role=status` とする既存 contract を維持する。
- `LoadingStatus` は visible label、`role=status`、`aria-live=polite`、`aria-busy=true` を維持する。
- `shared/ui` を唯一の production entry とし、legacy implementation file と legacy import を残さない。
- Debug panel の raw spinner 2 箇所は、同じ DOM/CSS contract の共通 `LoadingSpinner` に置換する。
- CSS、ConfirmDialog、auth / navigation、permission boundary、RAG、benchmark behavior は変更しない。
- PR #338 / #361 / #368 と import 行または generated docs の競合余地があるため、変更範囲を primitive import と同期生成物に限定する。

## 実施作業

- `apps/web/src/shared/components/Icon.tsx` と `LoadingSpinner.tsx` を `apps/web/src/shared/ui/` へ移動した。
- `shared/ui/index.ts` に `Icon`、`IconName`、`LoadingSpinner`、`LoadingStatus` の export を追加した。
- 32 production consumer の import を正本 path へ更新した。
- DebugPanelBody / DebugPanelFooter の raw decorative spinner を共通 component に置換した。
- Icon / LoadingSpinner / LoadingStatus の accessibility contract を 3 unit tests で固定した。
- semantic UI contract に legacy file 不在、legacy import 禁止、aria contract、barrel export の静的 guard を追加した。
- Web inventory / accessibility generated docs を再生成した。
- task に参照 graph、preserve / migrate / merge / delete 分類、open PR 競合、検証 evidence を記録した。

## 成果物

- `apps/web/src/shared/ui/Icon.tsx`
- `apps/web/src/shared/ui/LoadingSpinner.tsx`
- `apps/web/src/shared/ui/Icon.test.tsx`
- `apps/web/src/shared/ui/LoadingSpinner.test.tsx`
- `tools/web-inventory/semantic-ui-contract.test.mjs`
- `docs/generated/web-*.md` / `docs/generated/web-ui-inventory.json`
- `tasks/do/20260716-2137-issue-359-icon-loading-spinner-unification.md`
- 本レポート

## 検証

| 検証 | 結果 |
| --- | --- |
| `npm ci` | 成功（504 packages） |
| targeted Web unit | 成功（2 files / 3 tests） |
| Web typecheck | 成功 |
| semantic UI contract | 成功 |
| Web inventory generate / check | 成功 |
| Web trace test | 成功 |
| Web build | 成功（既存の 500 kB 超 chunk warning のみ） |
| Web full coverage | 成功（63 files / 449 tests、S 90.87 / B 85.81 / F 90.72 / L 93.62） |
| `task docs:check` | 成功 |
| root `npm run ci` | 成功（API 801 / Web 449 / Infra 38 / Benchmark 102、全 build 成功） |
| `git diff --check` | 成功 |
| 変更ファイル限定 pre-commit | 成功 |
| GitHub E2E smoke | implementation head / strict base とも成功 |
| GitHub E2E full | 両 head とも同一 6 visual snapshot mismatch、21 / 27 成功。PR #361 待ち |
| latest-head GitHub CI | 本レポート確定 commit 後に監視し、PR comment へ結果を記録 |

ローカル Playwright の関連 6 tests は、`npx playwright test e2e/visual-regression.spec.ts --grep 'E2E-UI-(SEMANTIC-001|NAV-002|STATE-001)'` 実行時、test 開始前に `Error: listen EPERM: operation not permitted /tmp/tsx-1000/224.pipe` で Playwright webServer が起動できなかった。権限昇格は行わず、既存 `.github/workflows/e2e.yml` の GitHub-hosted smoke / full E2E を代替 evidence とする。

implementation head `f4dfa8d0` の GitHub E2E run [29504363097](https://github.com/tsuji-tomonori/rag-assist/actions/runs/29504363097) は `smoke` が成功した。full は 27 件中 21 件が成功し、6 visual snapshots が `login=19`、`chat-empty=85`、`chat-answer-citations=60`、`debug-panel=142`、`documents-workspace=219`、`chat-empty-mobile=89` pixels（各 ratio 0.01）の差で失敗した。failed job を 1 回再実行した attempt 2 も同一 6 件・同一 pixel 数で失敗したため、偶発的 flake ではない。

strict base `fab8471c` を同じ workflow / runner で比較した run [29505240296](https://github.com/tsuji-tomonori/rag-assist/actions/runs/29505240296) も、`smoke` 成功、full 21 / 27 成功、同一 6 件・同一 pixel 数の visual failure だった。strict base から E2E source、snapshot、CSS、package lock に変更はなく、Icon / LoadingSpinner は 100% rename、Debug spinner は同じ `span.loading-spinner[aria-hidden=true]` DOM contract である。したがって今回の behavior regression ではなく、既存 baseline / runner anti-aliasing mismatch と確定した。

正規解決は既存 draft PR #361 が導入する `maxDiffPixels=300` である。本 PR では snapshot / tolerance を重複変更せず、PR #361 の merge dependency として明示する。full E2E success は未達なので task を done にせず `tasks/do` に維持する。

## 指示への fit 評価

- `shared/ui` 一本化、全 consumer 移行、legacy guard、a11y regression tests、generated docs 同期を実装した。
- production 値や架空データを追加せず、mock / demo / fallback を導入していない。
- CSS と product behavior を変更していない。LoginPage / RailNav / TopBar を含む重複箇所は import 行だけを変更した。
- API / access-control / RAG / benchmark evaluator・dataset 固有分岐には変更がない。

## 未対応・制約・リスク

- draft stacked PR #378、`semver:patch`、日本語の受け入れ条件コメント（`4992946509`）、セルフレビュー（`4992946821`）を完了した。
- 本レポート確定 commit 後の latest-head GitHub CI は監視し、結果を PR top-level comment に記録する。
- full visual E2E success と task done は PR #361 の merge dependency。strict base と同一失敗で新変更起因ではないが、成功済みとして扱わない。
- manual screen reader / 実機確認は未実施。unit / semantic / axe / mobile navigation / loading-state E2E を自動回帰 evidence とする。
- `npm ci` は既存 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告した。今回の primitive 移動とは独立しており、`npm audit fix` は行っていない。
- stacked PR は PR #367 / #373 の merge 前には main 差分に依存 commit を含む。PR #338 は ChatComposer import と generated Web docs、PR #361 は Playwright 周辺、PR #368 は LoginPage / RailNav に競合余地がある。
- merge / deploy / release は実施しない。
