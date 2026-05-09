# MLIT PDF 図表 RAG ベンチマーク seed v1

国土交通省の公開 PDF を基にした、PDF 内の図・表・本文を横断する日本語 RAG 評価用 seed データです。建築確認、省エネ基準、木造戸建住宅の仕様基準に関する質問 36 件を含みます。

## 管理形式の判断

この seed は CSV と JSONL を管理対象にします。XLSX はレビューや差分確認が難しいバイナリであり、benchmark runner から直接扱いにくいため、リポジトリでは永続的な主形式にしません。

- `qa.jsonl`: 既存 benchmark runner の dataset row に寄せた実行用形式。
- `qa.csv`: spreadsheet でレビューしやすい QA 一覧。
- `source_docs.csv`: 出典 PDF、URL、用途、注意点。
- `rubric.csv`: 検索、図表取得、回答正確性、引用品質、視覚推論の採点観点。
- `tag_definitions.csv`: `table`、`figure+text`、`scenario_judgement` などの定義。
- `workbook_summary.json`: 変換元 workbook のシート構成と件数サマリ。

変換元 XLSX は `.workspace/mlit_pdf_figure_table_rag_benchmark_seed.xlsx` を使用しました。再生成する場合は次を実行します。

```bash
python3 tools/convert_mlit_pdf_benchmark_seed.py .workspace/mlit_pdf_figure_table_rag_benchmark_seed.xlsx
```

## 内容

- QA 件数: 36
- `requires_visual=Yes`: 19
- `negative_or_unanswerable=Yes`: 1
- 主な evidence type: `text`, `figure`, `table`, `figure+text`, `table+text`
- 主な question type: `extract_condition`, `scenario_judgement`, `extract_value`, `extract_list`, `unanswerable`

## 出典 PDF

| source_doc_id | 資料 | URL |
|---|---|---|
| `MLIT-KIJUN-2024` | 建築基準法・建築物省エネ法 改正法制度説明資料 | <https://www.mlit.go.jp/common/001627103.pdf> |
| `MLIT-SHOENE-NONRES-2025` | 令和7年度 建築物省エネ法講習テキスト（小規模非住宅建築物設計者用） | <https://www.mlit.go.jp/common/001890253.pdf> |
| `MLIT-WOOD-SPEC-2023` | 木造戸建住宅の仕様基準ガイドブック 4～7地域 省エネ基準編 第3版 | <https://www.mlit.go.jp/common/001586400.pdf> |

## 利用手順

1. `source_docs.csv` の PDF を RAG コーパスに投入する。
2. `qa.jsonl` または `qa.csv` の質問だけをチャットボットに投げる。
3. 回答本文、引用 PDF、引用ページ、引用図表、検索上位 k 件をログ化する。
4. `rubric.csv` に沿って、検索品質と回答品質を分けて採点する。

既存 benchmark runner に投入する場合は、`qa.jsonl` を dataset path として使います。`expectedFiles` は `source_doc_id.pdf` 形式、`expectedDocumentIds` は `source_doc_id` を入れています。実際の corpus 側のファイル名や document id が異なる場合は、ingest 時の metadata か評価アダプタで対応させてください。

## UI からの実行

この seed は benchmark suite `mlit-pdf-figure-table-rag-seed-v1` として登録します。UI の「性能テスト」画面では、API の `GET /benchmark-suites` が返す suite 一覧から `MLIT PDF figure/table RAG seed` を選択して CodeBuild runner を起動できます。

実行環境では、benchmark bucket に次の dataset key を配置してください。

```text
datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl
```

また、出典 PDF は benchmark seed corpus として投入し、metadata の `benchmarkSuiteId` を `mlit-pdf-figure-table-rag-seed-v1` に揃える必要があります。dataset だけを配置しても、対応する PDF corpus が未投入の場合は検索・引用評価が失敗します。

## 採点上の注意

- 建築・法令・省エネ系の条件問題では、「以下/超」「未満/以上」「AND/OR」の取り違えを重大誤答として扱います。
- `requires_visual=true` の行は、本文 OCR だけでなく、図・表・注記・凡例に到達できたかを分けて見ます。
- `negative_or_unanswerable=true` の行は、根拠がない具体値を捏造せず、記載がないことを答えられるかを評価します。
- gold answer は seed 作成時点の評価用回答です。法令実務の最終判断には、最新版の法令、告示、所管庁または自治体資料、専門家確認を併用してください。

## 変換仕様

`qa.jsonl` では、XLSX の `Benchmark_QA` を次のように正規化しています。

- `question_ja` -> `question`
- `gold_answer_ja` -> `referenceAnswer`, `expectedAnswer`
- `source_doc_id` -> `expectedDocumentIds`
- `source_page_or_slide` -> `expectedPages`
- `negative_or_unanswerable=Yes` -> `answerable=false`, `expectedResponseType=refusal`
- 元の詳細列 -> `metadata`

CSV は XLSX の列構成を維持します。
