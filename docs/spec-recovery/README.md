# rag-assist 仕様復元インデックス

## 目的

作業レポートを起点として、tasks、受け入れ条件、E2Eシナリオ、画面操作・期待値、要件、仕様を双方向にトレース可能な形で整理する。

## 使用する skill

起点は `skills/rag-assist-spec-completion-orchestrator/SKILL.md` とする。各工程では必要に応じて以下を併用する。

- `skills/work-report-task-extractor-ja/SKILL.md`
- `skills/acceptance-criteria-writer-ja/SKILL.md`
- `skills/e2e-scenario-writer-ja/SKILL.md`
- `skills/operation-expectation-clusterer-ja/SKILL.md`
- `skills/requirement-spec-synthesizer-ja/SKILL.md`
- `skills/rag-quality-and-security-spec-ja/SKILL.md`
- `skills/traceability-gap-analysis-ja/SKILL.md`

## 成果物

- [00_input_inventory.md](00_input_inventory.md)
- [01_report_facts.md](01_report_facts.md)
- [02_tasks.md](02_tasks.md)
- [03_acceptance_criteria.md](03_acceptance_criteria.md)
- [04_e2e_scenarios.md](04_e2e_scenarios.md)
- [05_operation_expectation_groups.md](05_operation_expectation_groups.md)
- [06_requirements.md](06_requirements.md)
- [07_specifications.md](07_specifications.md)
- [08_traceability_matrix.md](08_traceability_matrix.md)
- [09_gap_analysis.md](09_gap_analysis.md)
- [10_open_questions.md](10_open_questions.md)

## 検証

成果物作成後、可能な範囲で次を実行する。

```bash
python3 scripts/validate_spec_recovery.py docs/spec-recovery
```

この validator は期待ファイルや代表的な ID の存在を軽量に確認する。警告は、仕様復元が未完成か、意図的に未作成の成果物があることを示すため、完了報告では警告の扱いを明記する。
