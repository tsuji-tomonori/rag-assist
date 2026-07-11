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

### 2026-07 権限・共有・RAG 再定義

- [13_requirements_redefinition_202607.md](13_requirements_redefinition_202607.md): 要求獲得、facts、tasks、AC/E2E、要求分割、優先順位、未確定判断
- [14_authorization_sharing_matrix_202607.md](14_authorization_sharing_matrix_202607.md): identity/tenant/feature/resource、folder/document/share/UI の decision matrix
- [15_rag_lifecycle_matrix_202607.md](15_rag_lifecycle_matrix_202607.md): source admission から retrieval/generation/evaluation/delete までの lifecycle
- [16_current_state_gap_analysis_202607.md](16_current_state_gap_analysis_202607.md): current code と target requirement の exact evidence 付き gap
- [17_traceability_matrix_202607.csv](17_traceability_matrix_202607.csv): FR-056–FR-093、SQ-005–SQ-015 の source/current state/AC/test/open question trace

規範的な製品要求は `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` と各 1 要件 1 ファイルを正とする。

## 検証

成果物作成後、可能な範囲で次を実行する。

```bash
python3 scripts/validate_spec_recovery.py docs/spec-recovery
```

この validator は既存成果物と必須の 2026-07 baseline、新規成果物、CSV trace、FR/SQ の 1 宣言 1 ファイル構造、必須属性、専用 Given/When/Then AC、妥当性観点、CSV title/status、source/open-question ID と CSV から question Related への逆参照、repo-relative current-evidence path、FR-041 disposition の baseline 反映、E2E 定義、重複 gap ID、未解決 placeholder を機械検証する。意味上の原子性・十分性・source の解釈妥当性は review 対象であり、validator の成功だけでは保証しない。エラーは未解決のまま合格扱いにしない。
