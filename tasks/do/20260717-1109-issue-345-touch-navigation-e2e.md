# Issue #345 touch navigation E2E

- 状態: do
- タスク種別: 機能追加
- 関連 Issue: #345

## 背景

Issue #345 では touch / real-device 証跡が未完了である。PR #381/#385 は axe・responsive・visual・target audit、PR #396 は keyboard-only navigation、PR #400 は Chromium accessibility tree を自動化したが、touch-enabled mobile context で主要導線を実際に `tap()` する release gate はない。

## 目的

320px mobile Chromium の touch-enabled context で、login から mobile menu を経由して主要な許可済み AppView と個人設定へ到達でき、実際に使用する touch target が 24×24 CSS px を下回らないことを自動検出する。

## スコープ

- `apps/web/e2e/touch-navigation.spec.ts` の新規追加のみを製品検証差分とする。
- local auth のサインイン、mobile menu 開閉、documents / assignee / admin / profile 遷移を `tap()` で検証する。
- 本番 UI / CSS / API / auth / permission / RAG / benchmark は変更しない。
- PR #381/#385/#396/#400 の変更ファイルを取り込まない。

## 実装計画

1. test 単位で 320×720、`isMobile: true`、`hasTouch: true` の context を定義する。
2. `navigator.maxTouchPoints` と `(pointer: coarse)` で touch proxy context が有効なことを確認する。
3. login input/button と mobile menu/navigation controls を `tap()` で操作する。
4. 使用した interactive target ごとに bounding box が 24×24 CSS px 以上であることを検査する。
5. URL、対象 region、`aria-current` で遷移結果を検証する。

## ドキュメント保守計画

- 製品挙動・コマンド・要件を変更せず、E2E 名と受け入れ条件で既存要件の証跡を追加するため、README / `docs/` / generated inventory の更新は不要と判断する。
- `task docs:check` でその判断と freshness を確認する。

## 受け入れ条件

- [x] AC1: E2E context で `navigator.maxTouchPoints > 0` かつ `(pointer: coarse)` が true になる。
- [x] AC2: login 入力と submit を touch `tap()` で行い、chat へ到達できる。
- [x] AC3: mobile menu から documents / assignee / admin / profile を touch `tap()` で遷移でき、URL・region・`aria-current` が同期する。
- [x] AC4: 操作した login / mobile menu / navigation target が 24×24 CSS px 以上である。
- [x] AC5: 新規 E2E 単体と required smoke が pass する。
- [x] AC6: Web typecheck / repository lint / docs check / `git diff --check` / pre-commit が pass する。
- [ ] AC7: draft PR implementation head で required CI / semver validation が success し、task lifecycle final head で再確認する。

## 検証計画

- `npm ci`
- `npx playwright test apps/web/e2e/touch-navigation.spec.ts --config apps/web/playwright.config.ts`
- `npm run test:e2e:smoke -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run lint`
- `task docs:check`
- `git diff --check`
- `pre-commit run --files <changed-files>`

## PR レビュー観点

- pointer/mouse `click()` ではなく touch-enabled context の `tap()` で導線を検証しているか。
- 寸法検査を real-device 合格や物理サイズの証跡に読み替えていないか。
- permission は実 API の判定を保ち、UI が認可を代替していないか。
- RAG 根拠性、benchmark 期待語句、dataset 固有 production 分岐に影響しないか。

## リスク

- Playwright `hasTouch` / `isMobile` は browser automation proxy であり、物理端末の OS・browser chrome・DPR・タッチ精度・支援技術を再現しない。real-device は未検証のまま残す。
- 24×24 CSS px は WCAG 2.2 AA target size の自動回帰値であり、spacing exception や物理寸法の完全な評価ではない。
- representative screen reader、実 browser 200% / 400% zoom、scheduled Firefox / WebKit は未検証。

## 検証結果

- `npm ci`: pass。既存 dependency audit は 8 vulnerabilities（2 low / 1 moderate / 5 high）。
- `npx playwright test apps/web/e2e/touch-navigation.spec.ts --config apps/web/playwright.config.ts`: 初回は `個人設定` を `<nav>` 内と誤認した test locator で fail。mobile panel parent scope へ修正後、1/1 pass。
- `npm run test:e2e:smoke -w @memorag-mvp/web`: sandbox 外で 16/16 pass。
- `npm run test:e2e:all -w @memorag-mvp/web`: sandbox 外で 28/28 pass。現 branch / base で optional baseline failure なし。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm run lint`: pass。
- `task docs:check`: pass。
- `git diff --check`: pass。

## 未検証

- touch / real-device の物理端末証跡。
- representative screen reader の実読み上げ・操作。
- 実 browser 200% / 400% zoom。
- scheduled Firefox / WebKit。
