# Issue #345 keyboard-only 主要画面ナビゲーション E2E を追加する

状態: done

タスク種別: 機能追加

## 背景

Issue #345 では主要導線を keyboard-only で完了できることが未完了である。PR #381 / #385 は全画面の computed audit、品質 matrix、production UI/CSS remediation を所有しているが、primary navigation を Tab と Enter / Space だけで操作して URL と画面が同期する journey-level 証跡は独立した E2E として固定されていない。

## 目的・対象範囲

current `origin/main` を基準に、SYSTEM_ADMIN が chat / documents / questions / admin / profile の primary navigation を keyboard-only で移動できることを、新規 Playwright spec で検証する。production UI/CSS、PR #381 / #385 の cross-screen audit・quality matrix、認可・API・RAG は変更しない。

## 実行計画

1. 既存 AppShell / RailNav の accessible name、URL、keyboard behavior を確認する。
2. 既存 Playwright config の local API / local auth test mode を使い、実 product data の fallback を追加せず deterministic に画面を起動する。
3. Tab で各 navigation control へ到達し、Enter / Space で操作して URL と対象 view を検証する。
4. 対象 spec、Web typecheck / unit / build、lint、docs freshness を実行する。
5. report、draft PR、semver、AC / self-review、final-head CI、Issue #345 進捗まで完了する。

## ドキュメントメンテナンス計画

既存 `SQ-016` の keyboard acceptance behavior は変更しないため正本文書は更新しない。新しい証跡の所在と、screen reader・実 browser zoom・touch / real-device を代替しない境界を task、report、PR に記録する。generated inventory は production component を変更しないため freshness check だけを行う。

## 受け入れ条件

- [x] 新規 E2E が mouse click を使わず Tab と Enter / Space で primary navigation を操作する。
- [x] chat / documents / questions / admin / profile の各 control が keyboard focus を受け、操作後の URL と画面 heading / region が一致する。
- [x] 既存 local test mode だけを使い、production UI に架空 data / demo fallback を追加しない。
- [x] PR #381 / #385 の変更ファイルと production UI/CSS を変更しない。
- [x] 対象 E2E、Web typecheck / unit / build、lint、docs freshness、required CI と smoke E2E が成功する。
- [x] screen reader、実 browser 200% / 400% zoom、touch / real-device、scheduled Firefox / WebKit は未検証として残す。

## 検証計画

- `npx playwright test e2e/keyboard-navigation.spec.ts --project=chromium`（`apps/web`）
- `npm run typecheck -w @memorag-mvp/web`
- `npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm run lint`
- `npm run docs:web-inventory:check`
- `npm run docs:web-trace:test`
- `git diff --check`
- changed-files pre-commit

## PR レビュー観点

- keyboard 操作が mouse API に依存していないか。
- accessible name と URL / view assertion が利用者の実操作を表しているか。
- fixture が production data path に漏れていないか。
- 自動 E2E を screen reader / real-device の代替証拠として誤記していないか。
- RAG、認可、dataset 固有 production behavior を変更していないか。

## リスク・未検証事項

- local Playwright server は sandbox の listen 制約で起動できない可能性がある。失敗時はコマンド経路を確認し、承認を得た sandbox 外再実行または CI 証跡を用いる。
- representative screen reader、実 browser zoom、touch / real-device は利用可能環境がないため本タスクでは完了扱いにしない。
- PR #381 / #385 取り込み後は、本 spec を同 branch の `@ui-quality` 実行対象として再確認する必要がある。
- manual dispatch の full E2E は branch 21 pass / 7 fail、同一 `main@8a427a24` は 21 pass / 6 fail。共通 6 件は PR #381 / #385 が所有する既存 visual baseline、branch だけの 1 件は既存 route test の非一意 `getByRole('status')` が loading status と競合した timing-sensitive failure である。required smoke job では同 route test と新規 test を含む 16/16 が成功しており、本 task の completion gate は required CI + smoke とする。
