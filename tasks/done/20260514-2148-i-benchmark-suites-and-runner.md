# I-benchmark-suites-and-runner

- 状態: done
- タスク種別: 機能追加
- 作業ブランチ: `codex/phase-i-benchmark-suites-runner`
- ベース: `origin/main`

## 背景

Wave 5 実装として、`docs/spec/gap-phase-i.md` の後続 scope に基づき、benchmark suite / runner / artifact contract の最小実装を行う。別 worker が J2 debug / middleware を並行実施するため、debug/middleware 領域の変更は避ける。

## 目的

現行 JSONL / suite manifest を壊さずに、Phase I の benchmark suite / runner / artifact contract を TS contract・docs・runner output・tests へ反映する。

## Scope

- 主対象: `benchmark/`, benchmark package tests, benchmark artifact/schema helpers
- 必要時のみ: benchmark schema docs, `packages/contract`, API benchmark route/schema
- 明示 scope-out: benchmark 管理画面刷新、async agent benchmark 本実装、本番設定 promotion API、外部 dataset full download / full benchmark、Lambda quota 引き上げ、LLM-as-a-judge 本番 gate 化

## 実装計画

1. `docs/spec/gap-phase-i.md`, `docs/spec/2026-chapter-spec.md`, `docs/spec/CHAPTER_TO_REQ_MAP.md` と既存 benchmark 実装を読む。
2. 現行 artifact / suite manifest と互換な型・schema helper・docs を追加する。
3. agent / search / conversation runner の suite metadata に `useCase`, `runner`, `corpus`, `datasetSource`, `evaluatorProfile` を追加可能にする。
4. `benchmark_grounded_short` を dataset row id ではなく suite profile / metadata で切り替える contract を固定する。
5. baseline / candidate config、case result、failure reason、retrieval / citation / latency / cost、seed / skip manifest を runner artifact として整理する。
6. 変更範囲に応じた benchmark package test/typecheck と diff check を実行する。

## ドキュメント保守計画

- benchmark artifact contract と S3 Vectors metadata budget / Lambda quota は durable docs に反映する。
- API route / permission を変更した場合は access-control policy、API contract、OpenAPI docs も更新する。
- 実装や挙動に影響しない既存 docs には不要な広範囲 rewrite を入れない。

## 受け入れ条件

- [x] 現行 JSONL / suite manifest の互換性を保ち、`BenchmarkSuite`, `BenchmarkCase`, `BenchmarkRun`, `BenchmarkTargetConfig`, `BenchmarkDatasetPrepareRun` に対応する contract / docs が存在する。
- [x] agent / search / conversation runner の suite metadata に `useCase`, `runner`, `corpus`, `datasetSource`, `evaluatorProfile` を明示できる。
- [x] `benchmark_grounded_short` は benchmark metadata / suite profile で切り替わり、通常回答 policy と分離され、RAG runtime に dataset 固有分岐を入れていない。
- [x] baseline / candidate config、case-level result、failure reason、retrieval / citation / latency / cost、seed manifest、skip manifest が artifact contract として整理され、可能な範囲で runner output に含まれる。
- [x] CodeBuild runner の auth fail-fast、token mask、suite input validation、timeout、artifact upload、metrics update を壊していない。
- [x] S3 Vectors metadata budget（2048 bytes / benchmark compact 1500 bytes）と Lambda quota / timeout（15分 / 3008MB）を docs/test か受け入れ条件に残す。
- [x] ChatRAG refusal benchmark の期待語句・拒否期待値、benchmark corpus isolation、BENCHMARK_RUNNER 最小権限境界、secret/signed URL/token 非露出の方針を弱めていない。
- [x] 選定した検証コマンドが pass し、未実施の検証があれば理由を記録する。
- [x] 作業レポート、commit/push、PR 作成、受け入れ条件確認 comment、セルフレビュー comment、task done 移動 commit/push が完了している。

## 完了結果

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/307
- 受け入れ条件確認 comment: posted
- セルフレビュー comment: posted
- 作業レポート: `reports/working/20260514-2210-i-benchmark-suites-runner.md`
- 検証:
  - `npm ci`: pass
  - `npm run typecheck -w @memorag-mvp/benchmark`: pass
  - `npm test -w @memorag-mvp/benchmark`: pass
  - `npm run typecheck -w @memorag-mvp/contract`: pass
  - `git diff --check`: pass

## 検証計画

- `npm run typecheck -w @memorag-mvp/benchmark`
- `npm test -w @memorag-mvp/benchmark`
- `git diff --check`
- API route/schema を触った場合のみ `npm run typecheck -w @memorag-mvp/api` と targeted API tests
- infra を触った場合のみ targeted infra tests

## PR レビュー観点

- docs と実装の同期
- benchmark artifact 互換性
- dataset 固有値の runtime hard-code 不在
- RAG の根拠性・認可境界を弱めていないこと
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと

## リスク

- 既存 runner の artifact 形式が複数あり、互換性を崩すリスクがある。
- 外部 dataset / CodeBuild 本番経路は full 実行しないため、ローカル test で保証できない運用差分は PR body と report に残す。
