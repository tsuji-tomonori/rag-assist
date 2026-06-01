# REST/oRPC/OpenAPI schema equivalence と API lifecycle registry を強化する

保存先: `tasks/todo/20260516-1618-api-contract-lifecycle-hardening.md`

## 状態

- todo

## タスク種別

- 機能追加

## 背景

Phase J1 で runtime OpenAPI source、generated Markdown stale gate、代表 oRPC route drift check、`x-memorag-lifecycle` の最小 metadata は実装済み。ただし全 REST endpoint と全 oRPC procedure の schema equivalence、breaking change 判定、削除予定日、利用状況監視を含む lifecycle registry は未実装で残っている。

## 目的

API 契約差分をより網羅的に検出し、互換 API の deprecation / replacement / removal policy を機械可読に管理する。

## 対象範囲

- `apps/api/src/openapi-contract-drift.ts`
- `apps/api/src/openapi-doc-quality.ts`
- `packages/contract/src/`
- `docs/generated/openapi*`
- API lifecycle docs

## 実行計画

1. REST endpoint と oRPC procedure の対応表を拡張する。
2. request/response schema equivalence の比較範囲を定義する。
3. breaking / additive / deprecated / compatibility の分類を lifecycle registry に追加する。
4. removal target、replacement、migration note、usage monitoring hook を metadata 化する。
5. CI/docs check で lifecycle metadata 不足を検出する。

## 受け入れ条件

- 対応済み REST/oRPC use case で request/response schema drift を検出できる。
- deprecated/compatibility API は lifecycle registry または OpenAPI extension から追跡できる。
- breaking change の疑いがある差分は docs check または test で fail する。
- generated OpenAPI Markdown は runtime OpenAPI から再生成され、手編集されない。
- 利用状況監視未実装の範囲は PR 本文で未対応として明記される。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/openapi-runtime-source.test.ts`
- `npm run test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`
- `npm run docs:openapi:check`
- `git diff --check`

## PRレビュー観点

- generated docs を手編集していないか。
- schema equivalence の false positive / false negative が許容範囲か。
- lifecycle metadata が互換 API の運用判断に足る粒度か。

## 関連

- `docs/spec/gap-phase-j1.md` `J1-REM-001`, `J1-REM-002`
- `tasks/done/20260514-1959-j1-openapi-runtime-source.md`
