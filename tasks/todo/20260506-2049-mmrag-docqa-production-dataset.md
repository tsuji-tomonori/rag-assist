# MMRAG-DocQA 本番評価 dataset 差し替え

保存先: `tasks/todo/20260506-2049-mmrag-docqa-production-dataset.md`

状態: todo

## 背景

PR #133 では `MMRAG-DocQA` を UI から実行する導線を追加したが、ユーザーから与えられた情報は論文タイトルのみだった。

現状の `benchmark/dataset.mmrag-docqa.sample.jsonl` と `benchmark/corpus/mmrag-docqa-v1/` は UI と runner 導線確認用であり、論文手法の本番性能評価としては不十分である。

## 目的

`mmrag-docqa-v1` を、実 paper corpus、multimodal assets、ground-truth answers、評価閾値を持つ本番評価用 benchmark suite に差し替える。

## 対象範囲

- `memorag-bedrock-mvp/benchmark/dataset.mmrag-docqa.sample.jsonl`
- `memorag-bedrock-mvp/benchmark/corpus/mmrag-docqa-v1/`
- `memorag-bedrock-mvp/docs/1_要求_REQ/31_変更管理_CHANGE/MMRAG_DOCQA_CONFIRMATION_PROMPT.md`
- benchmark evaluator profile / thresholds
- README、運用 docs、ローカル検証 docs、必要なら API / data docs

## 方針

- `MMRAG_DOCQA_CONFIRMATION_PROMPT.md` の確認事項を埋めてから、sample fixture を本番評価用データへ差し替える。
- multimodal 評価では、画像、表、図、caption、ページ番号、Textract JSON などの正解条件を dataset row に明示する。
- hierarchical index と multi-granularity retrieval の合格条件を、retrieval recall、citation hit、fact slot coverage、latency などで検証可能にする。
- 既存の benchmark runner contract と `/benchmark/query` の schema を不要に壊さない。

## 必要情報

- 実 paper corpus と関連する PDF / image / table / figure / Textract JSON の保存場所。
- 正解質問、期待回答、`expectedContains`、`expectedFiles`、`expectedDocumentIds`、`factSlots`。
- multimodal asset を正解として判定する粒度。
- baseline summary と regression threshold。
- 本番評価に使う model / embedding model / evaluator profile。

## 実行計画

1. `MMRAG_DOCQA_CONFIRMATION_PROMPT.md` に沿って不足情報を回収する。
2. 実 corpus と multimodal assets を `benchmark/corpus/mmrag-docqa-v1/` に配置する。
3. `dataset.mmrag-docqa.sample.jsonl` を本番評価 dataset へ更新、または本番用 dataset 名を分離する。
4. 必要な evaluator profile / thresholds を定義する。
5. benchmark runner と docs を更新する。
6. ローカルまたは対象環境で benchmark を実行し、結果を report / PR に残す。

## ドキュメントメンテナンス計画

- README: `mmrag-docqa-v1` が本番評価用データへ差し替わったことを記載する。
- `docs/OPERATIONS.md`: corpus seed、multimodal assets、結果解釈、baseline 比較を更新する。
- `docs/LOCAL_VERIFICATION.md`: ローカル実行手順と必要環境変数を更新する。
- 要件・受け入れ条件 docs: 本番評価の合格閾値が製品品質要求に影響する場合は `FR-*` / `SQ-*` に追記する。
- PR body: 実行した benchmark と未実施チェックを明記する。

## 受け入れ条件

- [ ] 実 paper corpus と multimodal assets が repository または運用上の参照先に定義されている。
  - 現状: 未充足。PR #133 時点では sample corpus のみ。
- [ ] dataset row が ground-truth answers、期待ファイル、期待 document、fact slots、multimodal 正解条件を持つ。
  - 現状: 部分充足。sample row は存在するが、本番評価用の正解ではない。
- [ ] hierarchical index と multi-granularity retrieval の合格条件が metric と閾値で定義されている。
  - 現状: 未充足。確認プロンプトで確認対象としている。
- [ ] 本番 dataset で benchmark を実行し、summary / report / results を保存している。
  - 現状: 未充足。PR #133 では実環境 CodeBuild run は未実施。
- [ ] 結果が baseline と比較され、regression 判定が PR または作業レポートに記載されている。
  - 現状: 未充足。baseline summary が未指定。

## 検証計画

- `DATASET=benchmark/dataset.mmrag-docqa.sample.jsonl BENCHMARK_SUITE_ID=mmrag-docqa-v1 BENCHMARK_CORPUS_DIR=benchmark/corpus/mmrag-docqa-v1 BENCHMARK_CORPUS_SUITE_ID=mmrag-docqa-v1 npm run start -w @memorag-mvp/benchmark`
- 実環境では管理画面から `MMRAG-DocQA` を起動し、CodeBuild logs、summary、report、results を確認する。
- `task benchmark:sample` 相当のローカル検証は、対象 API と認証 token が準備できた場合に実行する。

## PRレビュー観点

- `blocking`: sample fixture の結果を本番性能評価として扱っていないこと。
- `blocking`: multimodal assets の正解条件が dataset / evaluator で検証可能であること。
- `should fix`: baseline と current run の evaluator profile mismatch が明記されること。
- `should fix`: 実行していない benchmark を実施済みとして PR に書かないこと。

## 未決事項・リスク

- 未決事項: 実 paper corpus、multimodal assets、ground-truth answers、baseline summary、合格閾値。
- リスク: multimodal asset の取り扱いにより、repository size、S3 deploy size、著作権・配布制約、Textract 前処理手順が変わる可能性がある。
- 決定事項: PR #133 では本 task を完了扱いにせず、導線追加とは別の todo として管理する。
