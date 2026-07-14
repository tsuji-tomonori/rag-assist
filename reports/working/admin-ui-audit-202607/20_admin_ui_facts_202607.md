# 管理画面仕様復元 確定事実（2026-07）

## 記録規則

事実は現行 main を基準とする。PR #339 の事実は `candidate` と明記し、現行機能と混同しない。行番号は基準 commit のもの。

## A. 画面・状態・情報設計

| Fact ID | 事実 | Evidence | Confidence |
| --- | --- | --- | --- |
| `FACT-AUI-001` | 管理画面は overview/users/roles/usage-cost/audit/alias の 6 section である | `AdminWorkspace.tsx:14,113-123` | confirmed |
| `FACT-AUI-002` | section は component state だけで、URL に section ID を保存しない | `AdminWorkspace.tsx:113-123`; `useAppShellState.ts:649-708` | confirmed |
| `FACT-AUI-003` | section label は英語、本文は日本語と英語/raw code の混在である | `AdminWorkspace.tsx:114-120`;各 panel | confirmed |
| `FACT-AUI-004` | 初期 loader の各失敗は `console.warn` だけで UI error state に保存されない | `useAppShellState.ts:315-343` | confirmed |
| `FACT-AUI-005` | overview の文書/問い合わせ/debug/benchmark は loader の配列長を常に number として渡す | `useAppShellState.ts:544-554` | confirmed |
| `FACT-AUI-006` | そのため loader 失敗後の初期空配列が 0 件として表示され得る | `FACT-AUI-004` + `FACT-AUI-005` | inferred |
| `FACT-AUI-007` | user panel だけが更新 control を持ち、他 panel は scoped retry/refresh/as-of を持たない | `AdminUserPanel.tsx:37-43`; 他 panel | confirmed |
| `FACT-AUI-008` | user 更新は `refreshAdminData()` 内の alias refresh と別 alias refresh を同時に呼ぶ | `useAdminData.ts:71-79`; `useAppShellState.ts:588-596` | confirmed |
| `FACT-AUI-009` | overview の admin 内 KPI は read-only で、対応する users/roles/usage/cost/alias section へ遷移しない | `AdminOverviewGrid.tsx:121-180,196-201` | confirmed |
| `FACT-AUI-010` | API に quality action card があるが Web admin は取得・表示しない | `admin-routes.ts:377-398`; Web `rg quality-actions` 該当なし | confirmed |

## B. 利用量・料金

| Fact ID | 事実 | Evidence | Confidence |
| --- | --- | --- | --- |
| `FACT-AUI-011` | `AdminLedger.usage` は user ごとの summary partial である | `memorag-service.ts:80-84` | confirmed |
| `FACT-AUI-012` | usage counter は ledger load/sync 時に 0 で初期化される | `memorag-service.ts:1547-1554,1587-1593` | confirmed |
| `FACT-AUI-013` | current service には実行時 counter を加算する write path がない | `rg "db.usage[" memorag-service.ts` は read/初期化/migration のみ | confirmed |
| `FACT-AUI-014` | usage UI/test が利用後の event-to-summary integration を検証せず、service test は chat 0 を期待する | `memorag-service.test.ts:2339-2340` | confirmed |
| `FACT-AUI-015` | documentCount は user の実利用/所有ではなく、特定 role なら全 document 数である | `memorag-service.ts:939` | confirmed |
| `FACT-AUI-016` | 全 user の lastActivityAt に全 debug run の completedAt を混ぜる | `memorag-service.ts:927-931` | confirmed |
| `FACT-AUI-017` | SYSTEM_ADMIN の debugRunCount は全 debug run 数であり、debug list 自体は直近 50 件で切られる | `memorag-service.ts:941,1034-1042` | confirmed |
| `FACT-AUI-018` | benchmark count は stored count と実 run 数を加算するため、将来同じ run を両方に記録すると二重計上する | `memorag-service.ts:926,940` | inferred |
| `FACT-AUI-019` | cost は chat `$0.0008/message`、vector `$0.00005/vector`、benchmark `$0.0012/case`、debug `$0.0001/trace` をコード固定する | `memorag-service.ts:955-960` | confirmed |
| `FACT-AUI-020` | user benchmark cost は `$0.012/run` で、総計の `$0.0012/case` と測定単位・単価が異なる | `memorag-service.ts:954,958,961-965` | confirmed |
| `FACT-AUI-021` | response period は当月開始から現在だが、documents/benchmark/debug は period filter なしの全期間入力である | `memorag-service.ts:948-975` | confirmed |
| `FACT-AUI-022` | pricing 更新日は `2026-05-02` の固定値で、出典、region、model、effective range を持たない | `memorag-service.ts:131-135,975` | confirmed |
| `FACT-AUI-023` | benchmark case countを `actual_usage` と表示するが、provider の請求 usage を取得していない | `memorag-service.ts:958` | confirmed |
| `FACT-AUI-024` | cost UI は API にある user 別 cost と unitCostUsd を表示しない | `types.ts:50-73`; `AdminCostPanel.tsx:21-38` | confirmed |
| `FACT-AUI-025` | usage type に conversationCount があるが UI 列にない | `types.ts:37-48`; `AdminUsagePanel.tsx:13-38` | confirmed |
| `FACT-AUI-026` | 通貨表示は小数 4 桁へ丸めるため、絶対値 0.00005 未満は `$0.0000` になり得る | `format.ts:24-26` | confirmed |
| `FACT-AUI-027` | main UI は group/model/feature/date filter、前月比、異常、高 cost run/user、pagination を持たない | `AdminUsagePanel.tsx`; `AdminCostPanel.tsx`; chapter §13 | confirmed/conflict |
| `FACT-AUI-028` | cost/audit export API は存在するが、main UI は control を出さず「export 未提供」と記載する | `admin-routes.ts:91-118,432-459`; `AdminCostPanel.tsx:12`; `AdminAuditPanel.tsx:12` | confirmed/conflict |
| `FACT-AUI-029` | cost/audit export は read permission を再利用し、章仕様の専用 `cost:export` / `audit:export` を実装しない | `admin-routes.ts:94-110,435-452`; chapter `8121-8134,8318-8323` | confirmed/conflict |
| `FACT-AUI-030` | `usage:read:own` / `cost:read:own` は catalog にあるが route/UI consumer がない | `authorization.ts:95-98,165`; admin routes/permissions | confirmed |

## C. ロール・ユーザー・identity lifecycle

| Fact ID | 事実 | Evidence | Confidence |
| --- | --- | --- | --- |
| `FACT-AUI-031` | API schema と managed user は複数 `groups: string[]` を扱う | `schemas.ts:489-507,539-541`; `types.ts:5-14` | confirmed |
| `FACT-AUI-032` | role editor は単一 select で `nextGroups = [selectedRole]` を送る | `AdminUserPanel.tsx:168-175,196-207,265-267` | confirmed |
| `FACT-AUI-033` | Web test は `SYSTEM_ADMIN` 一つだけの配列への置換を期待する | `AdminWorkspace.test.tsx:295-317` | confirmed |
| `FACT-AUI-034` | create user form も初期 role を一つだけ選ぶ | `AdminUserPanel.tsx:79-143` | confirmed |
| `FACT-AUI-035` | role panel は raw role ID、permission 数、comma-separated permission code だけを表示する | `AdminRolePanel.tsx:17-23` | confirmed |
| `FACT-AUI-036` | role API schema は displayName、description、systemRole、risk、assigned user count を持たない | `schemas.ts:530-537` | confirmed |
| `FACT-AUI-037` | backend role は 12 種、infra Cognito group は 9 種である | `authorization.ts:109-121`; `memorag-mvp-stack.ts:29-39`; `FR-079:70` | confirmed/conflict |
| `FACT-AUI-038` | `access:role:create/update` は permission catalog にあるが role create/update route/UI はない | `authorization.ts:104-107,187`; `admin-routes.ts`; role panel note | confirmed/conflict |
| `FACT-AUI-039` | unknown role はエラーにせず除去し、空なら `CHAT_USER` に置換する | `memorag-service.ts:873-877,889-897,2749-2751` | confirmed |
| `FACT-AUI-040` | route guard は self role assignment と非 SYSTEM_ADMIN による SYSTEM_ADMIN 付与だけを拒否する | `admin-routes.ts:138-149` | confirmed |
| `FACT-AUI-041` | UI は self target を disable せず、非 SYSTEM_ADMIN actor に SYSTEM_ADMIN option を見せ得る | `AdminUserPanel.tsx:147-207` | confirmed |
| `FACT-AUI-042` | role mutation に reason、target active/same tenant、last-admin、version conflict guard がない | `AssignUserRolesRequestSchema`; `admin-routes.ts:138-149`; `FR-080` | confirmed/conflict |
| `FACT-AUI-043` | role write は Cognito group 更新後に ledger/audit を保存し、後段失敗時の rollback/reconciliation がない | `memorag-service.ts:889-901` | confirmed |
| `FACT-AUI-044` | create user は Cognito user を作らず ledger record だけを作る | `memorag-service.ts:860-881`; `UserDirectory` は create method なし | confirmed |
| `FACT-AUI-045` | suspend/restore/delete は ledger status だけを変え、Cognito disable/delete/session revoke を呼ばない | `memorag-service.ts:1498-1509`; `user-directory.ts:15-18` | confirmed |
| `FACT-AUI-046` | auth は JWT の `custom:account_status` だけを active/suspended/deleted として読む | `auth.ts:41-64` | confirmed |
| `FACT-AUI-047` | ledger status を JWT accountStatus へ照合する middleware はない | `auth.ts`; `app.ts`; `authorization.ts:266-280` | confirmed |
| `FACT-AUI-048` | deleted actor が admin ledger を load すると ledger status を active に戻す | `memorag-service.ts:1524-1535` | confirmed |
| `FACT-AUI-049` | UI の停止確認は「アプリを利用できなくなる」と断定する | `AdminUserPanel.tsx:236-249` | confirmed/conflict |
| `FACT-AUI-050` | Cognito directory sync は既存 user の groups/status を authoritative 値で更新せず、外部変更が UI に反映されない場合がある | `memorag-service.ts:1563-1580` | confirmed |
| `FACT-AUI-051` | user list は検索、状態/role/group filter、詳細、実効権限、可視 folder、監査 drill-down、pagination を持たない | `AdminUserPanel.tsx`; chapter §11 | confirmed/conflict |
| `FACT-AUI-052` | identity/resource group 管理 section はなく、`groups` という語を application role set にも使用する | AdminWorkspace sections; schema/API naming; `FR-079` | confirmed/conflict |
| `FACT-AUI-053` | 全 mutation が一つの global loading boolean を使い、全行の control と spinner に伝播する | `useAdminData.ts:91-217`; `AdminUserPanel.tsx:59-70,199-231` | confirmed |

## D. 監査・alias・整合性

| Fact ID | 事実 | Evidence | Confidence |
| --- | --- | --- | --- |
| `FACT-AUI-054` | admin audit schema は managed user/role の success action 5 種に限定される | `schemas.ts:510-527`; `types.ts:16-30` | confirmed |
| `FACT-AUI-055` | audit に tenant、target type、reason、result、requestId、policy version がない | 同上; `FR-086:20-39` | confirmed/conflict |
| `FACT-AUI-056` | audit list は直近 100 件、alias audit は 200 件、UI は alias audit の先頭 8 件だけを無表示で切る | `memorag-service.ts:884-887,848-850`; `AliasAdminPanel.tsx:163-174` | confirmed |
| `FACT-AUI-057` | audit export payload も 100 件に切られた list を使う | `memorag-service.ts:998-1009`; `listAdminAuditLog` | confirmed |
| `FACT-AUI-058` | admin/alias ledger は単一 JSON object の read-modify-write で version/conditional write がない | `memorag-service.ts:1512-1599,1601-1615` | confirmed |
| `FACT-AUI-059` | alias 差戻理由は UI 固定文字列 `Rejected from UI` である | `AliasAdminPanel.tsx:117`; Web test `265` | confirmed |
| `FACT-AUI-060` | 「下書き化」は expansions を変更せず update を呼び、server は review/published metadata を削除する | `AliasAdminPanel.tsx:109-112`; `memorag-service.ts:778-793` | confirmed |
| `FACT-AUI-061` | alias review fallback は server ID が違う場合に client 時刻と状態を生成する | `useAdminData.ts:166-183` | confirmed |
| `FACT-AUI-062` | alias backend は disabled alias の review state transition を API で拒否しない | `memorag-service.ts:796-808` | confirmed |

## E. Contract、responsive、a11y、tests

| Fact ID | 事実 | Evidence | Confidence |
| --- | --- | --- | --- |
| `FACT-AUI-063` | Web API wrapper は多くの list で top-level array だけを確認し、nested field を runtime validate しない | `features/admin/api/*.ts` | confirmed |
| `FACT-AUI-064` | cost wrapper の invalid response、未提供、permission/error 後の null は UI 上同じ「未提供」になる | `costApi.ts:4-18`; loader behavior | confirmed |
| `FACT-AUI-065` | global error は raw response text を表示し、`role=alert` を持たない | `http.ts:17-58`; `AppShell.tsx:18-22` | confirmed |
| `FACT-AUI-066` | admin panel に `aria-busy` がなく、global/admin の loading status が同時に出得る | `AppShell.tsx:18-22`; `AdminWorkspace.tsx:136` | confirmed |
| `FACT-AUI-067` | user/usage row は `min-width: 920px` で horizontal scroll に依存する | `admin.css:302-329` | confirmed |
| `FACT-AUI-068` | alias form の 4-column grid は 1080/720 media query で 1-column 化されない | `admin.css:181-217`; `responsive.css:158-167,385-410` | confirmed |
| `FACT-AUI-069` |主要 control の min-height は 32–38 px が多く、repository UI policy の primary 44–48 px 推奨を満たさない | `admin.css:22-30,140-148,197-217,289-300,390-400` | confirmed |
| `FACT-AUI-070` | data table は custom `role=table/row/cell` で、EmptyState は row/cell 外に直接置かれる | `AdminUserPanel.tsx:47-74`; `AdminUsagePanel.tsx:13-40` | confirmed |
| `FACT-AUI-071` | risky row action の accessible name は対象 user/alias を含まない同名ボタンである | `AdminUserPanel.tsx:204,219-231`; `AliasAdminPanel.tsx:109-124` | confirmed |
| `FACT-AUI-072` | generated inventory は dynamic section button の accessible name を静的には `unknown` とする | `docs/generated/web-accessibility.md:58` | confirmed evidence gap |
| `FACT-AUI-073` | admin tests は single-role replacement と hardcoded reject reason を期待値として固定する | `AdminWorkspace.test.tsx:295-317,244-266` | confirmed |
| `FACT-AUI-074` | responsive、keyboard、screen reader、contrast、320 px/400% zoom、row-scoped error、live Cognito/provider を検証する admin test はない | Web/API tests と関連 reports | confirmed evidence gap |

## F. 文書・未マージ候補の conflict

| Fact ID | 事実 | Evidence | Confidence |
| --- | --- | --- | --- |
| `FACT-AUI-075` | `FR-027` は ledger delete 状態と概算 cost を受け入れる一方、2026-07 `FR-079/080/086` は authoritative/atomic contract を要求する | 各 requirement | conflict |
| `FACT-AUI-076` | J3 gap 文書は export API がなかった時点の記述を残し、current main と一部 stale である | `gap-phase-j3.md`; current routes | confirmed/conflict |
| `FACT-AUI-077` | PR #339 は usage event/completeness/monthly/export UI を実装するが current main へ未 merge | GitHub Apps PR #339; head `e7654ad4` | confirmed |
| `FACT-AUI-078` | PR #339 の DynamoDB store は Scan 後 1,000 件で切り、service はその結果だけを period filter する | candidate `dynamodb-usage-event-store.ts:29-42`; service `922-1038` | confirmed candidate gap |
| `FACT-AUI-079` | PR #339 の event は tenantId を `default` 固定する経路があり、store list は tenant/period query を持たない | candidate service `1123-1159`; store interface | confirmed candidate gap |
| `FACT-AUI-080` | PR #339 の default pricing は wildcard Bedrock/mock 固定価格で、AWS source/region/model-specific provenance を持たない | candidate pricing catalog `21-75` | confirmed candidate gap |
| `FACT-AUI-081` | PR #339 reports は live Bedrock/DynamoDB persistence と live S3 signed export を未検証と明記する | `reports/working/20260601-1043-usage-cost-full-verification.md` 等（candidate branch） | confirmed candidate constraint |

## 未確定事実として扱わないもの

- 実際の AWS 請求額、pricing effective date、cost anomaly threshold。
- production tenant 数、usage event 件数、user 数、必要な pagination size/SLO。
- custom role editor を提供するか、system preset read-only に統一するか。
- 強権限変更の二者承認、保持期間、SIEM 連携。

これらは [29_admin_ui_open_questions_202607.md](29_admin_ui_open_questions_202607.md) へ分離した。
