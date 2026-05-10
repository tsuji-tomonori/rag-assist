# 建築図面 QARAG の診断用サブスコアを追加する

保存先: `tasks/done/20260510-1433-drawing-benchmark-diagnostic-metrics.md`

状態: done

タスク種別: 機能追加

## 作業チェックリスト

- [x] 現行 benchmark runner の metric / failure reason / report 出力を確認する。
- [x] optional input field ベースの診断 metric を実装する。
- [x] architecture-drawing-qarag 由来の分類で failure taxonomy を確認できるようにする。
- [x] docs と test を更新する。
- [x] 検証を実行し、PR 作成後に受け入れ条件コメントを残す。

## Done 条件

- summary と Markdown report に診断 metric が出る。
- 入力がない metric は `not_applicable` として扱われ、0 点扱いされない。
- 既存 benchmark suite の行・summary 互換性を壊さない。
- benchmark workspace の unit test / typecheck と `git diff --check` が通る。

## 背景

最終回答の正誤だけでは、retrieval、OCR、grounding、reasoning、abstention のどこで失敗したか分からない。建築図面 QARAG の改善施策を評価するには、診断用サブスコアが必要である。

## 目的

`page_recall@k`、`region_recall@k`、`extraction_accuracy`、`normalized_answer_accuracy`、`count_mape`、`graph_resolution_accuracy`、`abstain_accuracy`、`unsupported_answer_rate` を benchmark summary / report に追加する。

## 対象範囲

- benchmark dataset schema
- benchmark runner / evaluator
- benchmark report
- architecture-drawing-qarag JSON 正本
- docs / tests

## 方針

既存 benchmark と互換性を保つため、期待値フィールドがない metric は `not_applicable` とする。metric は raw retrieval、final evidence、extraction result、computed facts、answer support を混同しないように分ける。

## 必要情報

- 現行 benchmark evaluator の summary schema
- `REQ_FUNCTIONAL_019` benchmark 指標要求
- architecture-drawing-qarag seed QA の taxonomy

## 実行計画

1. 各 metric の入力フィールドと分母条件を定義する。
2. dataset schema に optional expected fields を追加する。
3. evaluator と Markdown report に metric を追加する。
4. architecture-drawing-qarag の seed QA に分類と期待 page / region / type を段階的に付与する。
5. evaluator unit test と report snapshot を更新する。

## ドキュメントメンテナンス計画

benchmark metric docs、operations docs、requirements docs を更新し、既存 suite で `not_applicable` になる metric の扱いを明記する。

## 受け入れ条件

- [x] AC1: 新規サブスコアが summary と Markdown report に出る。
- [x] AC2: 入力がない metric は `not_applicable` として扱われ、0 点扱いされない。
- [x] AC3: architecture-drawing-qarag の failure taxonomy が retrieval / OCR / grounding / reasoning / abstention に分けて確認できる。
- [x] AC4: 既存 benchmark suite の summary 互換性を壊さない。

## 検証計画

- benchmark evaluator unit test
- report generation test
- existing suite regression test
- `git diff --check`

## 検証結果

- `npm run test --workspace @memorag-mvp/benchmark`: pass
- `npm run typecheck --workspace @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## PRレビュー観点

- metric 名と分母条件が docs と実装で一致しているか。
- 期待値未設定を failure と誤判定していないか。
- benchmark 期待語句や sample 固有値を実装に埋め込んでいないか。

## 未決事項・リスク

- 決定事項: metric は optional field ベースで段階導入し、既存 suite を壊さない。
- リスク: region / bbox 期待値を人手で整備する必要があり、初期データ作成コストがかかる。
