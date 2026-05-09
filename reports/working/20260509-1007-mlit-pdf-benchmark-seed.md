# 作業完了レポート

保存先: `reports/working/20260509-1007-mlit-pdf-benchmark-seed.md`

## 1. 受けた指示

- 主な依頼: `.workspace/mlit_pdf_figure_table_rag_benchmark_seed.xlsx` について、CSV/JSONL に変換して管理するか判断し、作業を進める。
- 成果物: benchmark seed データ、変換スクリプト、利用手順、task md、検証結果。
- 条件: リポジトリの Worktree Task PR Flow、Post Task Work Report、Implementation Test Selection に従う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | XLSX の内容を確認する | 高 | 対応 |
| R2 | CSV/JSONL 管理の是非を判断する | 高 | 対応 |
| R3 | 再利用可能なデータ形式を追加する | 高 | 対応 |
| R4 | 利用手順と制約を文書化する | 高 | 対応 |
| R5 | 変換結果を検証する | 高 | 対応 |
| R6 | 実施していない検証を実施済み扱いしない | 高 | 対応 |

## 3. 検討・判断したこと

- XLSX はバイナリで差分確認しづらく、既存 benchmark runner からも直接扱いにくいため、永続的な主形式にはしない判断とした。
- 実行用には既存 `memorag-bedrock-mvp/benchmark` の dataset row に寄せた `qa.jsonl`、レビュー用には XLSX の列構成を維持した `qa.csv` を採用した。
- `Source_Docs`、`Rubric`、`Tag_Definitions` は QA と分離して参照できるよう CSV として保持した。
- アプリ本体や API には dataset 固有の期待語句・分岐を追加していない。
- 法令実務の最終判断には専門レビューが必要であるため、README に制約として明記した。

## 4. 実施した作業

- 専用 worktree `codex/mlit-pdf-benchmark-seed` を `origin/main` から作成した。
- `tasks/do/20260509-1007-mlit-pdf-benchmark-seed.md` に受け入れ条件付き task md を作成した。
- Python 標準ライブラリだけで XLSX を読み取る `tools/convert_mlit_pdf_benchmark_seed.py` を追加した。
- `memorag-bedrock-mvp/benchmark/datasets/mlit-pdf-figure-table-rag-seed-v1/` に QA JSONL/CSV、補助 CSV、サマリ JSON、README を追加した。
- XLSX から 36 QA、視覚要素必須 19 件、回答不能 1 件、出典 3 件、rubric 7 件、tag definition 9 件を検証した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/datasets/mlit-pdf-figure-table-rag-seed-v1/qa.jsonl` | JSONL | benchmark runner 向け QA 36 件 | CSV/JSONL 管理に対応 |
| `memorag-bedrock-mvp/benchmark/datasets/mlit-pdf-figure-table-rag-seed-v1/qa.csv` | CSV | XLSX 列構成を維持した QA 一覧 | レビュー容易性に対応 |
| `memorag-bedrock-mvp/benchmark/datasets/mlit-pdf-figure-table-rag-seed-v1/source_docs.csv` | CSV | 出典 PDF と URL | 出典管理に対応 |
| `memorag-bedrock-mvp/benchmark/datasets/mlit-pdf-figure-table-rag-seed-v1/rubric.csv` | CSV | 採点観点 | 評価手順に対応 |
| `memorag-bedrock-mvp/benchmark/datasets/mlit-pdf-figure-table-rag-seed-v1/tag_definitions.csv` | CSV | tag/field 定義 | 利用者理解に対応 |
| `memorag-bedrock-mvp/benchmark/datasets/mlit-pdf-figure-table-rag-seed-v1/README.md` | Markdown | 管理判断、利用手順、制約 | 文書化に対応 |
| `tools/convert_mlit_pdf_benchmark_seed.py` | Python | XLSX 変換・検証スクリプト | 再生成性に対応 |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 形式判断、変換、配置、文書化、検証まで対応した。 |
| 制約遵守 | 5 | worktree/task/report/検証のリポジトリルールに従った。 |
| 成果物品質 | 4 | seed として再利用可能だが、専門家レビューと実 corpus ingest は未実施。 |
| 説明責任 | 5 | README と本レポートに判断理由、制約、未実施事項を記録した。 |
| 検収容易性 | 5 | CSV/JSONL/README と検証コマンドで確認しやすい形にした。 |

総合fit: 4.8 / 5.0（約96%）

理由: ユーザー依頼の中核である CSV/JSONL 管理判断と変換は完了した。法令・省エネ実務の専門レビューと実 RAG コーパス投入は今回の範囲外のため満点ではない。

## 7. 実行した検証

- `python3 tools/convert_mlit_pdf_benchmark_seed.py /home/t-tsuji/project/rag-assist/.workspace/mlit_pdf_figure_table_rag_benchmark_seed.xlsx`: pass
- `python3 -m py_compile tools/convert_mlit_pdf_benchmark_seed.py`: pass
- `python3 - <<'PY' ...`: pass。`qa=36`、`requires_visual=19`、`unanswerable=1`、`source_docs=3`、`rubric=7`、`tag_definitions=9`、ID 重複なし、必須列ありを確認。
- `git diff --cached --check`: pass

## 8. 未対応・制約・リスク

- 実 RAG コーパスへの PDF 投入と benchmark runner 実行は未実施。今回は seed データの管理形式化が主目的のため。
- gold answer と採点基準は、建築実務・法務・省エネ適判に詳しい担当者のレビューを受けるのが望ましい。
- 出典 PDF の最新版確認は今回の変換作業では実施していない。
