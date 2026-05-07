# 構造化 ingestion v2 の blue-green reindex benchmark gate

保存先: `tasks/todo/20260507-2000-ingestion-bluegreen-benchmark-gate.md`

## 状態

- todo

## 背景

`DocumentBlock` による ingestion v2 は RAG 品質改善の本命だが、chunk 数、index version、citation metadata、OCR confidence の変更は retrieval 品質と latency に大きく影響する。rag-assist には再インデックス、blue-green 切替、benchmark、debug trace の導線があるため、v1 と v2 の比較を gate 化してから切り替える必要がある。

## 目的

structured ingestion v2 を blue-green reindex で旧 index と比較し、table QA、citation support、refusal、安全性、latency が基準を満たす場合だけ切り替えられる benchmark gate を作る。

## 対象範囲

- reindex / index manifest / cutover API
- benchmark runner / search benchmark
- table QA benchmark suite
- debug trace / report output
- operations docs
- rollback 手順

## 方針

- `parserVersion`、`chunkerVersion`、`indexVersion` を manifest と benchmark report に残す。
- blue index と green index の同一 corpus / 同一 evaluator profile 比較を前提にする。
- 改善判定は table QA の `retrievalRecall@20`、citation page / table / row hit、citation support pass rate、refusal precision/recall、`no-access leak`、`p95 latency` を見る。
- OCR low confidence を含む row では、回答が断定を避けるか、確認質問 / 回答不能へ倒れることを確認する。
- gate は benchmark expected phrase 固有の最適化を許容しない。
- 関連 task `DocumentBlock による構造化 ingestion v2` の完了後に着手する。

## 必要情報

- 関連 task: `tasks/todo/20260507-2000-document-block-ingestion-v2.md`
- 関連 task: `tasks/todo/20260507-2000-rag-baseline-evaluation-set.md`
- 既存 reindex / blue-green 切替 API。
- 既存 benchmark runner と debug trace。

## 実行計画

1. 現行 reindex / cutover / rollback flow と manifest schema を確認する。
2. `parserVersion`、`chunkerVersion`、`indexVersion` を benchmark report に追加する。
3. v1 index と v2 index を同一 corpus で並走比較できる runner option を追加する。
4. table QA 専用 benchmark rows を追加する。
5. page / table / row citation hit を evaluator に追加する。
6. OCR confidence 由来の限定回答 / 回答不能判定を benchmark に追加する。
7. regression gate と pass / fail report を実装する。
8. operations docs に cutover、rollback、再実行、失敗時対応を追記する。

## ドキュメントメンテナンス計画

- 要求仕様: benchmark gate、blue-green cutover、rollback、RAG 品質安全性に関係する `FR-*`、`SQ-*`、`NFR-*`、`TC-*` を確認する。
- architecture / design: Reindex、Index manifest、Benchmark Runner、Debug Trace、Citation validation の design docs を更新する。
- operations: blue-green reindex の事前条件、実行手順、合格条件、失敗時 rollback、artifact 保存先を必ず更新する。
- local verification: local / mock 環境で比較可能な最小手順を追加する。
- PR 本文: 実行した benchmark、未実施の実 AWS reindex、latency の測定環境を明記する。

## 受け入れ条件

- v1 index と v2 index の `parserVersion`、`chunkerVersion`、`indexVersion` を report で比較できる。
- table QA の `retrievalRecall@20` が baseline から改善または非劣化である。
- citation が page / table / row まで戻れることを benchmark で確認できる。
- OCR low confidence を含む根拠で断定回答しないことを検証できる。
- `no-access leak = 0` を維持している。
- `p95 latency` が定義した許容範囲に収まる、または未達の場合に cutover が fail する。
- benchmark gate の結果が PR / release artifact から追跡できる。
- rollback 手順が docs に記載されている。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `task benchmark:sample`
- table QA 専用 benchmark
- blue-green reindex smoke は AWS / S3 Vectors 環境がある場合に実行
- `git diff --check`

## PRレビュー観点

- `blocking`: v1 / v2 比較で evaluator profile、dataset、corpus が不一致のまま pass 判定していないこと。
- `blocking`: ACL guard と citation validation が v2 index でも弱まっていないこと。
- `should fix`: `p95 latency`、chunk count、index size、cost impact が report に残ること。
- `should fix`: rollback が手順だけでなく、どの manifest / index alias に戻すかまで明記されていること。
- `question`: 実 AWS 環境での full reindex を PR 前に実施するか、release gate に回すか。

## 未決事項・リスク

- 決定事項: v2 cutover は benchmark gate pass を条件とし、手動承認なしに本番相当 alias を切り替えない。
- 決定事項: v1 / v2 比較は同一 evaluator profile と同一 dataset を必須にする。
- 実装時確認: 実 AWS 環境、S3 Vectors、Textract、Bedrock の利用可否と cost budget。
- リスク: local mock では latency、Textract confidence、S3 Vectors 特性を十分に再現できない。
