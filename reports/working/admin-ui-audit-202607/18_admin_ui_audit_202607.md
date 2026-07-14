# 管理画面 問題監査・改善方針（2026-07）

## 文書メタ情報

- 調査基準: `origin/main` / `9cd904d3c5203caf2400eb2ff654096d63f9d8fb`
- 調査日: 2026-07-13
- 対象: 管理画面、関連 API、認証・認可、store、schema、tests、要求・設計・作業レポート
- 性質: 仕様復元・gap 分析。規範的な製品要件の確定ではない
- 主成果物: [28_admin_ui_gap_analysis_202607.md](28_admin_ui_gap_analysis_202607.md)、[21_admin_ui_tasks_202607.md](21_admin_ui_tasks_202607.md)、[22_admin_ui_acceptance_criteria_202607.md](22_admin_ui_acceptance_criteria_202607.md)

## 結論

指摘された「利用しても料金が 0」「ロール一覧が見にくい」は、表示調整だけでは解消しない。

料金が 0 になる直接原因は、現行 main の `AdminLedger.usage` が初期化されるだけで、チャット・RAG・embedding 等の実行時に加算されないことである。そのゼロ件数に固定単価を掛けているため、UI は API の計算結果を正しく表示していても、入力データが実利用を表していない。さらに「当月」と表示する期間に全期間の文書・benchmark・debug を混ぜ、固定日・固定単価・異なる benchmark 単価を使うため、0 以外でも監査可能な月次コストにはなっていない。

ロール周辺は、API が複数ロール配列を扱う一方、UI が単一 select の選択値を `[selectedRole]` として保存するため、ロールを一つ付与すると既存の複数ロールを消す。ロール一覧も内部コードと permission 文字列のカンマ列だけで、表示名、用途、危険権限、割当人数、比較、検索、application role と resource group の区別を持たない。これは可読性だけでなく、安全な権限変更契約の欠落である。

加えて、ユーザー停止・削除は管理台帳だけを変更し、Cognito、token、session を無効化しない。画面の「アプリを利用できなくなる」という確認文と実際の強制境界が一致しないため、最優先で是正する必要がある。

## 最優先の問題

| 優先度 | Gap | 問題 | 影響 | 改善の核 |
| --- | --- | --- | --- | --- |
| P0 | `GAP-AUI-001` | 実行時 usage が記録されず、利用後も件数・料金が 0 | コスト判断不能、誤った未利用判定 | provider usage を idempotent な usage event として保存し、欠測を 0 と分離 |
| P0 | `GAP-AUI-002` | 期間・単価・confidence が監査可能な契約になっていない | 0 以外でも金額の根拠を説明できない | versioned pricing、同一期間、実測/推定/欠測、出典・地域・モデルを明示 |
| P0 | `GAP-AUI-010` | 単一 select が複数ロール全体を置換 | 意図しない権限喪失または付与 | grant/revoke と最終 role set を明示する multi-role editor |
| P0 | `GAP-AUI-013` | role mutation に reason、last-admin、active/tenant、原子的監査がない | 自己昇格、管理者喪失、部分更新 | canonical catalog と一つの guard/commit contract |
| P0 | `GAP-AUI-016` | 停止・削除が Cognito/session に効かない | 停止済み利用者が利用を継続し得る | authoritative identity、session revoke、台帳、監査を一つの lifecycle にする |
| P0 | `GAP-AUI-021` | 初期 load 失敗を console に捨て、0・未提供・空として表示 | 障害を正常なゼロと誤認 | `loading/success-empty/success-data/error/forbidden/stale` を分離 |
| P1 | `GAP-AUI-026` | 管理 audit が成功した user/role 操作の直近 100 件だけ | 拒否・競合・失敗や横断調査が不能 | 共通 schema、検索、cursor、専用 read/export 権限、不可分永続化 |
| P1 | `GAP-AUI-031` | 320 px、400% zoom、keyboard、screen reader、contrast の検証なし | モバイル・支援技術利用時の操作不能リスク | レスポンシブ再構成、状態通知、対象を含む accessible name、手動/自動 gate |

## 改善の実施順

1. Security/data integrity: account lifecycle、role mutation、ledger の競合制御と監査を先に直す。
2. Measurement truth: usage event、period query、pricing catalog、completeness を確立する。
3. Decision UI: usage/cost、role/user、audit、dashboard を新しい read model に接続する。
4. Governance: alias、export、権限分割、保持・redaction を統一する。
5. Experience/quality gate: URL、状態表示、responsive、a11y、E2E、live AWS smoke を release gate にする。

既存 PR #339 は usage event と completeness、期間集計、usage/cost export UI の有力な実装候補だが、2026-07-13 時点で未マージであり、DynamoDB scan の 1,000 件上限、tenant が `default` 固定、汎用固定 pricing、現行 main との大きな差分、live AWS 未検証が残る。そのまま「料金問題の完了」とは扱わず、`TASK-AUI-013` の再適合・移行対象とする。

## 読み方

| 読みたい内容 | 成果物 |
| --- | --- |
| 調査範囲、全 section/API/store/permission/test 対応 | [19_admin_ui_input_inventory_202607.md](19_admin_ui_input_inventory_202607.md) |
| コード・テスト・文書から確定した事実 | [20_admin_ui_facts_202607.md](20_admin_ui_facts_202607.md) |
| 実装可能な改善単位、依存関係、順序 | [21_admin_ui_tasks_202607.md](21_admin_ui_tasks_202607.md) |
| 原子的な Given/When/Then | [22_admin_ui_acceptance_criteria_202607.md](22_admin_ui_acceptance_criteria_202607.md) |
| 画面 E2E と UI 非依存検証 | [23_admin_ui_e2e_scenarios_202607.md](23_admin_ui_e2e_scenarios_202607.md) |
| 操作・期待値のまとまり | [24_admin_ui_operation_expectation_groups_202607.md](24_admin_ui_operation_expectation_groups_202607.md) |
| 要件候補の索引 | [25_admin_ui_requirements_202607.md](25_admin_ui_requirements_202607.md) |
| API/read model/UI/security の仕様候補 | [26_admin_ui_specifications_202607.md](26_admin_ui_specifications_202607.md) |
| source から AC/test までの双方向 trace | [27_admin_ui_traceability_matrix_202607.md](27_admin_ui_traceability_matrix_202607.md) |
| 全問題、重大度、影響、根拠、改善方針 | [28_admin_ui_gap_analysis_202607.md](28_admin_ui_gap_analysis_202607.md) |
| 料金・閾値・権限運用などの未決事項 | [29_admin_ui_open_questions_202607.md](29_admin_ui_open_questions_202607.md) |

## 確度と完了境界

- `confirmed`: 現行 source、test、schema、route、文書、GitHub 状態から直接確認した。
- `inferred`: 複数の確定事実から妥当と判断したが、実環境・利用者観察が必要である。
- `conflict`: 現行実装、旧要件、2026-07 canonical requirement、章仕様の間で一致しない。
- `open_question`: Product/Security/FinOps/Operations の決定なしに値や運用を確定できない。

この監査は repository の現行 main と参照可能な PR/レポートに対する網羅であり、実 AWS 請求、実 Cognito、実トラフィック、利用者調査、実端末・screen reader の結果を推定で補っていない。これらは受け入れ条件と未確定事項に明示した。
