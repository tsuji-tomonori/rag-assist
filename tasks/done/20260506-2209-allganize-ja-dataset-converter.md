# Allganize日本語RAG評価CSV変換

## 保存先

`tasks/done/20260506-2209-allganize-ja-dataset-converter.md`

## 状態

done

## 背景

PR #134 では `allganize/RAG-Evaluation-Dataset-JA` を benchmark として使えるようにする必要があった。既存の agent benchmark runner は JSONL dataset を入力にするため、Hugging Face dataset の CSV を直接実行できなかった。

## 目的

Hugging Face の `rag_evaluation_result.csv` を既存 benchmark runner が読める JSONL に変換し、質問、参照回答、期待ファイル、期待ページ、metadata を保持する。

## 対象範囲

- `memorag-bedrock-mvp/benchmark/allganize-ja.ts`
- `memorag-bedrock-mvp/benchmark/allganize-ja.test.ts`
- `memorag-bedrock-mvp/benchmark/run.ts`
- `memorag-bedrock-mvp/benchmark/package.json`

## 方針

- CSV parser は quoted comma / quoted newline を扱える最小実装にする。
- `target_answer` は既定で `referenceAnswer` として raw results に保持する。
- 完全包含判定が必要な場合だけ `ALLGANIZE_RAG_EXPECTED_MODE=strict-contains` で `expectedContains` を生成する。
- `domain` と `limit` で小規模 smoke や domain 別実行を可能にする。

## 必要情報

- Hugging Face dataset: `allganize/RAG-Evaluation-Dataset-JA`
- 入力 CSV: `rag_evaluation_result.csv`
- 主な列: `question`, `target_answer`, `target_file_name`, `target_page_no`, `domain`, `type`
- PR: #134
- 作業レポート: `reports/working/20260506-2048-allganize-rag-eval-benchmark.md`

## 実行計画

1. CSV を取得または local path から読む。
2. `question`、`target_answer`、`target_file_name`、`target_page_no` を JSONL row に変換する。
3. `target_answer` を `referenceAnswer` として保持する。
4. opt-in で `expectedContains` を生成する。
5. 変換結果を `ALLGANIZE_RAG_DATASET_OUTPUT` に出力する。
6. unit test と typecheck で parser / mapper を検証する。

## ドキュメントメンテナンス計画

- `memorag-bedrock-mvp/README.md` に Allganize dataset の変換と `target_answer` の扱いを記載する。
- `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md` に local task と環境変数を記載する。
- `memorag-bedrock-mvp/docs/OPERATIONS.md` に公式 O/X 判定との差分を記載する。
- OpenAPI / API examples は公開 API contract を変更しないため更新不要。

## 受け入れ条件

| ID | 条件 |
|---|---|
| AC-CONV-001 | `rag_evaluation_result.csv` から benchmark JSONL を生成できる。 |
| AC-CONV-002 | JSONL row に `question`、`referenceAnswer`、`expectedFiles`、`expectedPages`、`metadata` が含まれる。 |
| AC-CONV-003 | `ALLGANIZE_RAG_EXPECTED_MODE=strict-contains` で `expectedContains` を生成できる。 |
| AC-CONV-004 | `ALLGANIZE_RAG_LIMIT` で小規模実行に絞り込める。 |
| AC-CONV-005 | quoted comma / quoted newline を含む CSV を parser が扱える。 |

## 受け入れ条件チェック

| ID | 判定 | 根拠 |
|---|---|---|
| AC-CONV-001 | PASS | `benchmark/allganize-ja.ts` の `prepareAllganizeJaBenchmark` が CSV を JSONL に変換する。 |
| AC-CONV-002 | PASS | `convertAllganizeRows` が `question`、`referenceAnswer`、`expectedFiles`、`expectedPages`、`metadata` を設定する。 |
| AC-CONV-003 | PASS | `ALLGANIZE_RAG_EXPECTED_MODE=strict-contains` 時に `expectedAnswer` / `expectedContains` を設定する test を追加済み。 |
| AC-CONV-004 | PASS | `ALLGANIZE_RAG_LIMIT=1 ./node_modules/.bin/tsx benchmark/allganize-ja.ts` で 1 行変換を確認済み。 |
| AC-CONV-005 | PASS | `parseCsv handles quoted commas and newlines` test が pass。 |

## 検証計画

- `npm run typecheck -w @memorag-mvp/benchmark`
- `npm run test -w @memorag-mvp/benchmark`
- `ALLGANIZE_RAG_LIMIT=1 ./node_modules/.bin/tsx benchmark/allganize-ja.ts`

## PRレビュー観点

- `target_answer` を既定の正答判定に使わない判断が docs と PR 本文に明記されているか。
- JSONL row の追加 field が既存 runner の後方互換性を壊していないか。
- CSV parser の責務が Allganize 変換用途に閉じているか。

## 未決事項・リスク

- 決定事項: 既定評価は `referenceAnswer` 保持に留め、厳格判定は opt-in にする。
- リスク: 公式 leaderboard と同等の O/X 判定は未実装。必要な場合は LLM judge profile の追加 task として扱う。
