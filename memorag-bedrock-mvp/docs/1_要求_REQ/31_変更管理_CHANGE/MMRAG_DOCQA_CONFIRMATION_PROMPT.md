# MMRAG-DocQA 性能テスト確認プロンプト

以下を確認して、`mmrag-docqa-v1` suite の sample dataset / corpus を本番評価用に差し替えてください。

## 推奨決定値

2026-05-06 時点では、追加確認がない場合は次の値を `mmrag-docqa-v1` の本番評価データ方針として採用する。

| 項目 | 推奨値 |
|---|---|
| 論文識別 | arXiv `2508.00579`。初期タイトルは `MMRAG-DocQA`、現行 arXiv タイトルは `MHier-RAG: Multi-Modal RAG for Visual-Rich Document Question-Answering via Hierarchical and Multi-Granularity Reasoning`。 |
| suite ID | `mmrag-docqa-v1` のまま維持する。互換性を優先し、rename はしない。 |
| UI label | `MMRAG-DocQA / MHier-RAG` を推奨する。既存 UI 表示が短さを優先する場合は `MMRAG-DocQA` のままでもよい。 |
| mode | `agent`。 |
| primary dataset | Hugging Face `yubo2333/MMLongBench-Doc` の `train` split。論文が評価に使った公開 dataset のうち、1,091 questions / 135 docs 規模で managed benchmark に載せやすい。 |
| secondary dataset | Hugging Face `dengchao/LongDocURL`。規模が大きいため `mmrag-docqa-full-v1` または夜間 stress benchmark 用に分離し、`mmrag-docqa-v1` の既定にはしない。 |
| default row selection | `MMLongBench-Doc` から deterministic stratified subset 100 questions。内訳は Chart 20、Table 20、Figure 15、Layout / generalized text 15、Pure-text 15、cross-page mixed 10、unanswerable 5 を目安にする。該当カテゴリが不足する場合は evidence source の希少カテゴリを優先し、総数 100 を維持する。 |
| full run | 手動または nightly で `MMLongBench-Doc` 全 1,091 questions を実行する。PR 必須 gate にはしない。 |
| corpus policy | repository に PDF を commit しない。CodeBuild / local prepare step で selected rows が参照する `doc_id` の PDF だけを download し、`BENCHMARK_CORPUS_DIR` へ配置する。全 PDF download は opt-in にする。 |
| corpus identity | `BENCHMARK_CORPUS_SUITE_ID=mmrag-docqa-v1`。seed 文書は `aclGroups: ["BENCHMARK_RUNNER"]`、`docType: "benchmark-corpus"`、`source: "benchmark-runner"` で隔離する。 |
| dataset output path | local: `.local-data/mmrag-docqa-v1/dataset.jsonl`、CodeBuild: `./benchmark/.runner-dataset.jsonl`。 |
| corpus output path | local: `.local-data/mmrag-docqa-v1/corpus/`、CodeBuild: `./benchmark/.runner-mmrag-docqa-corpus/`。 |
| model | suite 既定は API default の `amazon.nova-lite-v1:0`。比較 benchmark では `modelId` を summary に必ず残す。 |
| embedding model | `amazon.titan-embed-text-v2:0`。 |
| runtime knobs | `topK=20`、`memoryTopK=6`、`minScore=0.15`、`useMemory=false` を初期値にする。PDF benchmark では memory 生成の揺れとコストを避け、evidence retrieval を優先する。 |
| answer mapping | `answer === "Not answerable"` は `answerable=false`、`expectedResponseType="refusal"`。それ以外は `referenceAnswer=answer`、短い answer は `expectedContains` にも入れる。List answer は各要素を `expectedContains` に分解する。 |
| citation mapping | `expectedFiles=[doc_id]`、`expectedPages=evidence_pages`、`metadata.evidenceSources=evidence_sources`、`metadata.answerFormat=answer_format`。 |
| fact slot mapping | `expectedFactSlots` に `answer_core`、`evidence_page`、`evidence_source` を持たせる。List answer は item ごとに `answer_item_<n>` を追加する。 |
| multimodal 判定 | Chart / Table / Figure / Layout は answer contains だけで pass にしない。`expectedFiles` と `expectedPages` の hit を必須評価として report に残す。 |
| baseline | 初回 run の summary を `benchmark/baselines/mmrag-docqa-v1/default-summary.json` として保存する。以降は同じ evaluator profile 同士だけ regression 比較する。 |
| initial pass threshold | `answerCorrect >= 0.35`、`expectedFileHitRate >= 0.80`、`expectedPageHitRate >= 0.45`、`retrievalRecallAt20 >= 0.70`、`factSlotCoverage >= 0.60`、`unsupportedSentenceRate <= 0.10`、unanswerable row の `responseTypeCorrect >= 0.70`、`p95LatencyMs <= 30000`。 |
| regression threshold | `answerCorrect`、`expectedFileHitRate`、`retrievalRecallAt20`、`factSlotCoverage` は baseline から 5 percentage points 超の低下で fail。`p95LatencyMs` は 25% 超の悪化で fail。 |
| artifact policy | `results.jsonl`、`summary.json`、`report.md` を benchmark output S3 prefix に保存し、PR コメントには summary と threshold 判定のみ記載する。raw PDF と raw prompt は PR コメントへ貼らない。 |

この決定値は、実データ変換器と downloader を実装するまでの仕様入力であり、現行の `dataset.mmrag-docqa.sample.jsonl` を本番評価済みとみなすものではない。

参考:

- arXiv `2508.00579`: https://arxiv.org/abs/2508.00579
- MMLongBench-Doc dataset: https://huggingface.co/datasets/yubo2333/MMLongBench-Doc
- LongDocURL dataset: https://huggingface.co/datasets/dengchao/LongDocURL

```text
MMRAG-DocQA: A Multi-Modal Retrieval-Augmented Generation Method for Document Question-Answering with Hierarchical Index and Multi-Granularity Retrieval を MemoRAG の性能テストとして実行したいです。

次の未確定事項を埋めてください。

1. benchmark corpus として投入する文書、PDF、画像、表、図、Textract JSON などのファイル一覧と保存場所。
2. UI に表示する suite 名、suite ID、評価対象 mode。既定案は suite ID `mmrag-docqa-v1`、suite 名 `MMRAG-DocQA`、mode `agent` です。
3. dataset JSONL の質問一覧、期待回答、`expectedContains`、`expectedFiles`、`expectedDocumentIds`、`factSlots`。
4. multi-modal 評価として画像、表、図、ページ番号、caption をどの正解条件で評価するか。
5. hierarchical index と multi-granularity retrieval の合格条件。例: `retrievalRecallAt20`、`citationHitRate`、`factSlotCoverage`、`p95LatencyMs` の閾値。
6. 比較対象 baseline と regression 判定に使う過去 summary JSON の有無。
7. CodeBuild runner が seed すべき corpus directory と、既存文書から隔離するための ACL / metadata 条件。
8. 生成された結果を PR、レポート、運用 docs のどこに残すか。

回答は、実装者が `benchmark/dataset.mmrag-docqa.sample.jsonl` と `benchmark/corpus/mmrag-docqa-v1/` を本番評価用に置き換えられる粒度で記載してください。
```
