# MMRAG-DocQA 本番評価推奨値決定

保存先: `tasks/done/20260506-2246-mmrag-docqa-production-defaults.md`

状態: done

## 背景

`mmrag-docqa-v1` は UI / CodeBuild runner から起動できるようになったが、本番評価に使う PDF、質問、評価閾値が未決だった。ユーザーから、未決事項を推奨値で決めるよう依頼があった。

## 目的

MMRAG-DocQA / MHier-RAG の評価対象に合わせ、`mmrag-docqa-v1` の本番評価データ方針、dataset mapping、corpus download policy、初期 threshold、regression threshold を決める。

## 対象範囲

- `memorag-bedrock-mvp/docs/1_要求_REQ/31_変更管理_CHANGE/MMRAG_DOCQA_CONFIRMATION_PROMPT.md`
- `tasks/todo/20260506-2049-mmrag-docqa-production-dataset.md`

## 決定事項

- arXiv `2508.00579` の現行タイトルは `MHier-RAG` だが、既存互換のため suite ID は `mmrag-docqa-v1` を維持する。
- primary dataset は Hugging Face `yubo2333/MMLongBench-Doc` `train` split とする。
- `LongDocURL` は default suite に入れず、full / stress suite として分離する。
- default managed run は `MMLongBench-Doc` の deterministic stratified subset 100 questions とする。
- PDF は repository に commit せず、prepare step で selected rows が参照する PDF だけを download する。
- dataset JSONL は `referenceAnswer`、`expectedContains`、`expectedFiles`、`expectedPages`、`expectedFactSlots`、multimodal metadata を出力する。
- 初期 gate は `answerCorrect >= 0.35`、`expectedFileHitRate >= 0.80`、`expectedPageHitRate >= 0.45`、`retrievalRecallAt20 >= 0.70`、`factSlotCoverage >= 0.60`、`unsupportedSentenceRate <= 0.10`、unanswerable row の `responseTypeCorrect >= 0.70`、`p95LatencyMs <= 30000` とする。
- regression は baseline から 5 percentage points 超の品質低下、または `p95LatencyMs` 25% 超の悪化を fail とする。

## 参考

- arXiv `2508.00579`: https://arxiv.org/abs/2508.00579
- MMLongBench-Doc dataset: https://huggingface.co/datasets/yubo2333/MMLongBench-Doc
- LongDocURL dataset: https://huggingface.co/datasets/dengchao/LongDocURL

## 受け入れ条件

| ID | 条件 | 判定 | 根拠 |
|---|---|---|---|
| AC-DEFAULT-001 | primary dataset と secondary dataset が決まっている。 | PASS | `MMLongBench-Doc` を primary、`LongDocURL` を secondary / stress として決定。 |
| AC-DEFAULT-002 | default run の subset サイズと選定方針が決まっている。 | PASS | deterministic stratified subset 100 questions として決定。 |
| AC-DEFAULT-003 | corpus の保存/取得方針が決まっている。 | PASS | repository へ PDF を commit せず、prepare step で referenced PDF のみ download として決定。 |
| AC-DEFAULT-004 | dataset JSONL mapping が決まっている。 | PASS | answer / citation / page / fact slot / metadata mapping を決定。 |
| AC-DEFAULT-005 | 初期合格閾値と regression 閾値が決まっている。 | PASS | threshold を confirmation prompt と todo task に記録。 |

## 検証計画

- `git diff --check`
- Markdown の必須項目と table 整合確認

## PRレビュー観点

- 本 task は「推奨値の決定」であり、converter / downloader / 実 benchmark run は別 task として扱われているか。
- `dataset.mmrag-docqa.sample.jsonl` を本番評価済み artifact と誤読しない注意が残っているか。
- `LongDocURL` を default gate に入れず、規模の大きい stress suite として扱う判断が明記されているか。

## 未決事項・リスク

- 未実装: `MMLongBench-Doc` から JSONL を生成する converter、PDF downloader、suite-specific threshold enforcement。
- 未実施: 実 CodeBuild run、baseline summary 保存、regression 比較。
- リスク: PDF のサイズや配布形式により、API Gateway payload 上限や CodeBuild 実行時間に合わせた分割 / 事前抽出が必要になる可能性がある。
