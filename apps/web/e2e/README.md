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

`screen-reader-semantics.spec.ts` は Chromium の accessibility tree を CDP 経由で取得し、login / chat / documents / history / favorites / assignee / benchmark / profile の代表画面で landmark、form、control の role と accessible name が欠落しないことを検査します。chatではidle→回答処理中→完了に伴うregionのbusy stateと処理中行のpolite live semantics、historyでは並び順comboboxのvalueとお気に入りcheckboxのchecked state、favoritesでは画面・一覧・target type見出しと戻るbutton、assigneeではworkspace・一覧・lane・選択中詳細・回答formのlandmarkとfilter value・question pressed・notify checked・polite status、benchmarkではsuite・dataset・model・concurrencyのvalueと実行履歴scroll region / table、profileでは送信キーcomboboxのvalueも検証します。各画面の検査時には、検査対象 role、name、value、checked / pressed / busy / live state の JSON を Playwright report へ attach します。

新規 semantic contract のみ実行する場合は、repository root で次を実行します。

```bash
npx playwright test apps/web/e2e/screen-reader-semantics.spec.ts --config apps/web/playwright.config.ts
```

この自動テストは、Chromium が支援技術向けに公開する semantic tree の回帰検出です。NVDA、JAWS、VoiceOver 等の実 screen reader での読み上げ・操作の合格証跡には代替しません。また、実 browser の 200% / 400% zoom、touch 操作、real-device、Firefox / WebKit の accessibility mapping は別途検証が必要です。

## Keyboard navigation contract

`keyboard-navigation.spec.ts` は、チャットの質問textboxへのTab到達、composerの3px focus indicator、既定Enterによる送信、処理中から回答への復帰に加え、primary view navigation、履歴、お気に入り、担当者対応、個人設定の代表controlをkeyboard-onlyで検査します。担当者対応ではステータス絞り込み・検索・問い合わせ選択・回答入力・通知切替・一時保持と3px focus indicatorを検証します。route fixtureはPlaywright内に限定し、本番API・認可・RAG回答を置き換えません。

PRでは`login-keyboard.spec.ts`、`keyboard-navigation.spec.ts`、`cross-browser-semantics.spec.ts`、`cross-browser-state.spec.ts`、`zoom-reflow.spec.ts`、`layout-stress.spec.ts`をFirefox／WebKitのrequired gateとして実行します。semantic testはlogin / chat / profile / assignee / documents / admin / history / favorites / benchmarkのname・role・value・stateをPlaywright ARIA snapshotと同一browser project内のDOM ARIA属性で検証します。chatのbusy / live、profileのvalue / polite status、assigneeのpressed / checked / polite status、documentsのselected / expanded、adminのcurrent / filter / polite status、historyのquery / sort / checked、favoritesのgroup / item label / access cue、benchmarkのsuite / dataset / model / concurrency valueとhistory scroll region / tableを対象にします。state testは履歴のloading→500→retry→confirmed empty／HTTP 403、文書画面のloading→部分500→retry→confirmed empty／全resource HTTP 403、担当者対応とお気に入りのloading→500→retry→confirmed empty／HTTP 403、チャットのinitial→processing→SSE timeout→Last-Event-ID retry→recovered answer／HTTP 500／chat:create不足を区別し、false zero、未確認カンバン、private detail露出、未許可送信を防ぎます。reflow testは1280px基準の200%相当（640 CSS px）／400%相当（320 CSS px）でchatからdocuments / assignee / admin / profileへ到達し、document rootの水平overflowがないことを検証します。content-extreme testは320pxとreduced motionで長文回答、長い引用・ファイル名、履歴35件、確認済みお気に入り0件の表示とroot／regionの水平containmentを検証します。snapshot / state / reflow / content-extreme JSONにはbrowser project名とevidence boundaryを含めてartifactへ添付します。限定cross-browser scopeだけをローカルで列挙・実行する場合は、repository rootで次を実行します。

```bash
npm run test:e2e:cross-browser:required -w @memorag-mvp/web -- --list
npm run test:e2e:cross-browser:required -w @memorag-mvp/web
```

週次／手動dispatchのFirefox／WebKit visual accessibility scopeは`test:e2e:cross-browser`として別に維持します。このkeyboard / ARIA snapshot / DOM state / resource state / CSS viewport reflow / content-extreme fixture自動証跡は、代表screen reader、browser UIを操作する実200% / 400% zoom、text-only zoom、OS scaling、touch / real-device、Firefox／WebKit native accessibility treeのengine固有debug出力、ならびに対象外画面の網羅検証を代替しません。
