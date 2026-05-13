# Open Questions

| ID | Related | Question | Why it matters | Proposed default | Owner | Status |
|---|---|---|---|---|---|---|
| Q-001 | GAP-003, REQ-DOC-001 | 対応 mime type の正式リストは何か。PDF/Markdown/text 以外を許可するか。 | upload validation、E2E fixture、運用案内に必要。 | `text/plain`, `text/markdown`, `application/pdf` から開始 | PO/Tech Lead | open |
| Q-002 | GAP-003, REQ-DOC-001 | ファイルサイズ上限、ページ数上限、OCR timeout/retry の本番値は何か。 | 巨大/破損 PDF の境界値と cost guard に必要。 | 環境変数で上限管理し、超過時は明示エラー | PO/Ops | open |
| Q-003 | GAP-004, REQ-RAG-001, REQ-SEC-001 | prompt injection 文書の標準テスト corpus と期待拒否文言をどう定義するか。 | RAG セキュリティを benchmark/E2E に組み込むため。 | 悪意命令を含む小規模 corpus を seed する | Security/QA | open |
| Q-004 | GAP-005, REQ-HIST-001 | 会話履歴の保持期間、最大件数、pagination、favorite 専用 index は必要か。 | DynamoDB item size、費用、UX に影響する。 | 初期は最大件数と pagination を追加検討 | PO/Tech Lead | open |
| Q-005 | GAP-006, REQ-OPS-001 | chat latency、heartbeat 間隔、benchmark cost、UI a11y の受け入れ基準値は何か。 | 非機能要件の合否判定に必要。 | SQ/NFR から代表値を再利用 | PO/QA | open |
| Q-006 | GAP-011, REQ-BENCH-001 | CodeBuild 上で runner auth、MMRAG DocQA corpus skip、artifact download は再確認済みか。 | local test では AWS 依存挙動を保証できない。 | 次回 benchmark run 結果を入力ソースに追加 | Ops | open |
| Q-007 | REQ-ADM-001, SPEC-ADM-001 | 既存環境のユーザーに `BENCHMARK_OPERATOR` など新 role をどう移行するか。 | role 定義修正後も既存ユーザーの group 付け替えが必要。 | 管理画面から再付与、必要なら one-shot migration | Ops/Admin | open |
| Q-008 | GAP-007, SPEC-SRCH-001 | retrieval evaluator の `query_rewrite` / `expand_context` をいつ実装するか。 | partial retrieval の改善と trace/action の完全性に関わる。 | 次の RAG 改善 PR で action executor を追加 | Tech Lead | open |
| Q-009 | GAP-008, SPEC-DBG-001 | debug trace `detail` の raw text を保存時 sanitize するか、download 時 redact するか。 | 管理者 artifact の機微情報露出リスクに関わる。 | 保存時 sanitize と download allowlist を優先 | Security | open |
| Q-010 | GAP-001, GAP-012, GAP-013 | 新規作業レポートが追加されたとき、`12_report_reading_inventory.md` をどのタイミングで更新するか。 | 本文精読 inventory を継続的に最新化するため。 | PR ごと、または spec recovery 更新時に差分 report だけ追記 | PO/Codex | open |
| Q-011 | GAP-002 | 既存 `FR-*` / `NFR-*` の受け入れ条件と今回の `AC-*` をどの形式で同期するか。 | 既存要件体系と spec recovery の二重管理を避けるため。 | traceability matrix に既存 FR/NFR ID 列を追加 | Tech Writer | open |
| Q-012 | REQ-DOCS-001 | commit/PR/merge only 以外の process レポートを product docs とは別の process requirements として管理するか。 | agent workflow や PR flow も repo の品質要件だが、product requirement と混ぜると仕様が読みにくくなるため。 | `docs/spec-recovery/process-requirements.md` など別ファイルに分離 | Tech Lead | open |
