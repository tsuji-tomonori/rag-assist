# Issue #345 screen reader semantic contract E2E

- 状態: done
- タスク種別: 機能追加
- 関連 Issue: #345

## 背景

Issue #345 では representative screen reader の手動証跡が未完了である。PR #381/#385 の cross-screen axe/layout/visual gate と PR #396 の keyboard-only navigation E2E は別の品質軸を自動化しているが、ブラウザが支援技術へ公開する accessibility tree の名前・role 契約は独立した release gate として固定されていない。

## 目的

Chromium が生成する accessibility tree を使い、login / chat / documents の代表導線で主要 role、accessible name、form、landmark が支援技術向けツリーから欠落しないことを自動検出する。

## スコープ

- `apps/web/e2e/screen-reader-semantics.spec.ts` に Chromium accessibility tree の contract E2E を追加する。
- `apps/web/e2e/README.md` に実行手順、自動証跡の範囲、manual evidence との境界を追加する。
- 本番 UI / CSS / API / auth / permission / RAG は変更しない。

## 実装計画

1. CDP `Accessibility.getFullAXTree` の必要最小ヘルパーを E2E ファイル内に閉じる。
2. login の heading / form / textbox / button を検査する。
3. サインイン後の main / chat region / question form / controls を検査する。
4. documents 遷移後の region / complementary landmarks / named controls を検査する。
5. README にテストが manual screen reader を代替しないことを明記する。

## ドキュメント保守計画

- E2E 実行手順と証跡の解釈が変わるため `apps/web/e2e/README.md` を同じ変更単位で更新する。
- 製品挙動・要件本文は変更しないため、正本 `docs/` の要件変更は不要と判断する。

## 受け入れ条件

- [x] AC1: login の heading、named form、email/password textbox、submit button が Chromium accessibility tree で検出できる。
- [x] AC2: サインイン後の main、chat region、named question form、question/send controls が Chromium accessibility tree で検出できる。
- [x] AC3: documents 遷移後の workspace region、folder tree、document list の semantic contract が Chromium accessibility tree で検出できる。
- [x] AC4: 新規 E2E を単体と required smoke で実行し、pass を確認する。
- [x] AC5: README が、自動 semantic contract は manual screen reader、実 browser 200%/400% zoom、touch/real-device 証跡の代替ではないと明記する。
- [x] AC6: Web typecheck / lint / docs check / `git diff --check` が pass する。
- [x] AC7: draft PR の implementation head で required CI と semver label validation が success する。task lifecycle final head は push 後に再確認する。

## 検証計画

- `npm ci`
- `npx playwright test apps/web/e2e/screen-reader-semantics.spec.ts --config apps/web/playwright.config.ts`
- `npm run test:e2e:smoke -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run lint`
- `task docs:check`
- `git diff --check`

## PR レビュー観点

- DOM 存在だけでなく Chromium accessibility tree の role / name を検査しているか。
- browser 固有 CDP の範囲を明記し、manual screen reader 合格に読み替えていないか。
- #381/#385/#396 の既存差分や本番 UI を取り込んでいないか。
- RAG 根拠性、認可境界、benchmark dataset 固有分岐に影響しないか。

## リスク

- Chromium accessibility tree は NVDA / JAWS / VoiceOver 等の実際の読み上げを再現しない。manual evidence は Issue #345 の未完了項目として残す。
- Firefox / WebKit の accessibility mapping は Chromium CDP test の対象外。
- optional full E2E の既存 baseline failure は、新規テストと required smoke の成否と分離して報告する。

## 検証結果

- `npm ci`: pass。8 vulnerabilities（2 low / 1 moderate / 5 high）を既存 dependency audit 情報として確認。
- `npx playwright test apps/web/e2e/screen-reader-semantics.spec.ts --config apps/web/playwright.config.ts`: sandbox で `tsx` IPC listen `EPERM` のため停止後、承認済みの sandbox 外再実行で 1/1 pass。
- `npm run test:e2e:smoke -w @memorag-mvp/web`: sandbox 外で 16/16 pass。
- `npm run test:e2e:all -w @memorag-mvp/web`: optional full E2E を sandbox 外で 28/28 pass。この branch / base で baseline failure なし。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm run lint`: pass。
- `task docs:check`: pass。
- `git diff --check`: pass。

## 未検証

- representative screen reader の実読み上げ・操作。
- 実 browser 200% / 400% zoom。
- touch / real-device。
- scheduled Firefox / WebKit。

## PR lifecycle

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/400
- semver: `semver:patch`
- Implementation head: `0c5b23e9b17ef1ec6f2611674527c93f2630d5a2`
- MemoRAG CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29548185261 success
- Validate Semver Label: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29548196966 success
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/400#issuecomment-4998222065
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/400#issuecomment-4998222740
- task lifecycle final head の required CI は本 file を `tasks/done/` へ移動した commit の push 後に再確認する。
