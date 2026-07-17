# Issue #345 zoom reflow proxy E2E

- 状態: do
- タスク種別: 機能追加
- 関連 Issue: #345

## 背景

Issue #345 では実 browser 200% / 400% zoom の手動証跡が未完了である。PR #381/#385 は 320/375/768/1280px の cross-screen responsive/layout/axe/visual、PR #396 は keyboard-only、PR #400 は Chromium AX tree、PR #404 は 320px touch activation を担当する。1280px 物理幅相当を 200% / 400% に拡大したときの CSS viewport に対応する 640px / 320px を明示的に reflow evidence として扱う gate はない。

## 目的

1280px 基準の 200% / 400% zoom に対応する 640px / 320px CSS viewport で、最大権限 persona が主要許可画面と個人設定へ到達でき、各画面の document root が水平に overflow しないことを自動検出する。

## スコープ

- `apps/web/e2e/zoom-reflow.spec.ts` の新規追加のみを製品検証差分とする。
- 200% proxy = 640px、400% proxy = 320px で login→chat、mobile menu→documents / assignee / admin / profile を検証する。
- 各 state で `document.documentElement.scrollWidth <= clientWidth` を検査する。
- 倍率、CSS viewport、root client/scroll width、到達 AppView を JSON evidence として Playwright report へ attach する。
- 本番 UI / CSS / API / auth / permission / RAG / benchmark は変更しない。

## 実装計画

1. 1280px 基準の zoom 比率と CSS viewport の対応を test case に明示する。
2. 各 case で viewport を設定し、`window.innerWidth` と算出倍率を検査する。
3. local admin persona でサインインし、mobile menu から主要 view へ遷移する。
4. 各遷移後に URL、region、root overflow を検査する。
5. case ごとの検証値を JSON attachment に残す。

## ドキュメント保守計画

- 既存要件の自動証跡追加であり、製品挙動・コマンド・要件の意味は変更しない。そのため README / `docs/` / generated inventory の更新は不要と判断する。
- `task docs:check` で正本・trace・generated freshness を確認する。

## 受け入れ条件

- [x] AC1: 1280px 基準の 200% / 400% に対応する CSS viewport が 640px / 320px であることを test で固定する。
- [x] AC2: 両方の viewport で login→chat、mobile menu→documents / assignee / admin / profile へ到達できる。
- [x] AC3: chat と各到達 view で root `scrollWidth <= clientWidth` が成立する。
- [x] AC4: zoom比率・viewport・client/scroll width・到達 view を JSON evidence として Playwright report へ attach する。
- [x] AC5: 新規 E2E と required smoke が pass する。
- [x] AC6: Web typecheck / repository lint / docs check / `git diff --check` / pre-commit が pass する。
- [ ] AC7: draft PR implementation head で required CI / semver validation が success し、task lifecycle final head で再確認する。

## 検証計画

- `npm ci`
- `npx playwright test apps/web/e2e/zoom-reflow.spec.ts --config apps/web/playwright.config.ts`
- `npm run test:e2e:smoke -w @memorag-mvp/web`
- `npm run test:e2e:all -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run lint`
- `task docs:check`
- `git diff --check`
- `pre-commit run --files <changed-files>`

## 検証結果（implementation head 作成前）

- `npm ci`: pass（548 packages、既知の audit 8 件: low 2 / moderate 1 / high 5）
- `npx playwright test apps/web/e2e/zoom-reflow.spec.ts --config apps/web/playwright.config.ts`: pass（2/2）
- `npm run test:e2e:smoke -w @memorag-mvp/web`: pass（17/17）
- `npm run test:e2e:all -w @memorag-mvp/web`: pass（29/29）
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run lint`: pass
- `task docs:check`: pass
- `git diff --check`: pass
- `pre-commit run --files <changed-files>`: pass

## PR レビュー観点

- 200% / 400% と CSS viewport の対応を明示し、単な任意幅テストになっていないか。
- root overflow を各到達 view で検査し、chat だけで合格にしていないか。
- CSS viewport proxy を実 browser zoom・文字のみ拡大・browser chrome の合格証跡に読み替えていないか。
- #381/#385/#396/#400/#404 の差分や本番 code を取り込んでいないか。
- RAG 根拠性、認可境界、benchmark dataset 固有分岐に影響しないか。

## リスク

- 640px / 320px CSS viewport は reflow の自動 proxy であり、実 browser の zoom control、文字のみ拡大、browser chrome、OS スケーリング、DPR を再現しない。
- 400% proxy の 320px は既存 responsive/touch gate と viewport は同じだが、本 gate は 1280px 基準の zoom 対応と全到達 view の root overflow evidence を責務とする。
- representative screen reader、real-device、scheduled Firefox / WebKit は未検証。
