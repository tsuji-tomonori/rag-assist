# 管理画面 操作・期待値クラスタ（2026-07）

## 位置づけ

利用者の画面操作と期待値を重複なく整理し、task/requirement/AC を作るための中間成果物とする。操作例は要件そのものではなく、要件を検証可能にする観察点である。

| Cluster | 利用者の目的 | 主な操作 | 観察可能な期待 | 失敗時の期待 | Task / E2E |
| --- | --- | --- | --- | --- | --- |
| `OEG-AUI-001` 計測確認 |利用が記録されたか知る | period/user/run を選ぶ、breakdown を開く | provider quantity、source、completeness、as-of が run に結び付く | missing/delayed/error を 0 と区別 | `TASK-AUI-001`; `E2E-AUI-001`, `002` |
| `OEG-AUI-002` 料金説明 |金額の根拠を説明する | subtotal から quantity/price/version へ drill-down |同一期間・単位・currency で再計算できる | unpriced/incomplete は確定 total にしない | `TASK-AUI-002`; `E2E-AUI-001`, `002` |
| `OEG-AUI-003` 利用・費用分析 |高額・増加・異常の要因を探す | filter/sort/compare/page/export |画面と export の query が一致する |権限不足・不完全比較・query failure を明示 | `TASK-AUI-003`; `E2E-AUI-003` |
| `OEG-AUI-004` ロール理解 |用途と危険度を比較する | role search/detail/compare |表示名、説明、risk、permission group、割当人数が読める | catalog drift/unknown role を可視化 | `TASK-AUI-004`; `E2E-AUI-004` |
| `OEG-AUI-005` 権限変更 |必要な role だけ付与・解除する | target/delta/reason/review/save | before/after と実効権限が一致する | self/cross-tenant/last-admin/stale/partial failure を拒否・回復 | `TASK-AUI-005`; `E2E-AUI-005`, `006` |
| `OEG-AUI-006` account lifecycle |作成・停止・復元・削除を強制する |確認、reason、実行、再照合 | identity、session、管理状態が一致する |途中失敗を成功表示せず reconciliation へ送る | `TASK-AUI-006`; `E2E-AUI-007`, `008` |
| `OEG-AUI-007` ユーザー探索 |多数 user から対象と範囲を知る | search/filter/page/detail |role/group/effective permission/source/as-of を確認できる | scope 外非表示、stale/error を明示 | `TASK-AUI-007`; `E2E-AUI-009` |
| `OEG-AUI-008` 監査調査 |誰が何をなぜ行いどう終わったか知る | filter/detail/page/export | success/denied/conflict/failed を共通 field で追える | truncation、tenant漏洩、secret露出がない | `TASK-AUI-008`; `E2E-AUI-010` |
| `OEG-AUI-009` 状態回復 |障害・競合から局所的に回復する | retry/refresh/reload/conflict review | loading/empty/data/error/forbidden/stale が別状態 |他 panel/row の成功状態を破棄しない | `TASK-AUI-009`; `E2E-AUI-011` |
| `OEG-AUI-010` 行動起点 |異常から対応箇所へ進む | action card/KPI/deep link/back |根拠と filter を保って対象 section へ移動 |失敗を 0、scope 外を件数で漏らさない | `TASK-AUI-010`; `E2E-AUI-011`, `012` |
| `OEG-AUI-011` alias governance |検索改善を安全に review/publish する | preview/transition/reason/audit | server state/version/time と差分が一致 | disabled/old version/permission 不足を拒否 | `TASK-AUI-011`; `E2E-AUI-013` |
| `OEG-AUI-012` 包摂的操作 |端末・支援技術を問わず完了する | mobile/zoom/keyboard/screen reader/touch | content、focus、name、state、contrast が理解できる |操作不能を自動/手動 gate で検出 | `TASK-AUI-012`; `E2E-AUI-014`, `015` |
| `OEG-AUI-013` 安全な移行 |候補実装を欠落なく導入する | migrate/dual-read/canary/reconcile/rollback |tenant/period/price provenance と差分証跡がある |許容差超過・live未確認で cutover しない | `TASK-AUI-013`; `E2E-AUI-016`, `017` |

## 横断的な期待値

1. actor が画面で見えない操作を直接 API へ送っても、server が同じ permission・tenant・state rule を強制する。
2. list の 0 件は query 成功時だけ empty とし、loading/error/forbidden/stale/incomplete を件数 0 に変換しない。
3. mutation は対象、before/after、reason、result、request ID を追跡し、権限外情報や secret を audit に含めない。
4. cursor/page size は UI の都合で全体集計や export を切り捨てない。
5. application role、resource group、folder visibility、effective permission を別概念として表示・契約化する。
