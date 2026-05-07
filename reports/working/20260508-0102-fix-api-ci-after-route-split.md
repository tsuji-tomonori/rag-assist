# Fix API CI after route split

## 受けた指示

- PR #181 の MemoRAG CI で API lint と API coverage test が失敗しているため、競合解消後の CI failure を修正する。

## 要件整理

- `apps/api` の lint failure を原因特定して修正する。
- coverage 閾値は緩和しない。
- route 分割の構造や API 挙動を不要に変更しない。
- 修正後に API lint、API coverage test、API typecheck、差分チェック、pre-commit を確認する。

## 検討・判断

- API lint failure は `benchmark-seed.ts` の `@typescript-eslint/consistent-type-imports` 指摘で、型としてのみ使う import が通常 import になっていたことが原因だった。
- API coverage test はローカルの CI 同等コマンドでは pass し、coverage も statements/functions/lines の閾値を満たしていたため、coverage 用の実装修正は不要と判断した。

## 実施作業

- `memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts` の `z` と schema 型 import を type-only import に修正した。
- CI failure 対応用 task を `tasks/do/20260508-0059-fix-api-ci-after-route-split.md` に作成した。

## 成果物

- API lint failure の原因修正。
- CI failure 対応 task。
- 本作業レポート。

## 検証

- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 0 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`: pass
  - statements: 93.23%
  - branches: 81.46%（閾値 0）
  - functions: 94.78%
  - lines: 93.23%
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `pre-commit run --files memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts tasks/do/20260508-0059-fix-api-ci-after-route-split.md`: pass

## Fit 評価

- lint failure は最小変更で解消した。
- coverage failure はローカルで再現せず、CI 同等コマンドが pass することを確認した。
- API 仕様、認可境界、route 構成には追加変更を入れていない。

## 未対応・制約・リスク

- GitHub Actions 上の再実行結果は、この時点では未確認。
