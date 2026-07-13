# 管理画面 要件候補索引（2026-07）

## 文書メタ情報

- 文書種別: 要件候補索引
- Status: proposed / non-normative
- Baseline: `origin/main` / `9cd904d3c5203caf2400eb2ff654096d63f9d8fb`
- 目的: 現行 gap を原子的な後続要件へ整理し、承認後に canonical product requirement へ移管できるようにする

## 要件候補

| Requirement | 要約 | Priority | Confidence | Task | 主な Gap |
| --- | --- | --- | --- | --- | --- |
| [REQ-AUI-001](admin-ui-202607/requirements/REQ_AUI_001.md) |請求対象実行を一意な tenant-scoped usage record へ追跡する | P0 | confirmed | `TASK-AUI-001` | `GAP-AUI-001`, `003`, `030` |
| [REQ-AUI-002](admin-ui-202607/requirements/REQ_AUI_002.md) |有効期間付き pricing で usage の費用根拠を再現する | P0 | confirmed/open_question | `TASK-AUI-002` | `GAP-AUI-002`, `004` |
| [REQ-AUI-003](admin-ui-202607/requirements/REQ_AUI_003.md) |利用・料金の状態と内訳を安全に分析・export する | P1 | confirmed | `TASK-AUI-003` | `GAP-AUI-004`–`008`, `036` |
| [REQ-AUI-004](admin-ui-202607/requirements/REQ_AUI_004.md) |application role の canonical catalog を一つにする | P0 | conflict | `TASK-AUI-004` | `GAP-AUI-009`, `011`, `012`, `033` |
| [REQ-AUI-005](admin-ui-202607/requirements/REQ_AUI_005.md) |明示した role delta だけを guard 付きで反映する | P0 | confirmed | `TASK-AUI-005` | `GAP-AUI-010`, `013`, `014` |
| [REQ-AUI-006](admin-ui-202607/requirements/REQ_AUI_006.md) |account lifecycle を identity/session の強制状態へ一致させる | P0 | confirmed | `TASK-AUI-006` | `GAP-AUI-015`–`017` |
| [REQ-AUI-007](admin-ui-202607/requirements/REQ_AUI_007.md) |多数 user の管理対象・role・group・実効権限を探索する | P1 | confirmed/conflict | `TASK-AUI-007` | `GAP-AUI-018`, `019`, `030`, `033` |
| [REQ-AUI-008](admin-ui-202607/requirements/REQ_AUI_008.md) |全管理 mutation の全 result を共通監査へ残す | P0 | conflict | `TASK-AUI-008` | `GAP-AUI-007`, `026`–`028` |
| [REQ-AUI-009](admin-ui-202607/requirements/REQ_AUI_009.md) |query state と競合を真実どおり表示・処理する | P0 | confirmed | `TASK-AUI-009` | `GAP-AUI-019`–`023`, `028` |
| [REQ-AUI-010](admin-ui-202607/requirements/REQ_AUI_010.md) |overview から URL 復元可能な対応導線を提供する | P1 | confirmed/inferred | `TASK-AUI-010` | `GAP-AUI-020`–`025` |
| [REQ-AUI-011](admin-ui-202607/requirements/REQ_AUI_011.md) |alias state transition を理由・version 付き command にする | P1 | confirmed | `TASK-AUI-011` | `GAP-AUI-027`, `029` |
| [REQ-AUI-012](admin-ui-202607/requirements/REQ_AUI_012.md) |主要管理 task を端末・支援技術非依存で完了可能にする | P1 | confirmed evidence gap | `TASK-AUI-012` | `GAP-AUI-031`–`035` |
| [REQ-AUI-013](admin-ui-202607/requirements/REQ_AUI_013.md) |usage/cost 新経路を比較・canary・rollback gate 付きで移行する | P0 rollout | confirmed candidate/open_question | `TASK-AUI-013` | `GAP-AUI-008`, `030`, `035` |

## 承認・移管規則

1. 本 index と配下ファイルは `proposed` であり、既存の `FR-027`, `FR-079`, `FR-080`, `FR-086` を自動的に上書きしない。
2. Product/Security/Identity/FinOps/Ops が [29_admin_ui_open_questions_202607.md](29_admin_ui_open_questions_202607.md) を決定した後、要件ごとに canonical REQ directory へ移管する。
3. 移管時は requirement ID の重複を避け、旧要件との supersede/refine 関係と migration date を baseline に記録する。
4. UI 操作の詳細は要件本文に固定せず、AC/E2E/specification から検証する。
