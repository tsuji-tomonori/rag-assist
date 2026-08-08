# Issue #345 reduced-motion / layout stress E2E

- 状態: done
- タスク種別: 機能追加
- 関連 Issue: #345
- Stacked base: PR #408 final head `4b581a60d24430557dae4eae5359471a6ef75546`

## 背景

Issue #345 には reduced-motion と代表的な layout stress の自動証跡が残る。PR #408 は 1280px 基準 200% / 400% 相当の reflow proxy、既存 PR #381/#385/#396/#400/#404 は responsive/visual/axe、keyboard、AX tree、touch activation を担当する。一方で、reduced-motion 時の chat scroll behavior、長文、長いファイル名、多数件、0件を一つの機械可読 evidence として確認する独立 gate はない。

Issue #358 の FR-019 は benchmark summary / observation producer の品質指標、Issue #359 は構造リファクタが責務であり、本 task は production 実装や benchmark を変更しない新規 Playwright spec に限定する。

## 目的

320px viewport と `prefers-reduced-motion: reduce` で、長文 chat response、長い document file name、35件の history、0件の favorites が root 水平 overflow を起こさず、reduced-motion 時の新着 message scroll が `auto` を選ぶことを自動検出する。

## スコープ

- `apps/web/e2e/layout-stress.spec.ts` を新規追加する。
- local E2E API の対象 endpoint だけを test fixture で差し替え、production UI fallback は追加しない。
- chat の長文 answer と長い citation file name、documents の長い file name、history 35件、favorites 0件を代表 stress とする。
- motion preference、scroll behavior、fixture 件数/文字数、root/対象領域の幅、URL/到達 view を JSON evidence として添付する。
- production UI / CSS / API / auth / permission / RAG / benchmark / dependency は変更しない。

## 実装計画

1. test 起動前に `scrollIntoView` を観測し、reduced-motion 時の `behavior` を証跡化する。
2. 対象 API response を deterministic fixture へ差し替える。
3. 320px で chat の長文回答と長い citation file name を表示し、marker と overflow を検査する。
4. documents / history / favorites へ遷移し、長名・多数件・0件の表示契約と overflow を検査する。
5. case 全体を JSON attachment に残す。

## ドキュメント保守計画

- test-only の evidence 追加で製品挙動、API、要件意味、運用コマンドを変更しないため、README / `docs/` / generated inventory は更新不要と判断する。
- `task docs:check` で正本、trace、generated freshness を検証する。

## 受け入れ条件

- [x] AC1: 320px で `prefers-reduced-motion: reduce` が成立し、新着 chat message の `scrollIntoView` が `behavior: auto` を選ぶ。
- [x] AC2: 長文 chat answer の先頭/末尾 marker と長い citation file name が表示され、root と chat region に水平 overflow がない。
- [x] AC3: documents で長い file name が実データ由来で表示され、root と documents region に水平 overflow がない。
- [x] AC4: history 35件の件数・先頭/末尾項目が表示され、root と history region に水平 overflow がない。
- [x] AC5: favorites 0件が明示的 empty state として表示され、root と favorites region に水平 overflow がない。
- [x] AC6: motion preference / scroll behavior / fixture 件数・文字数 / root・region 幅 / URL・view を JSON evidence に添付する。
- [x] AC7: 対象 E2E、required smoke、full E2E、Web typecheck、repository lint、docs check、diff check、pre-commit が pass する。
- [x] AC8: PR #408 branch 向け Draft stacked PR の implementation/final head required CI と semver validation が success する。

## 検証計画

- `npm ci`
- `npx playwright test apps/web/e2e/layout-stress.spec.ts --config apps/web/playwright.config.ts`
- `npm run test:e2e:smoke -w @memorag-mvp/web`
- `npm run test:e2e:all -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run lint`
- `task docs:check`
- `git diff --check`
- `pre-commit run --files <changed-files>`

## 検証結果（implementation head 作成前）

- `npm ci`: pass（548 packages、既知の audit 8 件: low 2 / moderate 1 / high 5）
- 対象 Playwright 初回: 1/2 fail。`scrollIntoView` 対象の末尾 text 断片に回答 marker が残るという過剰な観測条件を、`message-row` class と `behavior: auto` の直接条件へ修正した。
- 対象 Playwright 修正後: pass（2/2）
- required smoke: pass（19/19）
- full E2E: pass（31/31）
- Web typecheck: pass
- repository lint: pass
- `task docs:check`: pass
- `git diff --check`: pass
- pre-commit: pass

## PR lifecycle

- Draft stacked PR: #410
- Base: `codex/issue-345-zoom-reflow-e2e`（Draft PR #408）
- implementation head: `69c3bf47efe9a8e5418c51a37e00f2a3db75798c`
- initial required CI: GitHub Actions run 29556582461 success
- semver: PR metadata で `semver:patch` が唯一の semver label であることを確認
- `validate-semver-label.yml`: `branches: [main]` のため stacked base では非適用。未起動を success とは扱わない
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/410#issuecomment-4999234102
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/410#issuecomment-4999234965
- task lifecycle final head の required CI と唯一 semver label は、完了報告前に再確認して PR / Issue コメントへ記録する。

## PR レビュー観点

- fixture は E2E 内に隔離され、production fallback / mock UI を追加していないか。
- long text / long file name / many / zero が marker・件数・empty state で実質検証されているか。
- overflow を root だけでなく対象 region でも測定しているか。
- reduced-motion は media query の成立だけでなく `scrollIntoView` behavior まで検証しているか。
- #358 FR-019 の benchmark producer、#359 の refactor、既存 #345 PR の責務を変更していないか。
- RAG 根拠性、認可境界、benchmark dataset 固有分岐を弱めていないか。

## リスク

- 320px Chromium + mocked endpoint の代表 stress であり、全 locale / 全文字列 / 全件数を網羅しない。
- reduced-motion の本 gate は chat scroll behavior と media preference の代表証跡であり、全 CSS/animation を証明しない。
- 実 browser zoom、文字のみ拡大、browser chrome、OS scaling、DPR、representative screen reader、real-device、scheduled Firefox / WebKit は代替しない。
- PR #408 が先に変更された場合、stacked base の再確認が必要になる。
