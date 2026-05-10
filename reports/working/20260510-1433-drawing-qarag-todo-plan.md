# 作業完了レポート

保存先: `reports/working/20260510-1433-drawing-qarag-todo-plan.md`

## 1. 受けた指示

- 主な依頼: 建築図面 QARAG ベンチマーク改善方針のうち、すぐ実装しないものを `tasks/todo/` の task として登録する。
- 成果物: 後続作業用の todo task Markdown と作業レポート。
- 形式・条件: `/plan` の依頼として、実装ではなく計画 task 化に留める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | すぐやらない改善施策を todo task に入れる | 高 | 対応 |
| R2 | 後続作業で使える粒度に分解する | 高 | 対応 |
| R3 | task に受け入れ条件を明記する | 高 | 対応 |
| R4 | 実装済み・検証済みでない内容を完了扱いしない | 高 | 対応 |
| R5 | 作業レポートを残す | 中 | 対応 |

## 3. 検討・判断したこと

- 既存 task と report を確認し、建築図面 QARAG の benchmark 作成、UI 実行対応、JSON 正本化は完了済みとして再登録しなかった。
- ユーザー提示の改善方針は、検索、局所抽出、正規化、検出、グラフ、abstention、診断 metric の実装成果に分けた。
- `/plan` の意図に合わせ、今回の turn では実装には進まず、リポジトリルールに従って task 追加を commit / PR 化する判断にした。

## 4. 実施した作業

- `origin/main` から専用 worktree `codex/drawing-qarag-todo-plan` を作成した。
- 既存の `tasks/todo/`、`tasks/done/`、建築図面 QARAG 関連 report を確認した。
- 後続実装用 todo task を 8 件作成した。
- 作業管理用 task を作成し、完了時に `tasks/done/` へ移す。
- Markdown の required section と trailing whitespace を確認した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `tasks/todo/20260510-1433-drawing-sheet-metadata-region-index.md` | Markdown | タイトル欄、凡例、表、注記、詳細図 region index task | 検索・根拠到達改善 |
| `tasks/todo/20260510-1433-drawing-visual-page-retrieval.md` | Markdown | visual page retrieval 評価 task | OCR で落ちるページ検索改善 |
| `tasks/todo/20260510-1433-drawing-dimension-normalizer.md` | Markdown | 寸法、口径、延長、縮尺の正規化 task | 抽出・採点改善 |
| `tasks/todo/20260510-1433-drawing-symbol-detector.md` | Markdown | 扉、窓、衛生器具、配管記号の検出 task | count QA 改善 |
| `tasks/todo/20260510-1433-drawing-reference-graph.md` | Markdown | 部屋、記号、寸法、詳細参照 graph task | 空間・cross-sheet QA 改善 |
| `tasks/todo/20260510-1433-drawing-abstention-evidence-gate.md` | Markdown | evidence sufficiency / abstention 強化 task | unsupported answer 抑制 |
| `tasks/todo/20260510-1433-drawing-benchmark-diagnostic-metrics.md` | Markdown | 診断用サブスコア追加 task | failure taxonomy 評価 |
| `tasks/todo/20260510-1433-drawing-ocr-vlm-extraction-pipeline.md` | Markdown | 局所 OCR / VLM-OCR 抽出 pipeline task | 局所読解改善 |
| `reports/working/20260510-1433-drawing-qarag-todo-plan.md` | Markdown | 本作業レポート | Post Task Work Report 対応 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 提示された改善方針を後続 task に分解した。 |
| 制約遵守 | 4 | `/plan` として実装には進まず、task 追加までに留めた。 |
| 成果物品質 | 4 | 各 task に受け入れ条件、検証計画、レビュー観点を入れた。 |
| 説明責任 | 4 | 未実装・未検証を明記した。 |
| 検収容易性 | 5 | task file と report のパスを明示した。 |

総合fit: 4.4 / 5.0（約88%）

理由: todo task 化という主目的は満たした。今回は計画依頼として扱ったため、各 todo task の実装と benchmark run は未実施。

## 7. 実行した検証

- `rg` による required section inspection: pass
- `git diff --check`: pass
- `pre-commit run --files reports/working/20260510-1433-drawing-qarag-todo-plan.md tasks/done/20260510-1433-drawing-qarag-todo-plan.md tasks/todo/20260510-1433-drawing-*.md`: pass

## 8. 未対応・制約・リスク

- 未対応事項: todo task の実装、benchmark 実行は未実施。
- 制約: 今回は `/plan` の依頼として扱い、実装へ進めていない。
- リスク: 各 task の優先順位は、実際の architecture-drawing-qarag failure taxonomy で入れ替わる可能性がある。
