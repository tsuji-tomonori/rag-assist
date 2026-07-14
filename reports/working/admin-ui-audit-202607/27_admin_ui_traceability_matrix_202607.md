# 管理画面 双方向トレーサビリティ（2026-07）

## 読み方

Forwardはsource/factから実装・検証候補へ、Reverseはrequirement/ACから根拠へ戻る。範囲表記は同じtaskに属する連続IDであり、各AC本文は [22_admin_ui_acceptance_criteria_202607.md](22_admin_ui_acceptance_criteria_202607.md) に一意に定義される。

## Forward matrix: evidence → validation

| Source | Facts | Gap | Task | Requirement | Specification | AC | E2E | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SRC-AUI-001`, `002`, `004`, `005`, `007`, `011`, `013` | `FACT-AUI-011`–`018`, `077`–`081` | `GAP-AUI-001`, `003`, `008`, `030` | `TASK-AUI-001` | `REQ-AUI-001` | `SPEC-AUI-001` | `AC-AUI-001`–`012` | `E2E-AUI-001`, `002`, `016`, `017` | confirmed / candidate |
| `SRC-AUI-004`, `005`, `008`–`011`, `013` | `FACT-AUI-019`–`023`, `026`, `075`, `080` | `GAP-AUI-002`, `004` | `TASK-AUI-002` | `REQ-AUI-002` | `SPEC-AUI-002` | `AC-AUI-013`–`024` | `E2E-AUI-001`–`003` | confirmed / open_question |
| `SRC-AUI-002`, `004`, `008`, `009` | `FACT-AUI-024`–`030` | `GAP-AUI-004`–`007`, `036` | `TASK-AUI-003` | `REQ-AUI-003` | `SPEC-AUI-003` | `AC-AUI-025`–`040` | `E2E-AUI-002`, `003` | confirmed / conflict |
| `SRC-AUI-002`, `004`–`009` | `FACT-AUI-035`–`039`, `052` | `GAP-AUI-009`, `011`, `012`, `033` | `TASK-AUI-004` | `REQ-AUI-004` | `SPEC-AUI-004` | `AC-AUI-041`–`052` | `E2E-AUI-004` | conflict |
| `SRC-AUI-002`, `004`–`008`, `011` | `FACT-AUI-031`–`043`, `073` | `GAP-AUI-010`, `013`, `014`, `028` | `TASK-AUI-005` | `REQ-AUI-005` | `SPEC-AUI-005` | `AC-AUI-053`–`068` | `E2E-AUI-005`, `006` | confirmed / conflict |
| `SRC-AUI-002`, `004`–`008`, `011` | `FACT-AUI-044`–`050` | `GAP-AUI-015`–`017` | `TASK-AUI-006` | `REQ-AUI-006` | `SPEC-AUI-006` | `AC-AUI-069`–`081` | `E2E-AUI-007`, `008` | confirmed |
| `SRC-AUI-002`–`009`, `011` | `FACT-AUI-051`–`053` | `GAP-AUI-018`, `019`, `030`, `033` | `TASK-AUI-007` | `REQ-AUI-007` | `SPEC-AUI-007` | `AC-AUI-082`–`093` | `E2E-AUI-009` | confirmed / conflict |
| `SRC-AUI-002`, `004`, `005`, `008`, `009` | `FACT-AUI-054`–`058` | `GAP-AUI-007`, `026`–`028` | `TASK-AUI-008` | `REQ-AUI-008` | `SPEC-AUI-008` | `AC-AUI-094`–`105` | `E2E-AUI-010` | confirmed / conflict |
| `SRC-AUI-002`–`005`, `007`, `011` | `FACT-AUI-004`–`008`, `053`, `058`, `063`–`066` | `GAP-AUI-019`–`023`, `028` | `TASK-AUI-009` | `REQ-AUI-009` | `SPEC-AUI-009` | `AC-AUI-106`–`116` | `E2E-AUI-002`, `006`, `008`, `011` | confirmed |
| `SRC-AUI-002`–`005`, `009` | `FACT-AUI-001`–`010` | `GAP-AUI-020`–`025` | `TASK-AUI-010` | `REQ-AUI-010` | `SPEC-AUI-010` | `AC-AUI-117`–`125` | `E2E-AUI-011`, `012` | confirmed / inferred |
| `SRC-AUI-002`, `004`, `005`, `007`, `009` | `FACT-AUI-056`, `059`–`062`, `073` | `GAP-AUI-027`, `029` | `TASK-AUI-011` | `REQ-AUI-011` | `SPEC-AUI-011` | `AC-AUI-126`–`134` | `E2E-AUI-013` | confirmed |
| `SRC-AUI-002`, `003`, `007`, `012`, `014` | `FACT-AUI-003`, `065`–`074` | `GAP-AUI-031`–`035` | `TASK-AUI-012` | `REQ-AUI-012` | `SPEC-AUI-012` | `AC-AUI-135`–`146` | `E2E-AUI-014`, `015` | confirmed evidence gap |
| `SRC-AUI-008`, `010`, `011`, `013` | `FACT-AUI-075`–`081` | `GAP-AUI-008`, `030`, `035` | `TASK-AUI-013` | `REQ-AUI-013` | `SPEC-AUI-013` | `AC-AUI-147`–`158` | `E2E-AUI-016`, `017` | confirmed candidate / open_question |

## Reverse matrix: requirement → evidence and decisions

| Requirement | Requirement file | Primary evidence | Open questions | Done evidence |
| --- | --- | --- | --- | --- |
| `REQ-AUI-001` | `admin-ui-202607/requirements/REQ_AUI_001.md` | service usage initialization/read、provider/candidate event path | `OQ-AUI-003`, `010`, `016` | adapter integration、idempotency/cursor/replay、live canary |
| `REQ-AUI-002` | `admin-ui-202607/requirements/REQ_AUI_002.md` | current fixed rates/period mismatch、cost-design report | `OQ-AUI-001`–`005` | deterministic calculation、catalog validation、billing reconciliation |
| `REQ-AUI-003` | `admin-ui-202607/requirements/REQ_AUI_003.md` | Web cost/usage panelsと既存export routes | `OQ-AUI-005`, `010`, `017` | Web E2E、authorization、query/export equivalence |
| `REQ-AUI-004` | `admin-ui-202607/requirements/REQ_AUI_004.md` | authorization catalog、infra Cognito groups、role panel | `OQ-AUI-006`, `007`, `022` | catalog/provisioning drift、UI search/compare |
| `REQ-AUI-005` | `admin-ui-202607/requirements/REQ_AUI_005.md` | single-select Web、assign route/service、`FR-080` | `OQ-AUI-006`, `018` | guard/concurrency/fault-injection、multi-role E2E |
| `REQ-AUI-006` | `admin-ui-202607/requirements/REQ_AUI_006.md` | ledger-only lifecycle、JWT auth、directory sync | `OQ-AUI-006`, `008`, `009`, `019` | live/sandbox identity、protected-route、reconciliation |
| `REQ-AUI-007` | `admin-ui-202607/requirements/REQ_AUI_007.md` | AdminUserPanel、chapter §11 | `OQ-AUI-010`, `020`, `022` | scale/cursor、field permission、row-state E2E |
| `REQ-AUI-008` | `admin-ui-202607/requirements/REQ_AUI_008.md` | audit schema/store/routes、`FR-086` | `OQ-AUI-011`–`013` | all-result contract、atomicity、redaction/export/retention |
| `REQ-AUI-009` | `admin-ui-202607/requirements/REQ_AUI_009.md` | loader/API wrappers/shared JSON store | `OQ-AUI-010`, `012` | state-transition、runtime contract、concurrency/idempotency |
| `REQ-AUI-010` | `admin-ui-202607/requirements/REQ_AUI_010.md` | AdminWorkspace/Overview、quality-actions route、chapter §10 | `OQ-AUI-005`, `014` | route/history、projection permission、failure-state E2E |
| `REQ-AUI-011` | `admin-ui-202607/requirements/REQ_AUI_011.md` | AliasAdminPanel/service/test | `OQ-AUI-021` | transition table、version/audit、browser E2E |
| `REQ-AUI-012` | `admin-ui-202607/requirements/REQ_AUI_012.md` | CSS/components/generated inventory、UI/a11y policy | `OQ-AUI-015`, `022` | 320px/400%/keyboard/AT/contrast/manual evidence |
| `REQ-AUI-013` | `admin-ui-202607/requirements/REQ_AUI_013.md` | PR #339 candidate code/reports/workflows | `OQ-AUI-001`, `003`, `010`, `013`, `016` | migration/load/security/live canary/rollback/reconciliation |

## Fact coverage

| Fact range | Covered by |
| --- | --- |
| `FACT-AUI-001`–`010` | `GAP-AUI-020`–`025`; `TASK/REQ/SPEC-AUI-010` |
| `FACT-AUI-011`–`018` | `GAP-AUI-001`, `003`; `TASK/REQ/SPEC-AUI-001` |
| `FACT-AUI-019`–`030` | `GAP-AUI-002`, `004`–`007`, `036`; `TASK/REQ/SPEC-AUI-002`, `003` |
| `FACT-AUI-031`–`043` | `GAP-AUI-009`–`014`, `028`; `TASK/REQ/SPEC-AUI-004`, `005` |
| `FACT-AUI-044`–`053` | `GAP-AUI-015`–`019`, `030`, `033`; `TASK/REQ/SPEC-AUI-006`, `007`, `009` |
| `FACT-AUI-054`–`062` | `GAP-AUI-026`–`029`; `TASK/REQ/SPEC-AUI-008`, `011` |
| `FACT-AUI-063`–`074` | `GAP-AUI-020`–`023`, `031`–`034`; `TASK/REQ/SPEC-AUI-009`, `012` |
| `FACT-AUI-075`–`081` | `GAP-AUI-008`, `035`; `TASK/REQ/SPEC-AUI-013` |

## AC/E2E coverage

| AC range | Primary type coverage | E2E / non-UI coverage |
| --- | --- | --- |
| `AC-AUI-001`–`024` | normal、missing、empty、delay、boundary、permission、tenant、idempotency、pricing error | `E2E-AUI-001`, `002`, API/provider tests |
| `AC-AUI-025`–`052` | query/filter/page/export/own scope、catalog read/search/compare/drift/error | `E2E-AUI-003`, `004`, API auth/catalog tests |
| `AC-AUI-053`–`081` | grant/revoke、guards、conflict、partial failure、identity lifecycle | `E2E-AUI-005`–`008`, route/service/live identity tests |
| `AC-AUI-082`–`105` | user exploration、row recovery、audit all results/export/redaction/retention | `E2E-AUI-009`, `010`, scale/security tests |
| `AC-AUI-106`–`134` | query states、schema/error、URL/action、alias transitions | `E2E-AUI-011`–`013`, component/contract/concurrency tests |
| `AC-AUI-135`–`158` | responsive/a11y/localization、migration/scale/live/rollback | `E2E-AUI-014`–`017`, manual evidence/load/live canary |

## Trace integrity rules

1. `FACT-AUI-*` を追加・変更したら、対応 `GAP-AUI-*` とforward rowを更新する。
2. `GAP-AUI-*` をclosedにするPRは、対応Task/Requirement/ACのうち対象範囲とnot-applicableを明示する。
3. ACを変更したらrequirement fileの受け入れ条件、E2E scenario、test evidenceを同じPRで更新する。
4. open questionを閉じたらdecision recordと影響requirement/spec/ACを更新する。値だけを実装へ直書きしない。
5. PR #339の状態・headが変わった場合は `SRC-AUI-013`, `FACT-AUI-077`–`081`, `REQ-AUI-013` を再確認する。
