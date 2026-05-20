# PR329 runtime layout review 指摘対応

状態: done

タスク種別: 修正

## 背景

PR #329 の再レビューで、既存 RAG 実装の runtime layout 移設が進んだ一方、`MemoRagService.ingest()` と root `rag/*.ts` に実処理が残り、新 layout 側には `export {}` だけの空 module が多数残っていると指摘された。

## 目的

「既存 RAG 実装を新しい runtime/pipeline 構成へ再配置した」と言える状態に近づけ、production code が旧 flat shim を直接 import しないこと、空 placeholder module を production tree に残さないこと、公開 contract が placeholder として見えないことをテストで固定する。

## なぜなぜ分析サマリ

- confirmed: `MemoRagService` は旧 `../search/hybrid-search.js`、`./chunk.js`、`./prompts.js` などを import し、`ingest()` 内で extraction、chunking、embedding、vector put、manifest 作成を実行している。
- confirmed: `apps/api/src/rag/**` には `export {}` だけの空 module が多数存在する。
- confirmed: `packages/contract/src/index.ts` は `./rag/index.js` を root export しているが、一部 contract は id/version 中心の placeholder に見える。
- inferred: 前回対応では descriptor 検出と一部 shim 化に検証が寄り、旧 root 実装、production import、空 module、公開 contract の placeholder を検出する回帰テストが不足していた。
- root cause: layout 移設の完了条件が「新 path が存在すること」「旧 path が一部 shim であること」に偏り、実装本体の所在と公開 API 化の妥当性を強制するテストが不足していた。
- remediation: ingestion pipeline と prompt/context/profile/json 実装を新 layout へ移し、root は shim 化する。空 module は削除する。contract は今回の API 移設 scope から外して root export を削除する。これらを runtime-layout test と contract package test で固定する。

## スコープ

- `apps/api/src/rag` の runtime layout 移設追加修正
- `packages/contract` の RAG contract placeholder 公開抑止とテスト追加
- 必要に応じた web / benchmark placeholder の scope 整理
- PR コメント用の受け入れ条件確認・セルフレビュー

## 実装計画

- `MemoRagService.ingest()` の実処理を `offline/pre-retrieval/ingestion/ingest-run.service.ts` へ移し、service は委譲だけにする。
- `prompts.ts`、`context-assembler.ts`、`profiles.ts`、`json.ts` の実装を新 layout へ移し、旧 root は re-export shim にする。
- `apps/api/src/rag/**` の `export {}` だけの空 module を削除する。
- `runtime-layout.test.ts` に production import、root shim、empty placeholder、ingest delegation の回帰テストを追加する。
- `packages/contract/src/index.ts` の RAG root export を外し、contract package の test script と placeholder 検出 test を追加する。

## ドキュメント保守計画

- `apps/api/src/rag/README.md` の説明と実態に差分が出る場合のみ更新する。
- `docs/` の要件や API 仕様を変える作業ではないため、原則更新しない。理由は作業レポートに記録する。

## 受け入れ条件

- production code が旧 RAG compatibility shim path を import しないことを単体テストで検証している。
- old flat RAG root files は shim または削除であり、`MemoRagService` 以外に root 実装が残っていないことを単体テストで検証している。
- `MemoRagService.ingest()` が offline ingest service へ委譲しており、chunking/vector put を直接実行していないことを単体テストで検証している。
- `apps/api/src/rag/**` の production module に `export {}` だけの空 module が残らないことを単体テストで検証している。
- `packages/contract/src/rag` を root export しない、または placeholder contract がないことを単体テストで検証している。
- 指定コマンド `npm test -w @memorag-mvp/api` と `npm run typecheck -w @memorag-mvp/api` が pass する。
- contract scope を変更した場合、`npm test -w @memorag-mvp/contract` と `npm run typecheck -w @memorag-mvp/contract` が pass する。

## 検証計画

- `git diff --check`
- `npm test -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/contract`
- `npm run typecheck -w @memorag-mvp/contract`

## PR レビュー観点

- runtime layout の実装本体が新 path に存在し、旧 root は互換 shim に限られているか。
- placeholder を削除したことで import 切れや package export の矛盾がないか。
- 未実施の検証を PR コメントやレポートで実施済みとしていないか。

## リスク

- 空 module 削除により typecheck 対象の import が壊れる可能性がある。
- `MemoRagService` から ingestion を分離する際、private helper の移設漏れで manifest/vector metadata の互換性が崩れる可能性がある。

## 完了結果

- `MemoRagService.ingest()` を `offline/pre-retrieval/ingestion/ingest-run.service.ts` へ委譲した。
- root `rag/*.ts` の残実装を新 layout へ移し、旧 root は shim 化した。
- `apps/api/src/rag/**` の `export {}` だけの空 module を削除した。
- `packages/contract/src/index.ts` から RAG placeholder contract の root export を削除した。
- `apps/web/src/features/rag/**` と `benchmark/src/rag/**` の placeholder を scope 外として削除した。
- PR #329 に受け入れ条件確認コメントとセルフレビューコメントを投稿した。
- CI の API coverage step が branch coverage `84.99%` で閾値 `85%` を下回ったため、移設先 shared policy / context packing の回帰テストを追加した。

## 実行した検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/__tests__/runtime-layout.test.ts`: fail -> root shim regex 修正後 pass
- `npm test -w @memorag-mvp/api`: fail -> runtime-layout test 修正後 pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm test -w @memorag-mvp/contract`: pass
- `npm run typecheck -w @memorag-mvp/contract`: pass
- `npm run docs:web-inventory:check`: fail -> `npm run docs:web-inventory` で更新後 pass
- `npm test -w @memorag-mvp/benchmark`: pass
- `npm run typecheck -w @memorag-mvp/benchmark`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `git diff --check`: pass
- `gh run watch 26167206188 --exit-status --interval 10`: fail。理由: API lint で `MemoRagService` の未使用 helper 2 件を検出。
- `npm run lint`: fail 後修正して pass。補足: API workspace 単体には `lint` script がないため root lint で確認。
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`: fail。理由: tests は pass したが branch coverage が `84.99%` で閾値 `85%` 未満。
- `./node_modules/.bin/tsx --test apps/api/src/rag/__tests__/runtime-layout.test.ts`: shared policy / context packing test 追加後 pass
- `npm run typecheck -w @memorag-mvp/api`: shared policy / context packing test 追加後 pass
- `npm run lint`: shared policy / context packing test 追加後 pass
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`: pass。結果: statements `92.73%`, branches `85.04%`, functions `92.37%`, lines `92.73%`。
