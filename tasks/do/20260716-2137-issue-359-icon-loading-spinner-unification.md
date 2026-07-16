# Issue #359 Phase 3b Icon / LoadingSpinner primitive 一本化

- 状態: do
- タスク種別: 修正
- 対象 issue: #359 Phase 3b
- 起点: PR #373 final head `fab8471c2cd8fdb17d1478393ad6e7ae7213cd98`
- 作業ブランチ: `codex/issue-359-icon-loading-spinner-unification`
- worktree: `.worktrees/issue-359-icon-loading-spinner`
- 依存順: PR #367 → PR #373 → 本タスク PR
- 親タスク: `tasks/done/20260716-2136-issue-359-confirm-dialog-unification.md`

## 背景

ConfirmDialog 一本化の参照調査で、Icon / LoadingSpinner の production entry が `shared/components` に残っている。shared primitive の正本 layer が分かれると、export、a11y contract、generated inventory、consumer の import 境界が再び分岐するため、ConfirmDialog とは独立した stacked PR で `shared/ui` へ収束する。

## 目的

Icon / LoadingSpinner の全実装・export・consumer・CSS・test を調査し、`shared/ui` を唯一の production entry として互換 API を維持したまま全参照を張り替える。legacy path の再導入を静的 guard で拒否し、No Mock と accessibility contract を回帰 test で固定する。

## 対象範囲

- `apps/web/src/shared/components/Icon.tsx`
- `apps/web/src/shared/components/LoadingSpinner.tsx`
- `apps/web/src/shared/ui/index.ts`
- Icon / LoadingSpinner の全 production consumer / unit test
- legacy path guard / semantic contract
- generated Web inventory / accessibility docs
- task / report / stacked PR lifecycle

## 対象外

- ConfirmDialog と既存 product behavior の再変更
- icon artwork、spinner animation / visual redesign、CSS token 再設計
- API、認証・認可、RAG、benchmark evaluator / dataset behavior
- mock / demo fallback の追加
- PR #367 / #373 の merge、merge / deploy / release

## 実装前の参照 graph

```text
shared/components/Icon.tsx
└─ 27 production files
   ├─ app shell 2
   ├─ admin / agents / benchmark / favorites / history / questions
   ├─ chat presentation / actions
   ├─ debug panel
   └─ documents workspace

shared/components/LoadingSpinner.tsx
├─ LoadingSpinner: 15 production files
├─ LoadingStatus: admin / agents / benchmark / documents / questions の5 workspaces
└─ raw decorative spinner duplicate: DebugPanelBody / DebugPanelFooter の2箇所

styles/layout.css
├─ .loading-spinner / .loading-status / .button-spinner
└─ reduced-motion rule

styles/features/debug.css
└─ debug status spinner size

generated Web inventory
└─ shared/components の Icon / LoadingSpinner implementation と Icon interaction を記録
```

- distinct production consumer: 32 files
- 既存 primitive 単体 test: なし
- 既存 integration evidence: root `LoginPage.test.tsx` が pending button 内 spinner を確認

## preserve / migrate / delete 分類

| 対象 | 分類 | 方針 |
| --- | --- | --- |
| Icon name union / SVG path / `.icon-*` class | preserve | DOM と artwork を変更せず `shared/ui/Icon.tsx` へ移動 |
| Icon decorative contract | preserve + test | `aria-hidden=true` を維持し、icon-only button は親の accessible name を使用 |
| LoadingSpinner props / CSS class | preserve | label ありは named `role=status`、なしは decorative として維持 |
| LoadingStatus props / live region | preserve + test | visible label、`role=status`、`aria-live=polite`、`aria-busy=true` を維持 |
| 32 consumer import | migrate | `shared/ui/Icon.js` / `shared/ui/LoadingSpinner.js` の正本 path へ変更 |
| Debug panel raw spinner 2箇所 | migrate | DOM contract が同じ decorative `LoadingSpinner` へ置換 |
| `shared/ui/index.ts` | merge | value export と `IconName` type export を追加 |
| `shared/components/Icon.tsx` / `LoadingSpinner.tsx` | delete | legacy path guard で不在と import 禁止を固定 |
| CSS | preserve | class / animation / reduced-motion を変更しない |
| generated inventory | regenerate | implementation path と component classification を同期 |

## open PR 競合調査

| PR | 直接重複 | 対応 |
| --- | --- | --- |
| #338 | `ChatComposer.tsx` の import 行、generated Web docs | primitive import のみ変更。generated docs は同期必須のため競合リスクを PR に明記 |
| #361 | Web package / Playwright config、chat / documents / questions CSS、visual spec | CSS / E2E source は編集せず既存 test を実行利用 |
| #368 | `LoginPage.tsx`、`RailNav.tsx` | primitive import 行のみ変更し、auth / navigation behavior は変更しない |
| #373 | strict base | final head を起点にした stacked dependency として明記 |

## 受け入れ条件

- [x] Icon / LoadingSpinner の実装、barrel export、production consumer、CSS、test、generated inventory の全参照 graph を task に記録する。
- [x] preserve / migrate / merge / delete の分類と互換 API を実装前に定義する。
- [x] `shared/ui` が Icon / LoadingSpinner の唯一の production entry となり、全 production consumer が barrel または正本 path を利用する。
- [x] `shared/components/Icon*` / `shared/components/LoadingSpinner*` が存在せず、legacy import / 再導入を静的 guard が拒否する。
- [x] Icon の既存 name / decorative contract、LoadingSpinner / LoadingStatus の既存 role / accessible name / visible status を互換のまま維持する。
- [x] decorative icon の `aria-hidden`、icon-only button の accessible name、loading の status/name を unit / semantic test で固定する。
- [x] ConfirmDialog を含む既存 product behavior、permission boundary、RAG 根拠性、benchmark behavior を変更しない。
- [x] production 値は props / API / state / config 由来で、mock / demo fallback を追加しない。
- [x] generated Web inventory / accessibility metadata が正本 path と現在の参照に同期する。
- [ ] targeted unit、Web full coverage、typecheck、build、semantic / inventory / trace、関連 Playwright E2E が成功する。
- [x] `task docs:check`、root `npm run ci`、変更ファイル限定 pre-commit、`git diff --check` が成功する。
- [ ] 作業レポート、日本語 commit / draft stacked PR、`semver:patch`、受け入れ条件コメント、セルフレビュー、task done、latest-head GitHub CI success を完了する。

## Done 条件

- deliverables: `shared/ui` 正本、全 consumer 移行、legacy guard、a11y regression tests、generated inventory、task/report
- validations: targeted → Web full → semantic/inventory/trace → Playwright → docs/root CI → pre-commit/diff check → GitHub CI
- lifecycle: PR #367 → #373 依存を明記した main 向け draft stacked PR、日本語受け入れ確認 / セルフレビュー、task done
- completion: blocking / should-fix 指摘なし。未実施検証と残余リスクを明記し、merge / deploy / release は行わない

## 実施計画

1. 全参照 graph、API、CSS、test、generated inventory を調査して分類を記録する。
2. a11y と legacy path の regression test / guard を先に固定する。
3. implementation を `shared/ui` へ移し、barrel export と全 consumer import を更新する。
4. generated inventory を同期し、No Mock / product behavior / conflict scope を監査する。
5. Web / Playwright / docs / root validation を実行し、失敗時は修復・再実行する。
6. report、commit、push、draft stacked PR、受け入れ / self-review、task done、latest-head CI まで完遂する。

## 検証記録

- `npm ci`: 成功（504 packages）。`npm audit` 由来の既存 8 vulnerabilities（low 2 / moderate 1 / high 5）は自動修正していない。
- `npm test -w @memorag-mvp/web -- src/shared/ui/Icon.test.tsx src/shared/ui/LoadingSpinner.test.tsx`: 成功（2 files / 3 tests）。
- `npm run typecheck -w @memorag-mvp/web`: 成功。
- `npm run test:web-semantic-ui`: 成功。
- `task docs:web-inventory`: 成功。
- `task docs:web-inventory:check`: 成功。
- `task docs:web-trace:test`: 成功。
- `npm run build -w @memorag-mvp/web`: 成功。既存の 500 kB 超 chunk warning のみ。
- `npm run test:coverage -w @memorag-mvp/web`: 成功（63 files / 449 tests、statements 90.87%、branches 85.81%、functions 90.72%、lines 93.62%）。
- `task docs:check`: 成功。
- `npm run ci`: 成功（API 801 / Web 449 / Infra 38 / Benchmark 102、全 build 成功）。
- `pre-commit run --files <changed-files>`: 成功（git-secrets、hidden Unicode、whitespace、large file、merge conflict、mixed line ending）。
- `git diff --check`: 成功。
- local Playwright: `npx playwright test e2e/visual-regression.spec.ts --grep 'E2E-UI-(SEMANTIC-001|NAV-002|STATE-001)'` は test 開始前に `listen EPERM: operation not permitted /tmp/tsx-1000/224.pipe` で webServer 起動不能。権限昇格は行わず、push 後に既存 GitHub Actions `e2e.yml` の smoke / full E2E で代替する。
- manual screen reader / 実機確認: 未実施。既存 semantic E2E、axe、mobile navigation、loading state の GitHub E2E を自動回帰 evidence とする。

## 最終監査（PR 前）

- production source の legacy import と raw `<span className="loading-spinner">` は 0 件。legacy path 文字列は task / historical report / ENOENT guard の説明・検証用途だけに残る。
- `Icon.tsx` / `LoadingSpinner.tsx`、Debug panel 置換箇所に mock / demo / fixture / fallback はない。
- CSS は未変更。`LoginPage.tsx`、`RailNav.tsx`、`TopBar.tsx` を含む consumer は import 行だけを変更し、auth / navigation / product behavior は変更していない。
