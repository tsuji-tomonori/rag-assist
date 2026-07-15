# Mobile navigation visual baseline の責務を限定する

状態: done

タスク種別: 修正

## 背景

PR #350 を latest `main` へ再統合後、`npm run test:e2e:smoke -w @memorag-mvp/web` の `E2E-UI-NAV-002` が、期待画像 320x720 に対して実画像 320x805 となり失敗した。13件中12件は成功し、navigation overlay の expected / actual は目視上同一だった。

## 目的・対象範囲

Mobile navigation の visual regression が、検証対象外の背後コンテンツ高さに影響されず、navigation region 自体の表示退行だけを検出するようにする。production UI/API/RAG/認可は変更しない。

## なぜなぜ分析

### 問題文

2026-07-15、PR #350 worktree の Chromium smoke で、320px mobile navigation visual assertion が page 高さ差 85px と 2% pixel mismatch で失敗した。

### 確認済み事実

- expected は 320x720、actual は 320x805。
- expected / actual の navigation overlay は同じ位置・項目・focus/current表示だった。
- diff は overlay 背後の chat suggestion / composer 領域に集中した。
- test は navigation 契約を検証する一方、`page.toHaveScreenshot(..., { fullPage: true })` で全画面を撮影していた。
- Web coverage 338件、typecheck、build、docs check は成功した。

### 因果ツリー

- 直接原因: navigation test が page 全体を snapshot 対象にし、背後 content の高さ・内容も比較した。
- 流出原因: PR CI は Playwright smoke を required check として実行せず、branch 再統合時まで不整合を検出しなかった。
- 局所要因: visual assertion の対象 locator が navigation region ではなく `page` だった。
- 根本原因: test の観測境界が受け入れ契約（mobile navigation）より広く、無関係な画面状態へ結合していた。
- 未確認仮説: 実ブラウザ固有のfont/render差。今回の画像差は背後 content で説明できるため主原因とは扱わない。

### 対策

- `navigation[aria-label="モバイル画面"]` を visual assertion 対象にして責務を限定する。
- scoped baseline を生成し、expected / actual / diff を目視する。
- 対象 test、smoke 全件、Web coverage、docs check を再実行する。
- automated quality gate task では Playwright smoke の PR required 化を別途扱う。

## 実行計画

1. visual assertion を mobile navigation locator に限定する。
2. 対応 baseline を意図的に更新して目視確認する。
3. 対象 test と smoke 全件を再実行する。
4. 変更範囲に応じた coverage/typecheck/build/docs を確認する。

## ドキュメントメンテナンス計画

製品 behavior と正規要件は変えないため canonical docs 更新は不要。task と作業レポートに test-boundary 修正を記録する。

## 受け入れ条件

- [x] navigation visual assertion が背後の chat content を比較対象に含めない。
- [x] scoped snapshot が320px mobile navigation の全項目、current、focus表示を保持する。
- [x] `E2E-UI-NAV-002` と smoke 全件が成功する。
- [x] Web coverage 85% branch gate、typecheck、build、docs check が成功する。
- [x] production UI/API/RAG/認可、benchmark/dataset/no-mock 境界を変更しない。

## 実施結果

- full-page visual assertion を `.mobile-navigation-panel` の scoped assertion へ変更した。
- snapshot時だけpanel背景を不透明化し、背後chat contentの高さ・内容を比較対象から除外した。
- expected画像は全destination、current/focus、個人設定を含むことを目視確認した。
- 検証結果とsandbox外実行理由は `reports/working/20260715-1529-mobile-navigation-visual-scope.md` に記録した。
- PR #350 の受け入れ条件確認コメント: https://github.com/tsuji-tomonori/rag-assist/pull/350#issuecomment-4977702973
- latest head `f55f9472` の MemoRAG CI run `29394821679` と semver run `29394821714` は success。

## 検証計画

- `npm run test:e2e:smoke -w @memorag-mvp/web`
- `npm run test:coverage -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `task docs:check`
- `git diff --check`

## PR レビュー観点

- snapshot 更新が navigation region の責務限定だけであること。
- product implementation や authorization boundary に差分がないこと。

## 未決事項・リスク

- representative screen reader、実機、実browser zoom は本修正の対象外で、既存 manual evidence task を維持する。
- PR required E2E gate は `tasks/todo/20260714-issue-345-ui-automated-quality-gates.md` の対象である。
