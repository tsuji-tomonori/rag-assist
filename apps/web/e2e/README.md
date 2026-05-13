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
