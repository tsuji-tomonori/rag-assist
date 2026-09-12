# Issue #345 text-spacing override proxy E2E

- 状態: done
- タスク種別: 修正
- 関連 Issue: #345
- Stacked base: PR #416 final head `4706ce69e3230cf20ef68b1d11cc66f862d05da7`

## 背景

Issue #345 は WCAG 2.2 AA、320px responsive、長文・拡大時の reflow を未完了項目としている。既存 PR #385 は cross-screen/axe/layout、#396 は keyboard navigation、#400 は Chromium AX tree、#404 は touch、#408 は zoom/reflow viewport proxy、#410 は reduced-motion/長文 layout stress、#416 は viewport-height shrink を担当する。

一方、WCAG 1.4.12 の代表値に相当する text spacing override（line-height 1.5、paragraph spacing 2em、letter spacing 0.12em、word spacing 0.16em）を適用した状態で主要 journey の reflow と操作を検証する自動証跡はない。ConfirmDialog keyboard E2E も候補だったが、open Draft PR #373 が同じ操作契約を担当するため除外した。

## 目的

320px Chromium で代表 text-spacing override を適用しても、login→chat→documents の主要操作が利用でき、root と対象 region に意図しない水平 overflow が発生しないことを自動検出する。

## スコープ

- `apps/web/e2e/text-spacing.spec.ts` を新規追加する。
- E2E を専用 TypeScript project に所属させ、typed ESLint の default-project 件数制限へ依存しない構成にする。
- Playwright 内で WCAG 1.4.12 代表値の stylesheet を注入する。
- local admin の login、chat、mobile navigation、documents 到達を単一 journey で検証する。
- computed spacing、viewport、URL、root/region の client/scroll width、代表 control rect を JSON evidence として添付する。
- production UI / CSS / API / auth / permission / RAG / benchmark / dependency は変更しない。

## 実装計画

1. 320×720px で login page を開き、text-spacing stylesheet を注入する。
2. login heading / fields / submit button の computed spacing と水平配置を検査する。
3. local admin として sign-in し、chat textbox/send と root/chat region の reflow を検査する。
4. mobile menu から documents へ到達し、主要 region / control と root/documents region の reflow を検査する。
5. 各 state の computed style、rect、overflow、URL を JSON evidence に添付する。

## 軽量なぜなぜ分析（実装前追記）

### 問題文・影響範囲

- 2026-07-17、`npm run lint` が `apps/web/vitest.config.ts` に対して `Too many files (>8) have matched the default project` で失敗した。
- 新規 spec を含む Web E2E 6 件、`playwright.config.ts`、`visual-regression.spec.ts`、`vitest.config.ts` の計 9 件が default project に入り、repository lint を完了できない。
- 型検査対象の所属設定に限る問題で、対象 E2E 1/1、smoke 21/21、full E2E 33/33、Web typecheck、Web build は当該時点で pass している。

### 事実と因果

1. `apps/web/tsconfig.json` の `include` は `src/**` と `vite.config.ts` のみで、`apps/web/e2e/*.ts` は TypeScript project に所属しない。
2. `eslint.config.mjs` は E2E と Playwright/Vitest config を `projectService.allowDefaultProject` で型付き lint 対象へ救済している。
3. typescript-eslint の default-project 上限は既定 8 件であり、今回の 1 spec 追加で対象が 9 件になったため lint が停止した。
4. 上限値の引き上げは spec 増加ごとに同じ失敗を再発させ、default-project の性能上の注意も解消しない。

### 根本原因・修正方針・効果確認

- 直接原因: project 外の E2E 群を件数上限付き default project に置いていた。
- 流出原因: spec 追加時に E2E ファイル数と default-project 上限の関係を検出する構造的ガードがなく、repository lint 実行時まで顕在化しなかった。
- 修正: `apps/web/e2e/tsconfig.json` を追加して E2E を専用 project に所属させ、`allowDefaultProject` から E2E glob を削除する。
- 互換境界: 従来の inferred/default project で有効ではなかった `noUncheckedIndexedAccess` と `noImplicitOverride` は E2E project で無効化し、既存 stacked spec の意味を本 unit で変更しない。型付き ESLint 規則と `strict` は維持する。
- 反事実: E2E が専用 project に所属すれば default-project 件数は Playwright/Vitest config の 2 件となり、spec 増加で上限を再び超えない。
- 効果指標: repository lint が pass し、新規 spec が typed lint と E2E の双方で pass すること。フォローアップは本 PR の implementation/final-head CI で確認する。

## ドキュメント保守計画

- 既存 WCAG/responsive 要件の意味、production behavior、API、運用コマンドを変更しない test-only proxy のため、README / `docs/` / generated inventory は更新不要と判断する。
- `task docs:check` で正本、trace、generated freshness を確認する。

## 受け入れ条件

- [x] AC1: 320px login page に line-height 1.5、paragraph spacing 2em、letter spacing 0.12em、word spacing 0.16em の override を適用し、computed value を確認する。
- [x] AC2: login の heading、email/password、submit が横方向に viewport 内で操作可能で、root horizontal overflow がない。
- [x] AC3: sign-in 後の chat textbox/send が横方向に viewport 内で操作可能で、root/chat region horizontal overflow がない。
- [x] AC4: text-spacing override を維持したまま mobile menu から documents へ到達し、主要 control が横方向に viewport 内で、root/documents region horizontal overflow がない。
- [x] AC5: viewport、URL、computed spacing、active view、root/region width、代表 control rect を JSON evidence に添付する。
- [x] AC6: user stylesheet / browser setting / screen reader / real-device / 実 zoom の合格証跡へ読み替えない boundary を test/report/PR に明記する。
- [x] AC7: 対象 E2E、required smoke、full E2E、Web typecheck、repository lint、Web build、docs check、diff check、pre-commit が pass する。
- [x] AC8: PR #416 branch 向け Draft stacked PR #420 を作成し、`semver:patch` 1 件、implementation head required CI success を確認した。task/report 完了 commit 後の final-head required CI は PR top-level comment へ記録する。
- [x] AC9: Web E2E が専用 TypeScript project に所属し、spec 数の増加が typed ESLint の default-project 既定上限へ累積しない。

## 実装時検証結果

- 対象 E2E: 1/1 pass
- smoke E2E: 21/21 pass
- full E2E: 33/33 pass
- Web typecheck: pass
- E2E 専用 typecheck: pass
- repository lint: pass（初回 default-project 9 件エラーを RCA 後に修復して再実行）
- Web build: pass（既知の 500 kB 超 chunk warning あり）
- `task docs:check`: pass
- `git diff --check`: pass
- changed-files pre-commit: pass

## PR / CI / comment 証跡

- Draft stacked PR: https://github.com/tsuji-tomonori/rag-assist/pull/420
- base: PR #416 branch `codex/issue-345-viewport-keyboard-proxy` / `4706ce69e3230cf20ef68b1d11cc66f862d05da7`
- implementation head: `36736d64a2d971ecb0da7bbe4f13c2afae444daf`
- required CI run `29564787095`: success（`Lint, type-check, test, build, and synth`）。promotion gate は条件どおり skipped。
- semver label: `semver:patch` 1 件。
- セルフレビュー（blocking なし）: https://github.com/tsuji-tomonori/rag-assist/pull/420#issuecomment-5000424280
- 受け入れ条件確認: https://github.com/tsuji-tomonori/rag-assist/pull/420#issuecomment-5000492103
- GitHub Apps の callable capability が公開されていないため、PR 操作は `gh` fallback を使用した。
- task/report 完了 commit 後の final-head required CI と Issue #345 証跡は PR / Issue comment に記録する。

## 検証計画

- `npm ci`
- `npx playwright test apps/web/e2e/text-spacing.spec.ts --config apps/web/playwright.config.ts`
- `npm run test:e2e:smoke -w @memorag-mvp/web`
- `npm run test:e2e:all -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run lint`
- `npm run build -w @memorag-mvp/web`
- `task docs:check`
- `git diff --check`
- `pre-commit run --files <changed-files>`

## PR レビュー観点

- text-spacing override の値と computed evidence が WCAG 1.4.12 代表条件を反映しているか。
- visible / DOM 存在だけでなく、代表 control rect と horizontal overflow を検証しているか。
- fixture が production fallback や dataset 固有分岐へ漏れていないか。
- #385/#396/#400/#404/#408/#410/#416 および #373 と責務・production file が重複していないか。
- RAG 根拠性、認可境界、benchmark/QA/dataset 固有分岐を変更していないか。

## リスク

- Playwright で注入する stylesheet は user stylesheet、browser extension、OS accessibility setting の完全再現ではない。
- Chromium 320×720px の代表 journey であり、全 locale/font/browser/device を網羅しない。
- 実 browser zoom、文字のみ拡大、screen reader、real-device、scheduled Firefox/WebKit の実施済み証跡にはしない。
- PR #416 が先に変更された場合、stacked base の再確認が必要になる。
