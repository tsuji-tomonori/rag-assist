# E2E テスト実行手順

## ローカル実行（smoke）

```bash
npm run test:e2e:smoke:local -w @memorag-mvp/web
```

このコマンドは次を順番に実行します。

1. `npx playwright install --with-deps chromium`
2. `npm run test:e2e:smoke`

## 手動で分けて実行する場合

```bash
cd apps/web
npx playwright install --with-deps chromium

cd ../..
npm run test:e2e:smoke -w @memorag-mvp/web
```

## Screen reader semantic contract

`screen-reader-semantics.spec.ts` は Chromium の accessibility tree を CDP 経由で取得し、login / chat / documents / history / favorites / benchmark / profile の代表画面で landmark、form、control の role と accessible name が欠落しないことを検査します。chatではidle→回答処理中→完了に伴うregionのbusy stateと処理中行のpolite live semantics、historyでは並び順comboboxのvalueとお気に入りcheckboxのchecked state、favoritesでは画面・一覧・target type見出しと戻るbutton、benchmarkではsuite・dataset・model・concurrencyのvalueと実行履歴scroll region / table、profileでは送信キーcomboboxのvalueも検証します。各画面の検査時には、検査対象 role、name、value、checked / busy / live state の JSON を Playwright report へ attach します。

新規 semantic contract のみ実行する場合は、repository root で次を実行します。

```bash
npx playwright test apps/web/e2e/screen-reader-semantics.spec.ts --config apps/web/playwright.config.ts
```

この自動テストは、Chromium が支援技術向けに公開する semantic tree の回帰検出です。NVDA、JAWS、VoiceOver 等の実 screen reader での読み上げ・操作の合格証跡には代替しません。また、実 browser の 200% / 400% zoom、touch 操作、real-device、Firefox / WebKit の accessibility mapping は別途検証が必要です。

## Keyboard navigation contract

`keyboard-navigation.spec.ts` は、チャットの質問textboxへのTab到達、composerの3px focus indicator、既定Enterによる送信、処理中から回答への復帰に加え、primary view navigation、履歴、お気に入り、個人設定の代表controlをkeyboard-onlyで検査します。route fixtureはPlaywright内に限定し、本番API・認可・RAG回答を置き換えません。

この自動テストはrequired Chromium keyboard evidenceです。代表screen reader、実browserの200% / 400% zoom、touch / real-device、Firefox / WebKitの手動・browser evidenceは別途必要です。
