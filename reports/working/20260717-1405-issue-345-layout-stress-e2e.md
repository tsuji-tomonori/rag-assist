# Issue #345 reduced-motion / layout stress E2E 作業レポート

保存先: `reports/working/20260717-1405-issue-345-layout-stress-e2e.md`

## 1. 受けた指示

- PR #408 final head を起点に、reduced-motion と長文・長いファイル名・多数件/0件の代表 layout stress を自動 E2E evidence 化する。
- Issue #358 FR-019、Issue #359、既存 #345 PR と重複しない専用 worktree/task で進める。
- 実 browser zoom、screen reader、real-device の代替を主張しない。
- Draft stacked PR、semver、日本語 AC/セルフレビュー、task/report lifecycle、initial/final CI、Issue #345、clean/upstream まで完遂する。
- merge / deploy / release は行わない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | reduced-motion 時の代表挙動を自動証跡化 | 高 | 対応 |
| R2 | 長文・長いファイル名・多数件・0件を320pxで検証 | 高 | 対応 |
| R3 | root/対象領域の幅と fixture 条件を JSON 化 | 高 | 対応 |
| R4 | #358/#359/既存 #345 PR と非重複 | 高 | 対応 |
| R5 | 自動証跡の限界を明記 | 高 | 対応 |
| R6 | stacked PR lifecycle と両 head CI | 高 | initial 完了、final は lifecycle commit 後に確認 |

## 3. 検討・判断したこと

- #358 FR-019 は benchmark summary / observation producer、#359 は構造リファクタであり、production を変更しない独立 E2E spec は非重複と判断した。
- reduced-motion は media query の成立だけでなく、chat の実装契約である `scrollIntoView({ behavior: "auto" })` を観測する。
- stress fixture は E2E 内の route interception に隔離し、production UI fallback や架空 product state を追加しない。
- 長文 chat、documents 長名、history 35件、favorites 0件を代表条件とし、全 locale / 件数 / browser の網羅とは扱わない。
- test-only evidence 追加で製品挙動・API・要件意味・運用手順を変えないため README / `docs/` / generated inventory 更新は不要と判断し、`task docs:check` で確認した。

## 4. 実施した作業

- PR #408 final head `4b581a60` から専用 worktree / branch を作成した。
- `apps/web/e2e/layout-stress.spec.ts` を追加した。
- 320px / reduced-motion で長文 answer、長い citation/document file name、history 35件、favorites 0件を検証した。
- `scrollIntoView` の `behavior`、root/region width、URL/view、fixture 件数・文字数を JSON attachment に含めた。
- 初回対象 test は text 末尾断片へ過度に結合して 1件 fail した。message target の class と `behavior: auto` の直接条件へ修正し 2/2 pass を確認した。

## 5. 検証

- `npm ci`: pass（audit 8 件: low 2 / moderate 1 / high 5）
- 対象 Playwright: 初回 1/2 fail → 観測条件修正後 2/2 pass
- required smoke: 19/19 pass
- full E2E: 31/31 pass
- Web typecheck: pass
- repository lint: pass
- `task docs:check`: pass
- `git diff --check`: pass
- pre-commit: pass

## 6. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/web/e2e/layout-stress.spec.ts` | TypeScript | reduced-motion / layout stress E2E と JSON evidence | R1〜R5 |
| `tasks/done/20260717-1354-issue-345-layout-stress-e2e.md` | Markdown | AC・検証・リスク・stacked lifecycle | R1〜R6 |
| `reports/working/20260717-1405-issue-345-layout-stress-e2e.md` | Markdown | 作業と fit の記録 | R1〜R6 |

## 7. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.8/5 | E2E、local validation、Draft PR、initial CI は完了 |
| 制約遵守 | 5/5 | 非重複、test-only、非代替、禁止操作を維持 |
| 成果物品質 | 4.5/5 | 代表条件は機械可読だが browser/device 全網羅ではない |
| 説明責任 | 5/5 | 初回 fail、境界、audit、未検証を明記 |
| 検収容易性 | 4.8/5 | AC、JSON evidence、PR/CI 証跡を対応付けた |

**総合 fit: 4.8/5（約96%）**

理由: 実装、local validation、Draft stacked PR、initial CI は完了した。final head CI と Issue コメントは lifecycle commit 後の off-repo 証跡として残るため。

## 8. 未対応・制約・リスク

- Draft stacked PR #410 を #408 branch 向けに作成し、implementation head `69c3bf47` の required CI run 29556582461 が success した。
- PR metadata 上 `semver:patch` が唯一の semver label であることを確認した。`validate-semver-label.yml` は `branches: [main]` のため stacked base では非適用であり、未起動を success とは扱わない。
- 受け入れ条件とセルフレビューを日本語 top-level comment に記録した。final head CI と Issue #345 コメントは完了報告前に off-repo 証跡として記録する。
- 制約: 320px Chromium と deterministic E2E fixture の代表条件であり、全 locale / 文字列 / 件数 / browser を網羅しない。
- リスク: reduced-motion は chat scroll behavior の代表証跡であり、全 CSS animation を証明しない。
- 未検証: 実 browser zoom、文字のみ拡大、browser chrome、OS scaling、DPR、representative screen reader、real-device、scheduled Firefox / WebKit。
- dependency: `npm ci` は既知の audit 8 件を報告したが、本 task は dependency 非変更のためスコープ外。
- 禁止操作: merge / deploy / release は実施していない。
