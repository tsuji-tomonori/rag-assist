# 管理画面 仕様候補（2026-07）

## 文書メタ情報

- 文書種別: design/specification candidate
- Status: proposed / non-normative
- Requirements: `REQ-AUI-001`–`REQ-AUI-013`
- 原則: tenant/actor は認証済み server context から確定し、client 値や固定 `default` を認可境界に使わない

本書は改善方針を実装可能な contract へ落とす候補である。field名・endpoint名・storage実装は設計レビューで変更できるが、対応ACの観察可能な結果を弱めてはならない。

## 仕様候補一覧

| Specification | 主題 | Requirement | Task |
| --- | --- | --- | --- |
| `SPEC-AUI-001` | Usage event / aggregation | `REQ-AUI-001` | `TASK-AUI-001` |
| `SPEC-AUI-002` | Pricing / cost calculation | `REQ-AUI-002` | `TASK-AUI-002` |
| `SPEC-AUI-003` | Usage-cost query UI / export | `REQ-AUI-003` | `TASK-AUI-003` |
| `SPEC-AUI-004` | Canonical role catalog | `REQ-AUI-004` | `TASK-AUI-004` |
| `SPEC-AUI-005` | Role delta command | `REQ-AUI-005` | `TASK-AUI-005` |
| `SPEC-AUI-006` | Account lifecycle state machine | `REQ-AUI-006` | `TASK-AUI-006` |
| `SPEC-AUI-007` | User/resource-group query | `REQ-AUI-007` | `TASK-AUI-007` |
| `SPEC-AUI-008` | Common admin audit | `REQ-AUI-008` | `TASK-AUI-008` |
| `SPEC-AUI-009` | Query/mutation state and errors | `REQ-AUI-009` | `TASK-AUI-009` |
| `SPEC-AUI-010` | Admin routing/action projection | `REQ-AUI-010` | `TASK-AUI-010` |
| `SPEC-AUI-011` | Alias transition command | `REQ-AUI-011` | `TASK-AUI-011` |
| `SPEC-AUI-012` | Responsive/a11y/localization gate | `REQ-AUI-012` | `TASK-AUI-012` |
| `SPEC-AUI-013` | Migration/rollout | `REQ-AUI-013` | `TASK-AUI-013` |

## SPEC-AUI-001: Usage event と集計

### Record contract

`UsageEvent` は少なくとも次を持つ。値が得られない field を 0 や架空値で補わない。

| Field | 意味 / 制約 |
| --- | --- |
| `eventId`, `idempotencyKey`, `schemaVersion` |一意性、再送排除、migration識別 |
| `tenantId`, `subjectUserId`, `actorUserId?` | server auth/run context から確定。cross-tenant keyを拒否 |
| `runId`, `operationId`, `feature` | chat/RAG/embedding/debug/benchmark等の実行へtrace |
| `provider`, `region`, `model` | provider meteringとpricing lookup key |
| `metric`, `unit`, `quantity` | token/vector/message/case/run等。decimal、非負、unit明示 |
| `measurementSource` | `provider_actual` / `system_measured` / `estimated` / `missing` 等の承認enum |
| `occurredAt`, `ingestedAt` | UTC instant。periodは`[from,to)` |
| `completenessReason?` |欠測・遅延・unsupportedの理由code。secretを含めない |

### Write/query rules

- provider adapter の確定地点でeventをwriteし、run成功とusage writeの関係を明示する。失敗を黙って捨てずreconciliation対象にする。
- idempotency uniqueness はatomicに強制し、replay/backfillは同じevent identityを再利用する。
- list/aggregateはserver-resolved `tenantId`、`from`、`to`、cursor、許可されたdimensionを受ける。全件Scan後のclient-side sliceを集計契約にしない。
- summaryは `data`, `completeness`, `watermark`, `asOf`, `query`, `nextCursor` を返す。complete zero、missing、delayedを別enumにする。
- own-scope queryはserver-resolved subjectに固定し、clientが他userIdへ差し替えられないようにする。

### Validation

`AC-AUI-001`–`012`; `E2E-AUI-001`, `002`, `016`, `017`。

## SPEC-AUI-002: Pricing catalog と cost calculation

### Catalog contract

| Field | 意味 / 制約 |
| --- | --- |
| `priceId`, `version` |変更追跡可能なidentifier |
| `provider`, `region`, `model`, `metric`, `unit` | UsageEventと一致するlookup key。wildcard可否は明示承認 |
| `currency`, `unitPrice` | decimal。client入力を使わない |
| `effectiveFrom`, `effectiveTo?` | UTCの半開区間。overlapはvalidation error |
| `source`, `sourceRetrievedAt` |公式価格表、契約表等のprovenance |
| `status` | draft/approved/retired等。production計算はapprovedのみ |

### Calculation rules

- usage itemごとにoccurredAt時点の一致priceを選び、`quantity × unitPrice = subtotal` のbreakdownを保持する。
- unmatched、unit mismatch、currency mismatch、missing quantityは0としてtotalへ混ぜず、`unpriced` / `incomplete` itemにする。
- actual/estimatedはpriceではなくquantity measurement sourceと計算methodから決める。AWS請求明細と照合していない推定をactual billと表示しない。
- totalを返す場合はcoverage/completenessを伴い、precision/roundingはserverで一度だけ承認ruleを適用する。
- benchmarkはcase/run/token等のprice unitとquantity unitを一致させる。

### Validation

`AC-AUI-013`–`024`; `E2E-AUI-001`–`003`。

## SPEC-AUI-003: Usage-cost query UI と export

### Read model

- Query: `from`, `to`, `userIds?`, `resourceGroupIds?`, `features?`, `providers?`, `models?`, `measurementSources?`, `sort`, `pageSize`, `cursor`。
- Response: normalized query、period/as-of/watermark、completeness、summary、rows、comparison、anomalies、nextCursor。
- Row: subject/feature/model、全主要quantity、unit、unit price、subtotal、source、priceVersion、completeness。permissionによりfieldをomitする場合はschemaで表現する。
- Money displayは0を`$0.00`等で表示できるが、正の微小値を0へ丸めない。unpriced/incompleteは金額文字列にしない。

### UI behavior

- URL queryをsource of truthにし、filter/sort/page/comparisonをdeep link可能にする。
- loading/success-empty/success-data/error/forbidden/staleを `SPEC-AUI-009` で描画する。
- exportは同じnormalized query objectを使用し、readとは別permissionをrouteで検証する。
- anomaly cardはthreshold/rule version/as-ofとbreakdown linkを持つ。未決thresholdをUI固定値にしない。

### Validation

`AC-AUI-025`–`040`; `E2E-AUI-002`, `003`。

## SPEC-AUI-004: Canonical role catalog

### Catalog item

`roleId`, localized `displayName/description`, `category`, `riskLevel`, `permissions[]`, `systemRole`, `mutable`, `provisioningMapping`, `version` を一つのserver-owned catalogで管理する。assigned countはcatalog定義ではなくscope-aware query projectionとして返す。

### Rules

- authorization、role API、infra provisioning/drift check、Web displayは同じcatalog artifact/versionを参照する。
- unknown roleはdrop/default化せずvalidation/inconsistencyとして扱う。legacy unknown roleを読む場合も明示badgeとreconciliationを返す。
- application roleはresource/identity groupとschema、route、labelを分ける。Cognito groupをapplication role実装へ使う場合も概念mappingを明記する。
- create/update routeを提供しないsystem presetはread-onlyとし、permission catalogだけに実行不能permissionを残すかを設計レビューする。

### Validation

`AC-AUI-041`–`052`; `E2E-AUI-004`。

## SPEC-AUI-005: Role delta command

### Command candidate

```text
targetUserId, expectedVersion, grants[], revokes[], reason, idempotencyKey
```

Responseは `beforeRoles`, `afterRoles`, `appliedGrants`, `appliedRevokes`, `version`, `effectiveAt`, `reconciliationStatus`, `auditEventId` をserver確定値として返す。

### Guard order

1. actor認証、route-level permission、tenantをserver contextから確定する。
2. target存在、same-tenant、active state、self-mutation、canonical rolesを検証する。
3. strong-role policy、last-admin invariant、expectedVersionを検証する。
4. directory/authorization sourceへ変更し、ledger projectionとauditを整合させる。単一transaction不能なら補償・outbox・reconciliationを明示する。
5. success/denied/conflict/failedの結果を共通auditへ残す。

UIはcheckbox/tokens等のmulti-role editorでdeltaを作り、save前にbefore/after/reasonをreviewする。UI disableだけを認可にしない。

### Validation

`AC-AUI-053`–`068`; `E2E-AUI-005`, `006`。

## SPEC-AUI-006: Account lifecycle state machine

### Candidate states

`provisioning`, `active`, `suspending`, `suspended`, `restoring`, `deleting`, `deleted`, `reconciliation_required`。公開enumは設計で確定するが、途中状態をactive/successへ畳み込まない。

### Rules

- authoritative identity operation、session/token enforcement、管理projection、auditの順序とcompensationをcommandごとに定義する。
- createはidentity作成なしにactive管理userを返さない。suspendはsign-in disableと既存accessの失効上限を強制する。restoreは新認証後にのみaccessを戻す。
- deleteはsoft/hard、PII retention、audit/legal hold方針に従う。管理ledger loadがdeletedをactiveへ上書きしてはならない。
- last-admin、自分自身、cross-tenant、stale versionをserverでguardする。
- reconciliation jobはidentity state/source/as-ofとprojection差分を列挙し、修復結果をauditする。

### Validation

`AC-AUI-069`–`081`; `E2E-AUI-007`, `008`。Cognitoを使うproduction pathはsandboxまたはlive identity integrationをrelease gateにする。

## SPEC-AUI-007: User / resource-group query

### Query/detail

- List queryはserver-side `search`, `statuses`, `applicationRoleIds`, `resourceGroupIds`, `source`, `sort`, `pageSize`, `cursor` を受け、normalized queryを返す。
- Detailはidentity status/source/as-of、application roles、resource groups、effective permissions、visible resource summary、recent audit link、versionをscope-awareに返す。
- resource group mutationはrole mutationと別route/permission/fieldを持ち、owner/manager policyをserverで検証する。
- directory syncがstale/failedならlast-known valueをcurrentと断定せず、source/as-of/sync statusを返す。

### UI

- filter/search/pageをURLへ保存し、detailから戻っても条件を保つ。
- mutation state/error/retryはrowまたはdetail単位にする。全行を一つのglobal booleanでdisableしない。
- create formはidentity作成契約、初期role set、招待/temporary credentialの実効果を説明する。APIにない値を架空表示しない。

### Validation

`AC-AUI-082`–`093`; `E2E-AUI-009`。

## SPEC-AUI-008: Common admin audit

### Event contract

| Field group | Candidate fields |
| --- | --- |
| Identity | `eventId`, `schemaVersion`, `occurredAt`, `recordedAt` |
| Context | `tenantId`, `actorUserId`, `actorRoleSnapshot`, `requestId`, `policyVersion` |
| Operation | `action`, `targetType`, `targetId`, `reason`, `result` |
| Change | allowlist/redacted `before`, `after`, `changedFields` |
| Failure | stable `errorCode`, `conflictVersion?`; stack/secret/raw responseは除外 |
| Integrity | sequence/hash/signature等、採用方式に応じた改変検知metadata |

### Rules

- mutation resultは `success`, `denied`, `conflict`, `failed` を最低集合とする。route denyをservice成功auditだけに依存させない。
- state changeと必須success auditはtransaction/outbox等で片側成功を防ぐ。失敗auditの永続化不能はobservability alertを発生させる。
- list/exportはtenant、period、actor、target、action、result、cursorを支持し、100件固定sliceを全履歴契約にしない。
- `audit:read` と `audit:export` 相当を分離する。retention/legal hold/SIEM/PII redactionは承認policyを参照する。

### Validation

`AC-AUI-094`–`105`; `E2E-AUI-010`。

## SPEC-AUI-009: Query/mutation state と error/concurrency

### Client state

```text
idle | loading(previousData?) | success-empty(meta) | success-data(data, meta)
| error(code, requestId, retryable, previousData?) | forbidden | stale(data, meta)
```

各panelが独立stateを持つ。`null`, `[]`, `0`だけで unavailable/error/loading を表さない。runtime schema decodeに失敗したresponseはcontract errorとする。

### API/mutation contract

- error envelopeは安定code、利用者向けsafe message、requestId、retryable、field errors、currentVersion?を持ち、raw upstream body/stackを返さない。
- read responseはsource/as-of/versionまたはETagを持つ。mutationはexpected versionとidempotency keyを使う。
- conflict responseはcurrent versionと再読込導線を返し、client mergeを推測で行わない。
- retry/refreshはpanel/row scopeで、他scopeの成功dataを初期化しない。

### Validation

`AC-AUI-106`–`116`; `E2E-AUI-002`, `006`, `008`, `011`。

## SPEC-AUI-010: Admin routing と action projection

- sectionは `/admin/{section}` 相当のroute、filter/sortはquery parameterで表す。未知・権限外sectionはsafe not-found/forbiddenへ送る。
- overview projectionは各cardに `status`, `value?`, `source`, `asOf`, `thresholdRef?`, `targetRoute?`, `targetQuery?`, `permission` を持たせる。
- source queryのerror/loading/unknownを0へ変換しない。action cardはactorがtarget detailを読める場合だけ返し、scope外件数も漏らさない。
- quality-action APIを使う場合は対象permission、reason、expiration、deduplicationを契約化する。
- back/forward/reload/shareでsection/queryを復元し、permission変化後のstale URLを安全に処理する。

### Validation

`AC-AUI-117`–`125`; `E2E-AUI-011`, `012`。

## SPEC-AUI-011: Alias transition command

- mutationを `create/update-content/request-review/publish/reject/return-to-draft/disable` 等の明示commandへ分け、各from/to state表をserverに置く。
- commandは `aliasId`, `expectedVersion`, `reason`, `idempotencyKey`, command固有payloadを持つ。reject/return/disable等のgovernance操作は承認済みpolicyに従ってreasonを必須にする。
- responseはserver確定 `state`, `version`, `updatedAt`, `reviewedAt?`, `publishedAt?`, `auditEventId` を返す。client時刻や想定stateで補完しない。
- disabled/old-version/permission不足 transitionをserverで拒否し、resultを共通auditに記録する。
- list/auditはsearch/filter/cursorを持ち、UIだけで8件へ切らない。

### Validation

`AC-AUI-126`–`134`; `E2E-AUI-013`。

## SPEC-AUI-012: Responsive/a11y/localization quality gate

### Layout/interaction

- 320 CSS pxと400% zoomでcontentとcontrolをreflowする。多数列はpriority-based card/detail、column selection、single-axis region等へ再構成し、page全体の二方向scrollを避ける。
- primary/row controlsは原則44px以上。小さいtargetはWCAG 2.2 Target Size (Minimum)のspacing/exceptionをtestで証明する。
- native semantic elementを優先し、custom table/listはheader/cell/row/empty関係をaccessibility treeで検証する。
- row actionのaccessible nameはactionとtargetを含む。dialog focus、focus visible、error association、`aria-busy`、status/alertの重複抑制を共通componentで扱う。
- section、role/group、state、errorを承認済み日本語用語へ統一し、raw codeは補助表示にする。

### Gate

- component/contract testsに加え、320px、400% zoom、keyboard、contrast、承認browser/screen reader、touchをrelease matrixへ含める。
- test fixture/Storybook mockはproduction fallbackと分離する。

### Validation

`AC-AUI-135`–`146`; `E2E-AUI-014`, `015`。

## SPEC-AUI-013: Migration / rollout

1. PR #339相当candidateをcurrent mainへrebaseする前に、変更単位をevent contract、store/index、aggregation、pricing、UI/exportへ分割して再評価する。
2. storeはtenant+occurredAt/periodをkey/query条件にし、1,000件Scan sliceを廃止する。migration/backfillはidempotent checkpointとtenant境界を持つ。
3. legacy/new summaryを同じtenant/period/dimensionでdual-readし、quantity、cost、completeness、unpriced、event countの差分を記録する。
4.許容差、comparison期間、owner、stop/rollback条件をrunbookに決め、超過時に自動cutoverしない。
5.非production live AWSでBedrock usage→DynamoDB persistence→aggregation/pricing→S3 signed exportをcanaryし、tenant/redaction/secret boundaryを確認する。
6. rollback/kill switchはsource eventを削除せずread pathを戻す。reconciliationとmonitoringが安定するまでlegacy pathを停止しない。
7. cloud billingとの照合差はactual一致を保証せず、対象外charge、timing、discount、tax等のscopeと推定差をFinOps記録へ残す。

### Validation

`AC-AUI-147`–`158`; `E2E-AUI-016`, `017`。

## 非目標

- 本仕様候補は pricing 値、異常閾値、page size、SLO、session失効時間、保持期間、二者承認要否を確定しない。
- 管理画面へ架空のuser/group/cost/dateを表示するfallbackを認めない。
- UI controlの非表示だけでserver認可を充足した扱いにしない。
- usage/costをAWS請求書そのものと表現しない。照合範囲と推定性を別途明記する。
