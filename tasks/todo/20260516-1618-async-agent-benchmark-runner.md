# async agent benchmark runner と成果物品質指標を追加する

保存先: `tasks/todo/20260516-1618-async-agent-benchmark-runner.md`

## 状態

- todo

## タスク種別

- 機能追加

## 背景

Benchmark contract には `BenchmarkUseCase=async_agent_task` と `BenchmarkRunner=async_agent` が予約され、Phase G で async agent 実行基盤と provider は追加された。一方で async agent runner / suite manifest / metrics は未実装で、Phase I/G の scope-out として残っている。

## 目的

非同期エージェントの成果物品質、writeback safety、timeout、cost、artifact redaction を評価できる benchmark runner と suite を追加する。

## 対象範囲

- `benchmark/`
- `packages/contract/src/schemas/benchmark.ts`
- async agent run API / artifact API
- benchmark suite manifest
- benchmark artifact contract docs

## 実行計画

1. async agent benchmark case schema と suite manifest を定義する。
2. provider configured / not configured / timeout / failure の評価を分ける。
3. artifact quality、redaction、writeback candidate safety、latency/cost を metrics 化する。
4. benchmark corpus isolation と ACL 境界を維持する。
5. runner artifact に provider、model、policy、redaction summary を残す。

## 受け入れ条件

- async agent benchmark suite を runner から実行できる。
- provider 未設定時は mock 成果物を作らず not configured として評価される。
- artifact に secret、signed URL、権限外ファイル内容が含まれないことを検証できる。
- benchmark corpus isolation と BENCHMARK_RUNNER 権限境界が維持される。
- dataset 固有分岐を本番 async agent 実装へ入れない。

## 検証計画

- `npm run typecheck -w @memorag-mvp/benchmark`
- `npm test -w @memorag-mvp/benchmark`
- `npm run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts`
- `task benchmark:sample`
- `git diff --check`

## PRレビュー観点

- benchmark runner が本番 provider 設定や secret を漏らしていないか。
- async agent 実装に benchmark row 固有の分岐が混入していないか。
- writeback safety を評価する場合、実 writeback を無承認で実行していないか。

## 関連

- `docs/spec/gap-phase-g.md`
- `docs/spec/gap-phase-i.md`
