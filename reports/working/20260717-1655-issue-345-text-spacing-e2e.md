# Issue #345 text-spacing override proxy E2E 作業完了レポート

## 受けた指示

Issue #345 の残存項目から既存 PR と重複しない最小 bounded unit を選び、worktree、task、実装・検証、Draft stacked PR、lifecycle、final-head CI まで継続する。実 OS / real-device 証跡を proxy で代替せず、merge / deploy / release は行わない。

## 要件整理

- open Draft PR #373 と重複する ConfirmDialog keyboard E2E は除外した。
- 既存 #385 / #396 / #400 / #404 / #408 / #410 / #416 が扱っていない WCAG 1.4.12 代表 text-spacing override を対象にした。
- 320×720px Chromium で login → chat → documents を操作し、代表 control の水平 containment と root / region の horizontal overflow を検査する。
- computed spacing、viewport、URL、width、control rect を JSON evidence として残す。
- stylesheet 注入は proxy に限定し、user stylesheet、browser setting、screen reader、real device、実 browser/text-only zoom の証跡とは扱わない。

## 検討・判断

- standalone E2E 1 本に閉じ、production UI / CSS / API / auth / permission / RAG / benchmark / dependency は変更しなかった。
- 初回対象 E2E は同名の「ドキュメントを追加」button 2 個による locator strict error で失敗した。title 付き toolbar button を特定して再実行し pass した。product defect や overflow failure ではない。
- repository lint は E2E 追加で TypeScript default project 対象が 8 件から 9 件となり、typescript-eslint の既定上限で失敗した。件数上限の引き上げでは再発するため、E2E 専用 `tsconfig.json` を追加して project 所属を明示し、E2E glob を `allowDefaultProject` から削除した。
- E2E 専用 project は従来の inferred project 境界を保つため `noUncheckedIndexedAccess` / `noImplicitOverride` のみ無効化し、`strict` と typed ESLint 規則は維持した。RCA は task 本文へ実装前に追記した。
- README、`docs/`、API 例、運用手順、`AGENTS.md` は、要件・production behavior・API・運用を変えない test/lint project 構成のため更新不要と判断した。`task docs:check` で正本と generated freshness を確認した。

## 実施作業・成果物

- `apps/web/e2e/text-spacing.spec.ts`
  - WCAG 1.4.12 代表値を stylesheet で注入
  - computed ratio、login/chat/documents journey、control rect、root/region width を検証
  - `text-spacing-320px.json` evidence attachment と proxy boundary を記録
- `apps/web/e2e/tsconfig.json`
  - Web E2E を専用 TypeScript project へ所属
- `eslint.config.mjs`
  - E2E の default-project fallback を削除
- `tasks/done/20260717-1634-issue-345-text-spacing-e2e.md`
  - 受け入れ条件、軽量 RCA、実装時検証結果を記録

## 検証結果

- `npm ci`: pass（lockfile 変更なし。npm audit summary は 2 low / 1 moderate / 5 high）
- `npx playwright test apps/web/e2e/text-spacing.spec.ts --config apps/web/playwright.config.ts`: 1/1 pass
- `npm run test:e2e:smoke -w @memorag-mvp/web`: 21/21 pass
- `npm run test:e2e:all -w @memorag-mvp/web`: 33/33 pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npx tsc -p apps/web/e2e/tsconfig.json --noEmit`: pass
- `npm run lint`: pass（初回 failure を修復後に再実行）
- `npm run build -w @memorag-mvp/web`: pass（500 kB 超 chunk warning は継続）
- `task docs:check`: pass
- `git diff --check`: pass
- changed-files pre-commit: pass
- Draft stacked PR #420 implementation head `36736d64` の required CI run `29564787095`: success。promotion gate は条件どおり skipped
- `semver:patch` label 1 件、セルフレビュー blocking なし、受け入れ条件確認 comment を記録

## PR / CI / comment 証跡

- Draft stacked PR: https://github.com/tsuji-tomonori/rag-assist/pull/420
- base: PR #416 branch `codex/issue-345-viewport-keyboard-proxy` / `4706ce69e3230cf20ef68b1d11cc66f862d05da7`
- implementation head: `36736d64a2d971ecb0da7bbe4f13c2afae444daf`
- required CI run `29564787095`: success（`Lint, type-check, test, build, and synth`）。promotion gate は条件どおり skipped
- semver label: `semver:patch` 1 件
- セルフレビュー（blocking なし）: https://github.com/tsuji-tomonori/rag-assist/pull/420#issuecomment-5000424280
- 受け入れ条件確認: https://github.com/tsuji-tomonori/rag-assist/pull/420#issuecomment-5000492103
- GitHub Apps の callable capability が公開されていないため、PR 操作は `gh` fallback を使用
- task/report 完了 commit 後の final-head required CI と Issue #345 証跡は PR / Issue comment に記録する

## 指示への fit 評価

| 観点 | 評価 | 根拠 |
|---|---:|---|
| 既存 PR との非重複 | 20/20 | #373 の dialog unit を除外し、未カバーの text spacing に限定した。 |
| bounded scope | 20/20 | E2E 1 本と lint project 所属修復に限定し、production behavior を変更していない。 |
| 検証可能性 | 20/20 | computed value、rect、overflow、journey、JSON evidence を検証する。 |
| proxy 境界の正直さ | 20/20 | test / task / report で real device・AT・実 zoom へ読み替えないと明記した。 |
| lifecycle | 18/20 | Draft stacked PR、implementation CI、semver、self-review、AC comment、task done を完了。final-head CI と Issue comment はこの commit 後の外部証跡として確認する。 |
| 合計 | 98/100 | repository 成果物と implementation lifecycle は適合。final-head 外部 gate 成功後に完了報告する。 |

## 未対応・制約・リスク

- user stylesheet / browser extension / OS accessibility setting / screen reader / real device / 実 browser zoom / text-only zoom は未実施であり、本 proxy の pass で代替しない。
- Firefox / WebKit は scheduled lane の境界にあり、今回のローカル検証では未実施。
- npm audit の既存 8 件と Web build の既知 chunk-size warning は本 unit で変更していない。
- final-head required CI と Issue #345 進捗 comment は、この task/report 完了 commit 後に off-repo 証跡として記録する。
- merge / deploy / release は行わない。
