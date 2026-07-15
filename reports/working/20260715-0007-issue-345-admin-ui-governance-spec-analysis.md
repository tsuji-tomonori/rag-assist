# Issue #345 管理 UI governance 仕様復元分析

分析状態: confirmed_for_implementation_with_open_questions

分析日: 2026-07-15 JST

対象 commit: `902ad3f2734e859e01f97f58007dd748e4cccb5f`

## Input inventory

| ID | Source | 種別 | state | 用途 |
| --- | --- | --- | --- | --- |
| `RPT-AUI-001` | GitHub Issue `#345` | owner completion criteria | confirmed | 管理 UI、responsive/a11y、manual gate を含む全体完了条件 |
| `RPT-AUI-002` | `reports/working/admin-ui-audit-202607/18`〜`30` と `requirements/REQ_AUI_004`〜`012` | dated audit/spec recovery | confirmed / conflict / open_question | 36 gap、AC、E2E、未決事項の正本分析 |
| `RPT-AUI-003` | `tasks/do/20260714-1011-admin-ui-governance-quality.md` | active task | confirmed | 本 milestone の scope、受け入れ条件、Done 条件 |
| `RPT-AUI-004` | `FR-079`, `FR-080`, `FR-095`〜`FR-098`, `NFR-017`, `SQ-016`, `DES_UI_UX_001` | canonical REQ/DES | confirmed | role catalog、mutation guard、状態、URL、情報設計、a11y |
| `RPT-AUI-005` | `packages/contract/src/access-control.ts`、admin/alias API schema/routes/service/security policy | production contract/API | confirmed | canonical role IDs、route permission、ledger、状態遷移、silent slice |
| `RPT-AUI-006` | `apps/web/src/features/admin/`、app routing、shared resource/operation state | production Web | confirmed | panel state、URL、client fallback、UI semantics、responsive behavior |
| `RPT-AUI-007` | admin API/Web unit、contract、semantic、Playwright/visual tests | executable evidence | confirmed | 現行挙動と回帰 gate |
| `RPT-AUI-008` | `29_admin_ui_open_questions_202607.md` | owner decisions pending | open_question | pricing、threshold、page SLO、正式用語、browser/AT matrix 等の非捏造境界 |

## Report facts

| ID | state | 事実 | 根拠 |
| --- | --- | --- | --- |
| `FACT-AUI-M-001` | confirmed | `AdminWorkspace` の section は component-local state で、`/?view=admin` の query は app route validator が invalid として除去する。reload/back/forward/filter/selection を復元できない。 | RPT-AUI-006 |
| `FACT-AUI-M-002` | confirmed | overview の文書・担当者・debug・benchmark card は action だが、ユーザー・ロール・利用状況・コスト・alias card は read-only article で該当 section へ遷移できない。 | RPT-AUI-006 |
| `FACT-AUI-M-003` | confirmed | shared resource controller は admin part ごとの `loading/ready/failed/permission/stale/retrying` と client receipt `asOf` を保持するが、panel は source/as-of/status と scoped retry を表示しない。 | RPT-AUI-006 |
| `FACT-AUI-M-004` | confirmed | alias update/review/disable は expected version と必須 reason を持たず、disabled alias も review でき、generic update を同値で呼ぶ「下書き化」は no-op に近い。 | RPT-AUI-005, RPT-AUI-006 |
| `FACT-AUI-M-005` | confirmed | alias review 後の client は API/list response が一致しない場合に status と `new Date()` を生成する。server-authoritative result を偽装し得る。 | `useAdminData.ts` |
| `FACT-AUI-M-006` | confirmed | alias ledger は単一 read-modify-write JSON で record version/CAS を使わず、alias audit は actor/time/detail のみで reason/result/before/after/version を持たない。 | RPT-AUI-005 |
| `FACT-AUI-M-007` | confirmed | admin audit は service 100 件、ledger 200 件、alias audit は service 200 件、UI 8 件に無言で切り、filter/cursor/total/truncated を返さない。 | RPT-AUI-005, RPT-AUI-006 |
| `FACT-AUI-M-008` | confirmed | role mutation service は canonical catalog、active/same-tenant/self/last-admin、authoritative identity、audit outbox/fence を server で検査する。一方 UI は単一 select を `[selectedRole]` として送り、既存複数 role を意図せず消す。 | `application-role-mutation-service.ts`, `AdminUserPanel.tsx` |
| `FACT-AUI-M-009` | conflict | role ID/permission の正本 catalog version は存在するが、正式な日本語表示名・説明・risk と identity/infra mapping の全内容は `OQ-AUI-006/022` 未決である。 | RPT-AUI-002, RPT-AUI-005, RPT-AUI-008 |
| `FACT-AUI-M-010` | confirmed | user/usage table は 920px 固定 grid と horizontal overflow に依存し、row action の accessible name は対象を含まず、主要 control の高さは 32〜38px である。 | RPT-AUI-006 |
| `FACT-AUI-M-011` | confirmed | cost API は price/usage evidence 不足を `available:false` として返す。pricing、予算/anomaly threshold、currency/rounding を fixed UI value で補ってはならない。 | RPT-AUI-005, RPT-AUI-008 |
| `FACT-AUI-M-012` | confirmed | admin route は route-level permission を持つ。alias/admin ledger の tenant partition、共通監査、export permission/retention は別 P0 task と open decision を含み、本 UI milestone で権限名を推測して変更できない。 | access-control policy, `TASK-AUI-008/009`, `OQ-AUI-011`〜`013` |
| `FACT-AUI-M-013` | confirmed | `docs/spec-recovery/` と `scripts/validate_spec_recovery.py` は current tree に存在せず、正規 docs policy は旧 `spec-recovery` root の再作成を禁止する。分析は `reports/working/`、確定事項は atomic REQ/DES/API/DATA/trace へ反映する。 | docs architecture policy, repository filesystem |
| `FACT-AUI-M-014` | open_question | support browser/OS/screen-reader/mobile matrix と正式な 400% zoom/manual device evidence は未決・未取得であり、自動 320px reflow/axe/keyboard/contrast test を手動証跡として扱えない。 | `OQ-AUI-015`, `AC-AUI-145` |

## Candidate tasks and implementation ownership

| ID | Actor / intent | Observable outcome | state |
| --- | --- | --- | --- |
| `TASK-AUI-M-001` | admin が section/query/filter/sort/selection を共有・復元する | allowlist 済み admin query が URL、reload、back/forward と一致し、権限外 section は overview へ安全に正規化される | confirmed |
| `TASK-AUI-M-002` | admin が panel data の真実性と回復方法を判断する | panel ごとに source、取得時点、current/stale/error/permission、targeted refresh を表示する | confirmed |
| `TASK-AUI-M-003` | RAG governance operator が alias を安全に遷移する | reason/expectedVersion/state guard/CAS と server response、actor/result audit だけで UI state を更新する | confirmed |
| `TASK-AUI-M-004` | operator が大規模 alias/audit を検索する | server filter、stable opaque cursor、total/truncated、load-more により silent truncation なしで到達できる | confirmed |
| `TASK-AUI-M-005` | access admin が複数 application role を意図どおり変更する | checkbox で current set を保持し grant/revoke delta と理由を確認して canonical full set を送る | confirmed |
| `TASK-AUI-M-006` | admin が role/permission/resource-group 概念を区別する | versioned catalog ID と permission category を利用者語彙で示し、raw ID を補助表示し、未提供 custom/resource-group editor を出さない | confirmed; 正式 locale/risk label は open_question |
| `TASK-AUI-M-007` | keyboard/touch/low-vision user が主要管理 task を行う | native table/list/fieldset semantics、targeted names、focus/live/busy、44px target、320px reflow が automated gate を通る | confirmed |
| `TASK-AUI-M-008` | maintainer が実装・仕様・evidence を同期する | atomic REQ/DES、API/DATA/security、trace/generated docs、tests、report/PR lifecycle が同じ contract を参照する | confirmed |

## Milestone acceptance criteria

| ID | state | 検証可能条件 |
| --- | --- | --- |
| `AC-AUI-M-001` | confirmed | `section`, `query`, domain filter, `sort`, `selected` は allowlist/length/enum 検証後に URL へ反映され、reload と popstate で同じ許可 section/context を復元する。 |
| `AC-AUI-M-002` | confirmed | overview の admin card は permission-aware button で、対応する section と必要な filter/selection へ遷移する。API field 不足、query failure、未決 threshold は zero/alert として表示しない。 |
| `AC-AUI-M-003` | confirmed | 各 panel は shared part state の source、取得時点、stale/failed/permission/busy と panel-scoped refresh を表示し、他 panel の成功 data を破棄しない。 |
| `AC-AUI-M-004` | confirmed | alias mutation request は non-empty reason と current opaque version を必須とし、server は許可 state table と CAS を検査する。disabled/old version は state を変えず 409/400 を返す。 |
| `AC-AUI-M-005` | confirmed | alias mutation success は server response の status/version/updatedAt だけを採用し、client-generated status/time fallback を持たない。audit は tenant/alias/action/actor/result/reason/before/after/version を返す。 |
| `AC-AUI-M-006` | confirmed | alias/admin-audit list は filter と stable opaque keyset cursor、`total`, `nextCursor`, `truncated`, `source`, `asOf` を返し、API/UI の固定 silent slice を持たない。 |
| `AC-AUI-M-007` | confirmed | role editor は current application role set を初期値にし、選択した grant/revoke だけを差分表示する。理由付き確認後に full canonical set を送り、server guard を UI precheck で代替しない。 |
| `AC-AUI-M-008` | confirmed / open_question constrained | UI は application role、permission category、resource group を別概念として表示し、catalog version/raw ID を補助表示する。正式日本語 role 名/risk は owner 決定前に「承認済み」と断定しない。 |
| `AC-AUI-M-009` | confirmed | user/usage/role/audit/alias は native table/list/fieldset 等の関係を持ち、row action name は action+target、region は busy/live/error、dialog は focus return を維持する。 |
| `AC-AUI-M-010` | confirmed | 320 CSS px と desktop-equivalent narrow viewport で page-level horizontal scroll に依存せず主要操作へ到達でき、large data/load-more/row error/keyboard/axe/contrast を automated test する。manual screen-reader/400% zoom/device は pending と明記する。 |

## Security and no-mock decisions

- route-level permission 名は既存 canonical catalog を維持し、未決の dedicated audit-export permission を新設しない。
- alias read/mutation は actor tenant を server で確定し、caller supplied `scope.tenantId` で他 tenant を選べないようにする。legacy tenant-less alias は明示的な default tenant 互換としてのみ扱う。
- list cursor は server sort key/ID だけを含む opaque encoding とし、permission や未返却 record を埋め込まない。invalid cursor は validation error とする。
- alias status/time/version、usage/cost、threshold、price、role label を client fallback で生成しない。
- test fixture/large dataset は test interception/store に限定し、production component fallback へ入れない。
- `apps/api/src/routes/admin-routes.ts` の request/response contract は変更するため、static access-control policy と API route/contract tests を確認する。permission/resource condition 自体を変更しない場合も回帰 test を実行する。

## Canonical docs and validation selection

更新対象は `FR-079`, `FR-080`, `FR-095`〜`FR-098`, `DES_UI_UX_001`, `DES_API_001/002`, `DES_DATA_001`, UI trace manifest と generated Web/OpenAPI/API docs。README/deploy/runbook は公開導入手順を変えないため原則更新不要とし、実装差分で再判定する。

選定 gate:

1. API alias/admin contract、service state/CAS/pagination/tenant、route permission/static policy tests。
2. Web admin API decode、hook mutation/query、component URL/multi-role/reason/pagination/a11y tests。
3. admin Playwright journey（keyboard/axe/320px/large dataset/error/retry）と visual snapshot。
4. Web/API lint、typecheck、full unit、build、semantic UI contract、generated inventory/OpenAPI freshness、docs check、`git diff --check`。
5. manual screen reader、real 400% zoom、real device/AT matrix は後続 Issue #345 manual task。未実施を pass と記録しない。

## Traceability and unresolved decisions

| Task | AC | Canonical owner | Evidence |
| --- | --- | --- | --- |
| `TASK-AUI-M-001/002` | `AC-AUI-M-001`〜`003` | `FR-095`, `FR-097`, `REQ-AUI-009/010` | route/component/E2E |
| `TASK-AUI-M-003/004` | `AC-AUI-M-004`〜`006` | `FR-096`, `REQ-AUI-008/009/011` | API state/CAS/cursor + Web journey |
| `TASK-AUI-M-005/006` | `AC-AUI-M-007/008` | `FR-079`, `FR-080`, `REQ-AUI-004/005` | catalog/service/component tests |
| `TASK-AUI-M-007` | `AC-AUI-M-009/010` | `NFR-017`, `SQ-016`, `REQ-AUI-012` | unit/axe/keyboard/visual/320px + manual pending |
| `TASK-AUI-M-008` | all | docs/trace policy | docs/generated freshness and PR evidence |

Open questions retained:

- `OQ-AUI-005`: anomaly/budget threshold。固定 card/alert を作らない。
- `OQ-AUI-006/007/018/022`: authoritative source、custom role、strong-role approval、正式日本語用語。現行 canonical preset と server guard の範囲を越えない。
- `OQ-AUI-010`: production page size/SLO。API は bounded default と caller limit を持つが、その値を production capacity/SLO と断定しない。
- `OQ-AUI-011`〜`013`: audit retention/integrity/export privacy。別 P0 task を閉じた扱いにしない。
- `OQ-AUI-015`: browser/AT/device matrix。後続 manual evidence task へ残す。
- `OQ-AUI-021`: 二者承認等の最終 alias workflow。最低保証の explicit reason/version/state/audit を実装し、追加承認者 policy を捏造しない。

`scripts/validate_spec_recovery.py` は存在せず、`docs/spec-recovery/` は正規 policy で禁止されるため適用不可。代替として canonical docs validator、traceability test、generated docs freshness を実行する。

## 実施結果

### 実装

- Alias ledger を tenant partition、record/ledger version、理由付き状態遷移、actor/result/before/after/version を持つ audit、stable opaque cursor に拡張した。公開 artifact と latest pointer も tenant key 配下へ分離した。
- admin/alias list API に filter、sort、bounded limit、`total`、`nextCursor`、`truncated`、`source`、`asOf` を追加し、Web client は runtime decoder で応答 contract を検査するようにした。
- 管理画面の `section/adminQuery/aliasStatus/auditAction/sort/selected` を allowlist 済み URL state として reload/back/forward に同期した。
- panel ごとの source/as-of/current/stale/error/permission と対象別更新を表示し、partial success では成功データを保持したまま失敗 part だけを再試行できるようにした。
- Alias 操作は server 応答だけで状態を更新し、必須 reason と current version を送る。複数 application role は current set を保持する checkbox と grant/revoke 差分確認に変更した。
- role catalog の version、system preset、permission category、raw ID を補助情報として表示し、未提供の custom role/resource-group editor、usage/cost 推定値、架空 threshold は表示しない。
- 320px reflow、44px target、対象付き accessible name、native table/list/fieldset、live/busy/error semantics を admin 固有 CSS/component に反映した。
- OpenAPI、日本語 API/DATA/DLD/UI design、Web trace manifest、generated Web/OpenAPI/API-code docs を実装に同期した。README、deploy/runbook は導入・運用手順を変更していないため更新不要と判断した。

### 成果物と fit 評価

`AC-AUI-M-001`〜`010` の automated 範囲は実装した。特に Playwright `E2E-UI-ADMIN-001` は 55 件 fixture を server-side filter し、50 件 + cursor 追加読込、選択状態 reload、320/375/768/1280 CSS px の page overflow、axe を検査する。fixture は E2E route interception に限定し、本番 component の fallback には入れていない。

API route permission と static access-control policy は維持し、alias tenant は request 値でなく verified actor から確定する。RAG の認可境界、benchmark expected wording、QA sample/dataset 固有分岐は追加していない。

### 検証記録

- `apps/web: npm run typecheck`: 成功。
- `apps/web: npm test -- --run`: 52 files / 384 tests 成功。
- `apps/web: npm run test:e2e:smoke`: 15 tests 成功。sandbox の tsx IPC socket が `EPERM` になったため、ユーザー承認後に sandbox 外で実行した。
- `npm run test:web-semantic-ui`: 成功。
- `npm run docs:web-trace:test`: 成功。
- `packages/contract: npm test`: 成功。
- `apps/api: npm run typecheck`: 成功。
- `apps/api: npm test`: 779 tests 成功。必須 alias publish command body と task lifecycle に依存しない requirements trace reference へ修復後、全量を再実行した。
- `npm run lint -- --no-cache`: 成功。
- `npx playwright test --list`: 27 tests を列挙できることを確認。

### 未対応・制約・リスク

- 実 screen reader、browser-native 400% zoom、実端末/AT matrix は環境と owner 決定がなく未実施。automated narrow viewport/axe を manual pass と扱わず、`tasks/todo/20260714-issue-345-manual-a11y-evidence.md` の release evidence として残す。
- alias publish は record/ledger CAS と tenant artifact 分離を持つが、複数 object の完全な atomic commit は未解決。`tasks/todo/20260714-1011-admin-access-audit-state.md` と同じ P0 governance follow-up で扱う。
- managed-user audit の共通 immutable audit/outbox、retention/export privacy は `tasks/todo/20260714-1011-admin-access-audit-state.md`、usage/cost evidence integrity は `tasks/todo/20260714-1011-admin-usage-cost-integrity.md` を閉じていない。
- pricing、budget/anomaly threshold、正式な全 role 日本語用語、browser/AT matrix は owner 未決のため固定値を導入していない。
