# Fix API CI after route split

## 背景

PR #181 の MemoRAG CI で API lint と API coverage test が失敗している。

## 目的

API route 分割後の lint / coverage failure を修正し、CI が通る状態へ戻す。

## スコープ

- API lint failure の原因特定と修正
- API coverage test failure の原因特定と修正
- 必要な検証、PR コメント、task 完了更新

## 非スコープ

- API 仕様変更
- coverage 閾値の緩和
- unrelated refactor

## 受け入れ条件

- [x] `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0` が pass する。
- [x] `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 0 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts` が pass する。
- [x] API typecheck と `git diff --check` / pre-commit が pass する。
- [x] PR #181 に修正後の受け入れ条件確認とセルフレビューを投稿する。
- [x] task md を `tasks/done/` に移動し、同じ PR branch に push する。

## 検証計画

- CI と同じ API lint
- CI と同じ API coverage test
- API typecheck
- `git diff --check`
- pre-commit

## 検証結果

- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 0 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`: pass
  - statements: 93.23%
  - branches: 81.46%
  - functions: 94.78%
  - lines: 93.23%
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `pre-commit run --files memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts tasks/do/20260508-0059-fix-api-ci-after-route-split.md reports/working/20260508-0102-fix-api-ci-after-route-split.md`: pass

## PR

- #181: https://github.com/tsuji-tomonori/rag-assist/pull/181
- 受け入れ条件確認コメント投稿済み。
- セルフレビューコメント投稿済み。

## 状態

done
