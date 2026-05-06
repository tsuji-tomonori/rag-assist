# MMRAG-DocQA 性能テスト確認プロンプト

以下を確認して、`mmrag-docqa-v1` suite の sample dataset / corpus を本番評価用に差し替えてください。

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
