# 作業レポート起点の仕様復元

状態: done

## 背景

導入済みの仕様復元 skill 群を使い、`rag-assist` / `memorag-bedrock-mvp` の作業レポート、task、PR、既存 docs、既存 tests から、根拠付きの要件・仕様候補を実際に洗い出す。

## 目的

作業レポート起点の要件復元・受け入れテスト駆動の仕様化・トレーサビリティ付き欠落分析を、`docs/spec-recovery/` の成果物として作成する。

## スコープ

- `reports/working/`、`reports/bugs/`、`tasks/done/`、既存 docs、既存 tests、PR 情報の入力棚卸し
- `docs/spec-recovery/00_input_inventory.md` から `10_open_questions.md` までの作成・更新
- RAG 品質、引用、根拠なし応答、権限、セキュリティ、異常系、非機能の欠落分析
- validator と Markdown/pre-commit 検証
- commit、push、PR、PR コメント、作業レポート

## 計画

1. 入力ソースを棚卸しし、代表的な作業レポート・docs・tests を読む。
2. 事実、task、受け入れ条件、E2E、操作/期待値、要件、仕様を作成する。
3. 双方向トレースと gap/open question を作成する。
4. validator と docs 検証を実行し、警告を解消または意図を記録する。
5. 作業レポート、commit、PR、受け入れ条件コメント、セルフレビューコメントまで完了する。

## ドキュメント保守計画

- durable 成果物は `docs/spec-recovery/` に集約する。
- 一時的な判断・作業履歴は `reports/working/` に残す。
- アプリ本体の挙動変更は行わないため、API/Web/infra docs は既存仕様の根拠として参照し、必要な場合のみリンクや gap として記録する。

## 受け入れ条件

- [x] `00_input_inventory.md` に入力ソース ID、種別、日付、信頼度が記録されている。
- [x] `01_report_facts.md` と `02_tasks.md` に、根拠付き事実と原子的 task が記録されている。
- [x] `03_acceptance_criteria.md` に、各 task の正常系・異常系・権限・境界値・RAG 品質・セキュリティの受け入れ条件または gap がある。
- [x] `04_e2e_scenarios.md` と `05_operation_expectation_groups.md` に、日本語 E2E、非UI検証、OP/EXP が記録されている。
- [x] `06_requirements.md` と `07_specifications.md` に、画面操作をそのまま要件化しない抽象化済みの要件・仕様がある。
- [x] `08_traceability_matrix.md`、`09_gap_analysis.md`、`10_open_questions.md` に双方向トレース、欠落、未確定事項が記録されている。
- [x] `scripts/validate_spec_recovery.py docs/spec-recovery` を実行し、警告を解消または意図を記録している。
- [x] 変更範囲に対して `git diff --check` と可能な pre-commit 検証を実行している。
- [x] 作業完了レポートを `reports/working/` に保存している。
- [x] PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿している。

## 検証計画

- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- `git diff --check`
- `pre-commit run --files <changed-files>` when available

## PR レビュー観点

- 根拠付き項目と推定・未確定項目を混ぜていないこと
- 仕様候補が UI 操作の羅列ではなく、要件/仕様へ抽象化されていること
- RAG 品質、引用、根拠なし応答、認可境界、prompt injection、非機能が gap として可視化されていること
- 実施していない検証を実施済み扱いしていないこと

## リスク

- 入力ソースが多いため、初回は全量網羅よりも代表ソースに基づく高信頼な初版を優先する。
- 実装やテストから推定した仕様は `inferred` とし、確定仕様として扱わない。

## 完了メモ

- 完了日: 2026-05-08
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/189
- 成果物: `docs/spec-recovery/00_input_inventory.md` から `10_open_questions.md`、`traceability_matrix.csv`
- 作業レポート: `reports/working/20260508-1217-spec-recovery-initial.md`
- PR コメント: 受け入れ条件確認コメント、セルフレビューコメントを投稿済み
- PR 作成方法: GitHub Apps の PR 作成ツールが利用可能一覧に出なかったため、`gh pr create` で代替
