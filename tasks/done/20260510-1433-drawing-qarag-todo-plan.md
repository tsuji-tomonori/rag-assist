# 建築図面 QARAG 改善施策の todo task 化

保存先: `tasks/done/20260510-1433-drawing-qarag-todo-plan.md`

状態: done

## 背景

ユーザーは建築・AEC 図面 QARAG ベンチマークの性能改善方針として、LLM/VLM 単体のプロンプト改善ではなく、図面特化の検索、局所読解、構造化、検証ツールを組み合わせるロードマップを提示した。

## 目的

今回すぐに実装しない改善施策を、後続作業で着手できる `tasks/todo/` の task Markdown として分解する。

## 対象範囲

- `tasks/todo/`
- `reports/working/`
- 既存の建築図面 QARAG benchmark task / report との重複確認

## 方針

ロードマップを、1 task = 1 実装成果になる粒度へ分ける。各 task には背景、対象範囲、実行計画、ドキュメントメンテナンス計画、受け入れ条件、検証計画、PR レビュー観点、リスクを入れる。

## 必要情報

- ユーザー提示の改善方針
- `tasks/done/20260509-1002-architecture-drawing-qarag-md.md`
- `tasks/done/20260509-1015-architecture-drawing-benchmark-ui.md`
- `tasks/done/20260509-1038-architecture-benchmark-json-source.md`
- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.json`

## 実行計画

1. 専用 worktree を作成する。
2. 既存 task と report を確認し、重複を避ける。
3. 将来実装 task を `tasks/todo/` に作成する。
4. Markdown の整合性と trailing whitespace を検証する。
5. 作業レポートを `reports/working/` に作成する。

## ドキュメントメンテナンス計画

今回の成果物は task Markdown と作業レポートであり、実装、API、UI、運用手順は変更しない。後続 task では、実装内容に応じて `memorag-bedrock-mvp/docs/`、benchmark docs、README、PR 本文でドキュメント影響を明示する。

## 受け入れ条件

- [x] AC1: ユーザー提示の主要な非即時施策が、後続着手可能な todo task に分解されている。
- [x] AC2: 各 task が必須セクションと受け入れ条件を持つ。
- [x] AC3: 既存 task と重複する完了済み作業を再登録していない。
- [x] AC4: 作業レポートが `reports/working/` に残っている。

## 検証計画

- `git diff --name-only`
- `git diff --check`
- 作成 Markdown の required section inspection

## PRレビュー観点

- todo task が大きすぎず、後続 PR の単位として実行可能か。
- 建築図面 QARAG の改善方針が、検索、抽出、検出、グラフ、検証に分かれているか。
- 実施していない検証や実装を完了済みとして書いていないか。

## 未決事項・リスク

- 決定事項: 今回は実装・commit・PR は行わず、`/plan` の意図に合わせて task 化までに留めた。
- リスク: 将来 task の優先順位は、実際の benchmark failure taxonomy によって入れ替わる可能性がある。
