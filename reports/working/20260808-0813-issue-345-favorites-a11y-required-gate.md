# Issue #345 favorites accessibility required gate 作業記録

保存先: `reports/working/20260808-0813-issue-345-favorites-a11y-required-gate.md`

## 1. 受けた指示

- current main、前回差分、open PR / Issue、task、正本・生成文書を確認し、Issue #345を重複なく前進させる。
- 320px / 400% zoom、keyboard、screen reader、共通状態、画面からE2Eまでの追跡を優先する。
- 最新mainから分離した作業branchでtask、実装、文書同期、検証、Draft PR、Issueコメントまで進める。
- 未検証・CI待ち・owner判断を完了扱いせず、merge / deploy / release / force-push /破壊的変更を行わない。

## 2. 入力と選定

- current main: `0771521cbe505d3ffeddcbe34deff89f67de8702`
- 更新対象: Draft PR #462、Issue #345
- open PR #461は`FavoritesWorkspace.tsx`のIcon importだけを変更し、今回のE2E・正本・matrixとは重複しない。
- favoritesは`AC-SQ016-002` / `003`だけが画面固有の自動証跡待ちで、production componentを変更せずに閉じられるため今回の小改善に選定した。

## 3. 実施内容

- `E2E-UI-KEYBOARD-NAV-001`へ、お気に入りnavigationのSpace操作、戻るbuttonへのTab到達、3px focus indicator、Enterによるチャット復帰を追加した。
- `E2E-UI-SR-SEMANTICS-001`へ、お気に入りregion / heading、項目一覧・target type見出し、戻るbuttonのChromium AX tree契約とJSON attachmentを追加した。
- favorite fixtureはPlaywright routeへ限定し、production component / API / permission / favorite resume / delete契約を変更していない。
- `SQ-016`、`DES_UI_UX_001`、machine-readable trace / matrix、生成文書、E2E READMEを同じ証跡へ同期した。
- favoritesのautomated statusだけを`pass`へ更新し、manual / overallは`blocked`を維持した。

## 4. 正本基準レビュー

### 判定

- Issue #345 / `SQ-016`全体: **不合格（未完了）**。今回のfavorites automated sliceは追跡可能になったが、manual evidenceと未実装journeyが残るため完了ゲートを満たさない。
- 今回の差分: final-head CI待ちのため**条件付き**。local lint / typecheck / unit / build / docs checksはpassした。

### 前提

- 正本: `REQ_SERVICE_QUALITY_016.md`（Draft、2026-08-08更新）と`DES_UI_UX_001.md`。
- 対象: favoritesの`AC-SQ016-002` / `003` automated evidence、trace、matrix、required Chromium E2E。
- 確認済み: production favorites DOM、E2E specs、authored JSON、generated docs、open PR filenames、task群。
- 未確認: representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKit、final-head CI。

### 重大指摘

| ID | 箇所 | 重大度 | 問題 | 根拠 | 影響 | 修正案 | 確認方法 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REV-345-001 | `SQ-016 / AC-SQ016-008` | Major | required manual evidenceが3 blocked / 1 not_runである | `issue-345-manual-a11y-evidence-baseline.json`の`ready: false` | screen reader、zoom、touch /実機の総合適合を判定できない | 既存manual evidence taskで承認済み環境・支援技術の証跡を取得する | `docs:manual-a11y-evidence:require-pass`と証跡review |
| REV-345-002 | `JOB-UI-FAVORITES` / `FR-028` | Major | favorites一覧からresume / deleteするinteractionは今回の対象外で、主要job全体のkeyboard完了を証明しない | production画面は一覧itemを非interactiveに表示し、戻るbuttonだけを提供する | favorites主要jobの機能・keyboard受け入れが未完了 | ownerが期待journeyを確定し、機能taskで実装・認可・E2Eを追加する | FR-028照合、keyboard / permission / state E2E |
| REV-345-003 | `FR-051` / profile state contract | Major | 永続化と保存失敗・permission・N/A分類がowner判断待ちである | Issue #345と既存taskにopen questionとして記録済み | cross-screen共通状態の完了判定を妨げる | owner判断後に正本とprofile state E2Eを更新する | 正本review、state E2E、final CI |

### 観点別評価

| 観点 | 評価 | 根拠 |
| --- | --- | --- |
| 正本・文書間整合性 | 合格 | `SQ-016`、UI正本、authored JSON、generated docsを同期 |
| 今回のスコープ境界 | 合格 | production・API・認可・未実装journeyを明示的に除外 |
| 要求品質 | 合格 | `AC-SQ016-002` / `003`と観測可能なE2Eを関連付け |
| 技術的実現可能性 | 合格 |既存native control / landmarkとPlaywright route fixtureで実現 |
| automated test可能性 | 条件付き | listing /静的契約はpass、Chromium実走はfinal-head CI待ち |
| manual test可能性 | 不合格 | required manual evidenceが未取得 |
| 総合トレーサビリティ | 不合格 | automated sliceはforward/backward trace可能だがmanualとfavorites主要jobが未完了 |

## 5. 検証

### 実行した検証

- targeted ESLint: pass。
- `npm run lint`: pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`: pass（62 files / 446 tests）。
- `npm run build -w @memorag-mvp/web`: pass（既存chunk-size advisoryのみ）。
- targeted Playwright listing: pass（Chromium 2件）。
- `npm run docs:web-trace:test`: pass（13 tests）。
- `npm run test:web-semantic-ui`: pass（5 tests）。
- canonical docs、generated inventory、OpenAPI、API code docs、manual evidence構造、infra inventory、hidden Unicode、`git diff --check`: pass。

### 未実施・制約

- targeted Chromium E2E実走: blocked。通常のAPI起動はsandboxの`tsx` IPC `listen EPERM`で停止した。`node --import tsx`でAPIを起動した再試行ではPlaywright Chromium executable未導入を確認した。final-head GitHub Actionsで実走確認する。
- manual evidence: 3 blocked / 1 not_run、`ready: false`。自動証跡で代替しない。

## 6. 成果物とfit

- E2E: `apps/web/e2e/keyboard-navigation.spec.ts`、`screen-reader-semantics.spec.ts`。
- 正本・設計: `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`。
- trace / matrix: authored JSONとgenerated Web docs。
- task: `tasks/do/20260808-0813-issue-345-favorites-a11y-required-gate.md`。

総合fit: 4.3 / 5.0（約86%）。

理由: 小さな自動証跡、正本・生成物同期、ローカル検証は完了した。final-head CI、manual screen reader / zoom /実機、favorites主要job、owner判断は未完了であり、Draft / `do`を維持する。

## 7. 禁止事項と残余リスク

- merge、deploy、release、force-push、破壊的変更は実施しない。
- RAG根拠性、認可境界、benchmark dataset、API / storeを変更していない。
- #461統合時はIcon import差分が残るが、今回の変更対象と競合しない。
