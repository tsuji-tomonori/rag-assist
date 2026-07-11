# 権限・文書共有 decision matrix 2026-07

## 1. 規範レベル

- `confirmed`: 参照したコード、ADR、PDF の事実。
- `inferred`: 安全な target requirement。ステークホルダー承認前。
- `conflict`: 現行 source 間で相反する。
- `open_question`: 値・業務規則を決定する必要がある。

本書の target rule は `FR-056`–`FR-067`, `FR-076`–`FR-081`, `FR-085`–`FR-087`, `FR-090`, `FR-091` を要約する。個別要求文と AC が優先する。

## 2. 認可 decision の順序

| Step | 強制条件 | 不許可・欠損時 | Requirement |
| ---: | --- | --- | --- |
| 1 | edge/app で token、issuer、audience、expiry、subject を検証 | 401、資源 lookup 前に停止 | FR-056 |
| 2 | authoritative account state が active | 401/403、session と queued work を失効 | FR-057, FR-058 |
| 3 | actor tenant を server-side で決定 | default/client fallback せず拒否 | FR-056, FR-060 |
| 4 | resource type × operation の feature permission | 未定義組合せも含め 403、resource detail を返さない | FR-057, FR-076 |
| 5 | target resource tenant と actor tenant が一致 | existence を隠して拒否 | FR-057, FR-060 |
| 6 | current resource policy から effective permission を算出 | 非管理主体の unknown/read failure は `none`。mandatory deny のない管理主体は FR-077 | FR-059, FR-061, FR-063, FR-077 |
| 7 | operation が要求する permission level を満たす | state mutation 前に拒否 | FR-057 |
| 8 | lifecycle/expiry/quality/security gate | inactive/unknown は deny/quarantine | FR-066–FR-070 |
| 9 | response allowlist と security mutation audit | unauthorized field/body/count を除外し、state と audit event を不可分に追跡 | FR-064, FR-086, FR-088, FR-091 |
| 10 | queued/long-running 処理の current authorization | submit snapshot を使わず中断・reconcile | FR-090 |

deny を relevance score や別の allow で相殺しない。LLM、質問文、client metadata は decision source にしない。

## 3. Principal と role の分離

| 概念 | 例 | 用途 | Target rule | Current concern |
| --- | --- | --- | --- | --- |
| application role | `CHAT_USER`, `RAG_GROUP_MANAGER` | feature permission | identity source が付与し、resource group ID と namespace を分ける | Cognito group 配列を role と resource group の両方に利用 |
| tenant | tenant ID | storage/search boundary | verified claim/directory/server config から導出 | `AppUser` に tenant なし、`default` fallback |
| user principal | immutable subject ID | owner/direct grant | email でなく subject を正規 ID とし、active/same-tenant を検証 | userId/email の両方を principal として比較 |
| administrative principal | owner/adminPrincipal subject ID | resource の管理責任 | mandatory deny のない active resource で active/same-tenant の主体に `full`。通常 policy/deny では剥奪せず、削除前に後継へ移管 | owner bypass と ADR adminPrincipal の範囲が path ごとに異なる |
| resource group | UserGroup ID | nested membership/share | app role と別 namespace、cycle/archived を fail closed | `user.cognitoGroups.includes(groupId)` で full |
| folder policy | policy ID/version | inherited resource permission | authorization service の唯一の source of truth | legacy ACL fields と併存 |
| break-glass grant | approval ID | emergency access | normal role と別、reason/expiry/audit/review 必須 | SYSTEM_ADMIN の恒常 bypass |

## 4. Folder effective permission

### 4.1 Target composition

| Condition | Effective result | Confidence |
| --- | --- | --- |
| identity 不成立 / account inactive / tenant mismatch / folder lifecycle 非 active / resource integrity 不成立 | mandatory `none`（管理主体にも優先） | inferred |
| mandatory deny のない active same-tenant administrative principal | ordinary policy の欠損・読取不能・deny に依存せず `full` | inferred (`FR-077`) |
| ordinary policy unreadable / unknown（非管理主体） | `none` | inferred |
| child has explicit policy | child policy is complete replacement of parent | inferred |
| child has no explicit policy | nearest ancestor explicit policy is inherited | inferred |
| group-managed folder | `min(policy entry, membership level)` | inferred |
| multiple valid allow paths | versioned rule; current proposal is max after hard denies | open_question |
| ordinary explicit deny（非管理主体） | direct/folder allow より優先 | inferred（規則詳細は `OQ-RD-002`） |
| membership cycle / unknown principal | `none` | inferred |
| policy would leave zero administrative principals | reject mutation | inferred |

### 4.2 Folder operations

| Operation | Feature permission | Resource permission | Other guards | Response/audit |
| --- | --- | --- | --- | --- |
| list/read summary | `rag:doc:read` | `readOnly` | active, same tenant | minimal summary; no principal lists (`FR-064`, `FR-076`) |
| create root | create permission | tenant-admin rule | canonical name/tenant | actor/reason/result (`FR-076`, `FR-086`) |
| create child | create permission | parent `full` | same tenant, cycle/name check | actor/reason/result (`FR-076`, `FR-086`) |
| update name/description | update permission | folder `full` | optimistic version | before/after/reason (`FR-076`, `FR-086`) |
| replace share policy | share permission | folder `full` | valid active same-tenant principals; administrative-principal guard | atomic version + audit (`FR-062`, `FR-077`, `FR-085`, `FR-086`) |
| move | move permission | source `full` + destination `full` | cycle/path/tenant/impact preview | coherent state + audit (`FR-076`, `FR-086`, `FR-087`) |
| archive/delete | delete permission | folder `full` | child/document impact; deny-first | tombstone + audit (`FR-066`, `FR-076`, `FR-086`) |
| search/use | search-use permission | folder `readOnly` + 各 document の current read | current lifecycle/policy; bounded authorized result | authorized-only response (`FR-070`, `FR-076`, `FR-091`) |

Folder/resource-group CRUD/share/move/archive の feature permission 名は `FR-079` の role catalog 正規化時に確定する。本書と `FR-076` の operation key は論理セル名であり、現行 `rag:group:create` と `rag:group:assign_manager` または新しい文字列を最終形として先決めしない。

### 4.3 Resource group operations

| Operation | Feature | Resource/tenant guard | Integrity | Requirement |
| --- | --- | --- | --- | --- |
| create | canonical group-create permission | actor tenant 内 | immutable group ID、role namespace と分離 | FR-076, FR-079 |
| read/list | canonical group-read permission | same tenant、存在を非開示 | reader/manager response allowlist | FR-057, FR-060, FR-076 |
| update metadata | canonical group-update permission | group manager | optimistic version | FR-076, FR-086 |
| add/remove member | canonical membership-mutate permission | manager、active same-tenant principal | nested cycle/unknown/archived を拒否 | FR-076, FR-081, FR-086 |
| share target として利用 | resource share permission | active same-tenant group | directory の正規 group ID のみ | FR-062, FR-081 |
| archive/delete | canonical group-delete permission | manager、影響 preview | dangling grant を deny-first で無効化 | FR-066, FR-076, FR-086 |
| move | `explicit deny` | group hierarchy は未導入 | 別セルから許可を推定しない | FR-076 |
| share policy | `explicit deny` | membership は別 operation | document/folder share の principal としてだけ利用 | FR-076, FR-081 |
| search/use | canonical group-use permission | active same-tenant membership + target resource `readOnly` | group 単独で本文 access を付与しない | FR-070, FR-076, FR-081 |

stale/dangling membership edge の削除は、削除後 state にその edge が残らないため、actor permission と target group authority が成立すれば許可する。追加・更新・残存 edge だけに active/same-tenant/principal existence/cycle integrity を要求する（`FR-081`）。

## 5. Document effective permission

| Input | Target interpretation | Status |
| --- | --- | --- |
| identity/account/tenant/lifecycle/resource-integrity mandatory deny | 常に `none`。管理主体にも優先 | inferred |
| mandatory deny のない active same-tenant owner/adminPrincipal | 通常 policy の欠損・読取不能・deny に依存せず `full` | inferred (`FR-077`) |
| direct user/group grant | active same-tenant principal の allow path | current implementation exists |
| folder permission | folder policy の allow path | current implementation exists |
| multiple folder permissions | versioned composition rule | open_question |
| direct `full` | read/share onlyか全管理かを明示 | conflict/open_question |
| ordinary explicit document deny（非管理主体） | allow より優先 | inferred（規則詳細は `OQ-RD-002`） |
| missing ACL/tenant/document manifest | `none` | inferred |

### 5.1 Document operations

| Operation | Feature | Resource | Additional rule | Requirement |
| --- | --- | --- | --- | --- |
| list/read/preview | `rag:doc:read` | document `readOnly` | minimal allowlist response | FR-063, FR-064 |
| register/create | document-create/upload permission | destination folder `full` または承認済み root rule | authoritative tenant/owner/admission | FR-001, FR-057, FR-060, FR-068, FR-076 |
| update metadata | document-update permission | document `full` | security/quality/tenant fields は server 管理 | FR-057, FR-068, FR-076 |
| download | read/download capability | document `readOnly` | current permission recheck at click | FR-057, FR-064 |
| direct share/revoke | `rag:doc:share` | document `full` | principal validation、administrative-principal guard、version、audit | FR-062, FR-063, FR-077, FR-085, FR-086 |
| move | `rag:doc:move` | source container `full` + destination `full` | same tenant, coherent derived metadata | FR-065, FR-086, FR-087 |
| delete/archive | delete permission | source container `full` | deny-first, retention/purge policy | FR-066, FR-076, FR-086 |
| reindex | rebuild permission | source container `full` | staged index uses current ACL/delete | FR-066, FR-072 |
| chat scope select | `rag:doc:read` | document/folder `readOnly` | server capability; no management UI required | FR-064 |
| search/use | exact search-use permission | document `readOnly` または folder `readOnly` + document current permission | evidence 前認可、current lifecycle/quality | FR-069, FR-070, FR-076 |

## 6. Shared resource discovery

| Actor state | documents navigation | summary | chat selection | mutation |
| --- | --- | --- | --- | --- |
| no `rag:doc:read` | hidden/denied | none | none | none |
| read-only direct share | visible read-only entry | title/type/current status/capability allowlist | allowed | denied |
| read-only folder share | visible folder/doc tree | same as above | allowed | denied |
| full + feature permission | visible management mode | management detail by separate endpoint | allowed | capability-specific |
| suspended/deleted | no protected entry | none | none | none |

API は enforcement、Web は discoverability と不要 request 抑制を担う。Web capability が欠損した場合は管理可能と推定しない。

## 7. Share mutation invariants

1. actor は active、same tenant、share feature、target `full` をすべて満たす。
2. principal は immutable ID で directory から選択し、active/same-tenant を検証する。
3. request は expected policy/grant version を持ち、競合時は部分更新せず拒否する（`FR-085`）。
4. administrative principal を失う変更、self-lockout、privilege escalation を拒否する（`FR-077`, `FR-078`）。
5. policy/grant state と security mutation audit event または durable publication intent を同じ確定単位で保存し、audit persistence failure では成功を返さない（`FR-085`, `FR-086`）。
6. revoke は reindex/embedding 再計算を待たず authoritative deny を先に反映する。
7. list response と audit response を分離し、一般 reader に principal/email/ACL を返さない。

## 8. Response minimization

| Endpoint class | Reader response | Manager response | Forbidden by default |
| --- | --- | --- | --- |
| folder list | ID、表示名、path、effective permission、capabilities | policy version と管理用 detail は別 endpoint | shared user/email/group list、内部 tenant key、権限外 item/count |
| document list | ID、title/type/status、safe source locator、capabilities | grant/policy detail は別 endpoint | arbitrary metadata、ACL、owner email、benchmark/domain internals |
| search result | safe locator、snippet、document/version | sanitized diagnostics by permission | raw ACL、hidden folder IDs、policy prompt、unauthorized title/body |
| reindex migration list | readable/manageable document に限定 | same scope + operational status | 他 manager の document/migration existence |
| audit | target ID、actor ID、before/after/reason/result by audit permission | same | document body、unauthorized text、secret |

全 caller-visible response の non-enumeration、authorized-only count/pagination、generalized error contract は `FR-091` を正とする。

## 9. Runtime negative matrix

最低限、次の直積を代表 pairwise + critical 全組合せで検証する。

| Dimension | Values |
| --- | --- |
| account | active, suspended, deleted, claim missing |
| role/feature | none, read, manage, admin, stale token |
| tenant | same, other, missing, forged request tenant |
| resource permission | none, readOnly, full, unknown |
| permission source | owner, direct user, direct group, folder explicit, inherited, nested group, legacy-only |
| lifecycle | active, archived, expired, deleted, staged, old index |
| timing | before revoke, after revoke, during queued run, cache hit, context expansion |
| path | list, get, download, lexical, vector, memory, citation, debug, share, move, delete, reindex |

Security acceptance:

- unauthorized body/title/citation/trace/cache = 0
- denial reason は operator trace に残せるが一般 response で existence を示さない
- authorized Recall@k と false-denial は unauthorized exposure と別の `SQ-009` で測る

## 10. Conflicts and open questions

| ID | Conflict/question | Target interim rule |
| --- | --- | --- |
| OQ-RD-001 | single/multi tenant | client tenant はどちらでも信頼しない |
| OQ-RD-002 | direct/folder/max/min/ordinary deny | mandatory deny → administrative-principal invariant → ordinary deny → versioned allow composition |
| OQ-RD-003 | direct full の危険操作 | source container full を要求する |
| OQ-RD-007 | SYSTEM_ADMIN/break-glass | normal resource bypass は禁止 |
| OQ-RD-008 | self signup/invite/SSO | conflict 解消まで実装済みと扱わない |
| OQ-RD-011 | share audience/principal 種別 | active same-tenant user/resource group のみ |
| OQ-RD-012 | move の source container `full` | source/destination 両方に `full` を要求 |

現行コードとの exact gap は `16_current_state_gap_analysis_202607.md` を参照する。
