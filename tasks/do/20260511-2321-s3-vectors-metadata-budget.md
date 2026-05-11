# S3 Vectors metadata budget 修正

状態: in_progress

## 背景

`architecture-drawing-qarag-v0.1` の benchmark corpus seed で、図面用の大きな構造化 metadata が chunk ごとの S3 Vectors filterable metadata に載り、AWS 側の `Filterable metadata must have at most 2048 bytes` 制限に抵触した。

## 目的

benchmark corpus ingest に渡す metadata を小さな filter 用 metadata に限定し、S3 Vectors 直前で filterable metadata の byte budget を fail fast で検査できるようにする。

## タスク種別

修正

## なぜなぜ分析サマリ

- confirmed: prepare は `datasetRows=82 corpusFiles=8` まで成功し、BUILD の corpus seed 中に `s01-...pdf` の ingest run が failed になった。
- confirmed: 直接エラーは S3 Vectors の `Invalid record ... Filterable metadata must have at most 2048 bytes`。
- confirmed: `benchmark/corpus.ts` は `.metadata.json` 由来の `input.metadata` を document ingest metadata に spread している。
- confirmed: `apps/api/src/rag/memorag-service.ts` は `input.metadata` から `filterableMetadata` を作り、chunk metadata に spread して S3 Vectors に渡している。
- inferred: `drawingSheetMetadata`、`drawingRegionIndex`、`drawingReferenceGraph` が chunk ごとに filterable metadata として複製され、2048 bytes 制限を超えた。
- root cause: 検索フィルタ用の小さな metadata と、評価・図面理解用の大きな rich metadata を同じ ingest metadata として扱った設計混同。
- remediation: benchmark 側で rich metadata を upload metadata から除外し、API 側に filterable metadata budget check を追加して、同種の問題を AWS 呼び出し前に検出する。
- open_question: rich metadata の artifact 化は別途設計余地がある。今回は benchmark 復旧に必要な metadata compact 化と fail fast を優先する。

## スコープ

- `memorag-bedrock-mvp/benchmark/corpus.ts`
- `memorag-bedrock-mvp/benchmark/corpus.test.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- 関連 API / benchmark test
- 関連 README / docs の同期

## 実施計画

1. benchmark corpus upload metadata から巨大な図面 rich metadata を除外する。
2. S3 Vectors へ渡す filterable metadata の byte size check を追加する。
3. 対象 regression test を追加・更新する。
4. README / OPERATIONS の説明を実装に合わせて更新する。
5. targeted test と `git diff --check` を実行する。

## 受け入れ条件

- [x] `drawingSheetMetadata`、`drawingRegionIndex`、`drawingReferenceGraph` が benchmark document ingest metadata に含まれない。
- [x] `drawingSourceType` など小さな filter 用 metadata は維持される。
- [x] filterable metadata が 2048 bytes を超える場合、API 側で vector key、実 byte 数、上位 field size を含むエラーになる。
- [x] 変更範囲に対応する test が追加または更新され、targeted test が pass する。
- [x] 関連 docs が実装と矛盾しない。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- corpus.test.ts`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- memorag-service.test.ts`
- `git diff --check`

## 実行した検証

- `npm ci` (`memorag-bedrock-mvp`): pass。初回 test が `tsx: not found` で失敗したため依存関係を導入。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- corpus.test.ts`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/adapters/s3-vectors-store.test.ts src/rag/memorag-service.test.ts`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。

## 未実施

- `npm run codebuild:run -w @memorag-mvp/benchmark`: 未実施。AWS / CodeBuild / S3 Vectors 環境に依存するため、ローカルでは targeted regression と typecheck で検証した。

## PR レビュー観点

- S3 Vectors filterable metadata の 2048 bytes 制限に対して fail fast が機能すること。
- benchmark seed metadata の認可・検索 filter に必要な値が欠落していないこと。
- rich drawing metadata の評価用情報を vector metadata に重複保存しないこと。
- docs と実装の同期。

## リスク

- `drawingSheetMetadata` 等を upload metadata として API document record に残すユースケースがあった場合、別 artifact 化が必要になる。
- full CodeBuild benchmark は外部 AWS / network / credential に依存するため、ローカル targeted test では完全代替できない可能性がある。
