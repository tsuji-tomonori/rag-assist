# 作業完了レポート: 日本語公開PDF QA benchmark dataset

## 指示

- ユーザー作成の `jp_public_pdf_qarag_benchmark.xlsx` を、ベンチマーク評価データとして実行可能な形にする。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | Excel の QA を既存 benchmark runner 形式へ変換する | 対応 |
| R2 | 24 問、3 分野 x 8 問を検証する | 対応 |
| R3 | 出典URL、抽出区分、OCR前提を追跡可能にする | 対応 |
| R4 | 既存 runner が読み込めることを確認する | 対応 |
| R5 | 実施していないフル ingest / OCR 実行を完了扱いしない | 対応 |

## 検討・判断の要約

- 既存 `memorag-bedrock-mvp/benchmark/run.ts` は JSONL dataset を入力とするため、Excel原本ではなく `dataset.jp-public-pdf-qa.jsonl` を成果物にした。
- 外部PDFやOCR資料は大容量かつ取得・OCR投入が必要なため、今回の実行可能性は「runner が dataset を読み込み、評価行として処理できる」ことまでをローカル検証対象にした。
- 文書出典、採否、抽出区分、公開形態、ページ規模、OCR前提は各行の `metadata.document` に保持し、QAごとの根拠範囲や採点観点は `metadata` に保持した。

## 実施作業

- Excel の `Documents` と `QA_Benchmark` を確認した。
- `memorag-bedrock-mvp/benchmark/dataset.jp-public-pdf-qa.jsonl` を追加した。
- `memorag-bedrock-mvp/benchmark/jp-public-pdf-qa.test.ts` を追加した。
- `npm ci` で worktree 内の依存を導入し、benchmark workspace の test / typecheck を実行した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/benchmark/dataset.jp-public-pdf-qa.jsonl` | 日本語公開PDF/OCR資料向け 24 問の benchmark JSONL |
| `memorag-bedrock-mvp/benchmark/jp-public-pdf-qa.test.ts` | dataset 構造・件数・runner 読み込み検証 |
| `tasks/do/20260509-1002-jp-public-pdf-qa-benchmark.md` | タスク、受け入れ条件、検証記録 |

## 実行した検証

- `git diff --check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass

## 未対応・制約・リスク

- 実API・実PDF corpus ingest を伴うフル benchmark run は未実施。対象PDF/スキャン画像の取得とOCR投入が必要。
- Excel内の期待回答と実PDF本文の再照合は今回のスコープ外。
- `npm ci` 実行時に既存依存の `npm audit` 警告が 3 件表示されたが、今回の変更では依存更新を行っていない。

## Fit評価

総合fit: 4.6 / 5.0（約92%）

理由: 主要要件である実行可能な JSONL dataset 化、件数・metadata・runner 読み込み検証は満たした。一方で、実PDF/OCR corpus を投入したフル benchmark run は環境準備が必要なため未実施。
