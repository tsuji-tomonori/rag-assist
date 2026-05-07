# Benchmark reset documents before performance test

保存先: `tasks/do/20260507-1203-benchmark-reset-documents.md`

## Background

性能テスト実施時に、過去に登録された資料が残ったままだと検索・回答結果や latency が実行履歴に依存する。毎回同じ前提で測定できるよう、性能テスト前に資料を削除し、対象ファイルを再アップロードしてチャンク化・indexing 完了後に測定を開始する必要がある。

## Purpose

性能テスト実行ごとに document corpus を初期化し、過去資料の混入を防いだ再現可能な benchmark 前提を作る。

## Scope

- `memorag-bedrock-mvp` の benchmark runner / corpus seed 処理
- 必要に応じた benchmark unit test
- benchmark 実行手順の durable docs
- 作業レポート、commit、PR、PR コメント

## Plan

1. 既存 benchmark runner と corpus seed / upload / delete API の構造を確認する。
2. 性能テスト開始前に、benchmark が管理する過去資料を削除する処理を追加する。
3. 削除後に対象 corpus を再アップロードし、チャンク化・indexing 完了済みであることを既存の upload 応答または manifest から確認してから測定に進める。
4. 削除または再アップロード失敗時は benchmark を中断し、古い資料で測定を継続しない。
5. benchmark test と必要な docs を更新する。
6. targeted validation、作業レポート、commit、PR、受け入れ条件コメント、セルフレビューコメントまで行う。

## Documentation Maintenance Plan

- benchmark の前提や実行手順に関する README / docs を `rg` で確認する。
- コマンドや運用手順が変わる場合は最小限の durable docs を更新する。
- API contract 自体を変えない場合、API examples / OpenAPI は更新不要とする。

## Acceptance Criteria

- [x] AC1: 性能テスト実行のたびに、過去の benchmark 管理資料が削除される。
- [x] AC2: 削除後、対象 corpus ファイルが再アップロードされる。
- [x] AC3: チャンク化・indexing 完了後に性能測定が開始される。
- [x] AC4: 削除・アップロード・チャンク化失敗時、古いデータで性能テストが継続されない。
- [x] AC5: 測定値がセットアップ込みではなく検索・回答測定であること、または違いが docs / report に明記される。
- [x] AC6: 変更範囲に対応する targeted test / smoke が実行され、未実施の検証は理由が明記される。

## Validation Plan

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- 必要に応じて `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- 実行環境が揃う場合は `task benchmark:sample`

## Validation Results

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts src/authorization.test.ts src/contract/api-contract.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `API_BASE_URL=http://localhost:18793 task benchmark:sample`: pass
- `API_BASE_URL=http://localhost:18793 task benchmark:search:sample`: pass

## Implementation Summary

- `seedBenchmarkCorpus` が corpus seed 前に同じ `BENCHMARK_CORPUS_SUITE_ID` の isolated benchmark seed 文書を削除するよう変更した。
- `BENCHMARK_RUNNER` が `benchmarkSeed` / `docType: benchmark-corpus` / `aclGroups: ["BENCHMARK_RUNNER"]` の文書だけ削除できるよう、既存 `DELETE /documents/{documentId}` の認可を scoped に拡張した。
- benchmark / API contract / static access-control test と README / verification docs を更新した。

## PR Review Points

- benchmark 固有の expected phrase / row id / dataset 固有分岐を production path に入れていないこと。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark setup の失敗時に stale corpus で測定しないこと。
- docs と実装の前提が同期していること。

## Risks

- 外部 API や remote benchmark 環境では削除 API の権限・対象範囲に依存する。
- 削除対象を広げすぎると通常利用者の資料を削除するリスクがあるため、benchmark 管理 metadata / ACL に限定する。

## 状態

in_progress
