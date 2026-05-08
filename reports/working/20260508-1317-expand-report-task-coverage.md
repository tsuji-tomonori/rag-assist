# 作業完了レポート

保存先: `reports/working/20260508-1317-expand-report-task-coverage.md`

## 1. 受けた指示

- PR #189 の仕様復元結果について、作業レポート件数に対して task 数が少なく見えるため、全量かどうか確認する。
- commit などの操作に対するレポートは無理に task にしなくてよい。

## 2. 要件整理

- 既存の task 10 件は代表ソースからの初版抽出であり、全量ではないことを明示する。
- `reports/working/*.md` と `reports/bugs/*.md` を全量ファイル分類する。
- commit/PR/merge/CI コメント/競合解消/task acceptance のみのレポートは task 化対象外にする。
- 機能・挙動・品質・運用に関係するカテゴリから追加 task family を抽出する。

## 3. 実施作業

- 作業/障害レポート 391 件をファイル単位で分類した。
- `docs/spec-recovery/00_input_inventory.md` に全量分類結果と除外方針を追加した。
- `FACT-016` から `FACT-025` を追加した。
- `TASK-011` から `TASK-024` を追加し、task 数を 10 件から 24 件へ増やした。
- 追加 task に対応する `AC-*`、E2E、OP/EXP、REQ、SPEC、traceability を追加した。
- `GAP-001` と `Q-010` を、代表抽出の未完了表現から「全量分類済み、本文精読/個別 RPT ID は残課題」へ更新した。
- `docs/spec-recovery/11_report_coverage.md` を追加し、分類件数と task 化方針をまとめた。

## 4. 成果物

- `docs/spec-recovery/00_input_inventory.md`
- `docs/spec-recovery/01_report_facts.md`
- `docs/spec-recovery/02_tasks.md`
- `docs/spec-recovery/03_acceptance_criteria.md`
- `docs/spec-recovery/04_e2e_scenarios.md`
- `docs/spec-recovery/05_operation_expectation_groups.md`
- `docs/spec-recovery/06_requirements.md`
- `docs/spec-recovery/07_specifications.md`
- `docs/spec-recovery/08_traceability_matrix.md`
- `docs/spec-recovery/09_gap_analysis.md`
- `docs/spec-recovery/10_open_questions.md`
- `docs/spec-recovery/11_report_coverage.md`
- `docs/spec-recovery/traceability_matrix.csv`
- `tasks/do/20260508-1310-expand-report-task-coverage.md`

## 5. fit 評価

- 指示への fit: 全量かどうかの曖昧さを解消し、全量ファイル分類と task 化対象外方針を仕様成果物へ反映した。
- commit 操作レポート: task 化対象外として明示した。
- task 粒度: report 1 件を task 1 件にせず、observable behavior に基づく task family として集約した。

## 6. 未対応・制約・リスク

- 391 件すべての本文精読は未実施。今回は全量ファイル分類とカテゴリ単位の task family 抽出である。
- 未分類または横断カテゴリ 37 件は、次バッチで本文精読が必要。
- 代表ソース以外はカテゴリ source として扱っており、全 report への個別 `RPT-*` ID 採番は未実施。
