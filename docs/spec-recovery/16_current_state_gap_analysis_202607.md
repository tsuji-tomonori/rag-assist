# 現行コード gap analysis 2026-07

## 判定基準

| Status | 意味 |
| --- | --- |
| implemented | 要求の主経路・否定経路がコード/test で確認できた |
| partial | 一部経路または guard はあるが要求全体を保証しない |
| missing | 対応する強制処理を確認できない |
| conflict | accepted requirement/ADR と current implementation が相反する |
| open_question | 目標規則・値の stakeholder decision が必要 |

静的コード監査であり、本タスクでは AWS E2E、multi-user browser E2E、負荷試験を実行していない。したがって「コードがある」ことと「本番で要求を満たす」ことを区別する。

## Gap summary

| Gap ID | Severity | Status | Current evidence | Impact | Requirement | Recommended action | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-RD-001 | critical | missing | `auth.ts:51-63` は JWT custom status を読むが、`memorag-service.ts:1498-1509` は admin ledger だけを更新し、`user-directory.ts:15-18` は disable/revoke を持たない | suspended/deleted user が有効 session で継続利用し得る | FR-058, FR-090, SQ-006 | identity source update、token/session revoke、worker current reauthorization を接続する | active token + queued run を suspend する integration test |
| GAP-RD-002 | critical | missing/open_question | `auth.ts:7-12` の `AppUser` に tenant がなく、`memorag-service.ts:3065-3086` は `default`、store API は tenant 引数なし | multi-tenant なら cross-tenant read/write/search が構造的に防げない | FR-056, FR-060, SQ-005 | product tenancy を決定し、verified tenant を全 key/query/artifact へ必須化 | 2 tenant 同 ID の CRUD/search/cache/worker negative matrix |
| GAP-RD-003 | high | conflict | ADR-0004 は `FolderPermissionService` を単一源泉とするが、`memorag-service.ts:418-550,668-675` と `retrieve-memory.ts:31-83` は legacy helper。`folder-permission-service.ts:168,188-190` は user principal を userId/email の双方で比較し、application role を持つ `cognitoGroups` と resource group ID を同一 namespace で照合する | list/evidence/memory/upload/move で同じ資源の結果が異なり、ID/email または role/group ID 衝突で意図しない full が生じ得る | FR-059, FR-061, FR-063, FR-079, FR-081 | legacy ACL を migration compatibility に閉じ、principal ID と role/resource-group namespace を分離し、全 runtime path を同一 decision service へ移す | path parity + namespace collision contract test |
| GAP-RD-004 | high | conflict | ADR-0004:26 は通常 resource check を要求する一方、`document-group-permissions.ts:46`, `document-permission-service.ts:83`, `hybrid-retriever.ts:715-729` は SYSTEM_ADMIN bypass | 恒常管理 role で通常文書本文を無制限閲覧できる | FR-059 | normal admin と separate break-glass grant を分離 | SYSTEM_ADMIN without resource grant negative test |
| GAP-RD-005 | high | conflict/open_question | `document-permission-service.ts:309-325` は folder/direct max、章仕様は move に source folder full を要求 | direct `full` の再共有・移動・削除・reindex 範囲が不明 | FR-063, FR-065, FR-076, OQ-RD-003, OQ-RD-012 | direct/folder/deny composition と操作別 required permission を承認する | direct×folder×operation matrix |
| GAP-RD-006 | high | missing | `authorization.ts:165` で CHAT_USER は read を持つが `usePermissions.ts:39-49`, `AppRoutes.tsx:43-50` は manage だけで documents view を開く | read-only shared user が資料を発見・閲覧・chat 選択できない | FR-064 | read-only workspace/scope selector と server capability gating を追加 | owner↔CHAT_USER Web E2E |
| GAP-RD-007 | high | missing/partial | folder share は free-text ACL update、direct validator は空/重複/reason のみ。directory existence/same-tenant check がない | typo/unknown/other-tenant principal への誤共有 | FR-062, FR-077, FR-085, FR-086, OQ-RD-011 | immutable principal selector、active/same-tenant validation、version/administrative-principal guard/audit | invalid/archived/other-tenant/concurrent share tests |
| GAP-RD-008 | high | missing | `schemas.ts:209-239,378-394` は folder principal と arbitrary document metadata を list schema に含め、direct-share sanitize は folder IDs 中心。API ごとの absent/unauthorized error、count、pagination contract も統一されない | reader に owner/email/ACL/policy/internal metadata や権限外資源の存在・件数を過剰返却し得る | FR-064, FR-088, FR-091 | reader summary と management detail を別 allowlist endpoint/schema に分け、non-enumeration/authorized-only pagination を統一する | response schema/secret fixture + absent/unauthorized differential tests |
| GAP-RD-009 | high | partial | semantic query filter は tenant/doc/source 等だけで、`hybrid-retriever.ts:743-768` が finite hit 後に manifest permission を確認 | unauthorized top hit による underfill、timing/count side channel、本文の app 到達 | FR-070, SQ-005 | auth partition/query filter、または authorized top-K bounded refill と side-channel budget | unauthorized high-score corpus |
| GAP-RD-010 | critical | missing/partial | `retrieve-memory.ts:31-97` は legacy post-filter、`chat-rag-orchestrator.ts:443-505` の context expansion は current permission/lifecycle/quality を再確認しない | direct-share quality drift、revoke race で隣接 chunk を prompt へ追加し得る | FR-059, FR-070, SQ-005 | memory を同一 auth service へ移し、各 expanded chunk を exact parent/current policy で再認可 | revoke-between-retrieve-and-expand test |
| GAP-RD-011 | critical | missing | `memorag-service.ts:1093-1121,1148-1183,1270-1295,1322-1376` は submit 時 group snapshot を worker で再利用し、account status を復元しない | suspend/role/share revoke 後も queued chat/ingest が旧権限で実行し得る | FR-090, FR-058, FR-066, SQ-006 | worker start/protected-read/side-effect/commit で current identity/tenant/role/resource decision を再取得 | queued job revoke integration test |
| GAP-RD-012 | critical | conflict | `quality-policy.ts:53-65` は missing を approved/verified/current/high/eligible にし、upload metadata も quality 値を持てる。classification/usage/quality の current immutable reference と use-purpose recheck も全 derived record/retrieval/index にない | unknown/unreviewed document、または external-model/log/eval 許可を剥奪した文書が normal RAG evidence・prompt・evaluation に残る | FR-066, FR-068, FR-069, FR-070, FR-072, FR-075 | protected metadata、default unverified/ineligible、derived immutable references、use-purpose current recheck、reviewed transition/audit | missing/self-asserted/revoked classification-usage-quality negative tests across active/staged/old index/cache |
| GAP-RD-013 | high | missing/partial | `ingest-run.service.ts:38-229` は source/vector/manifest を順次書き、scoped idempotency、attempt generation/fencing、winner-only compensation がない。抽出は unsupported を text 扱いし silent char truncation があり、chunk boundary/structure/overlap/stable-ID/quality を一つの versioned contract で検証しない | duplicate/orphan/partial/silent data loss、stale worker による新 artifact の誤削除・遅延 publish、構造分断、再取り込み chunk drift、uninspected input publication | FR-068, FR-069, FR-072, FR-082, FR-083, FR-092 | durable stage state、tenant/corpus/document scoped idempotency、attempt fencing/conditional commit、MIME/magic/size/malware、winner-only reconciliation、source span/warning、versioned structure-aware chunking、no silent truncation | stage/concurrent-retry failure injection、stale worker、structured-boundary/determinism corpus |
| GAP-RD-014 | high | missing/partial | context XML escape と evidence-only prompt はあるが、untrusted instruction rule、detector/quarantine、tool/secret output guard、attack corpus がない | indirect prompt injection、poisoning、data exfiltration | FR-071, FR-075, SQ-005 | ingest/generation/tool/output 多層 control と versioned attack corpus | encoded/indirect/tool/secret attack suite |
| GAP-RD-015 | high | conflict | `citation-validator.ts:11-27` は empty used IDs を全 chunk へ、`answer-support-verifier.ts:92-106` は missing supporting ID を先頭 chunk へ補完 | citation の存在が claim support を保証しない | FR-073, FR-075, SQ-007, SQ-010, SQ-011 | claim-level explicit mapping を fail closed にし auto-fill を廃止 | unsupported claim/empty-ID tests |
| GAP-RD-016 | high | missing | `memorag-service.ts:701-711` は source/vector/manifest 等を順次物理削除するが grants/cache/ledger/queued runs/tombstone/reconciliation がない | partial delete、old index/cache 再露出、audit 不能 | FR-066, SQ-006 | deny-first tombstone、derived purge ledger、retry/reconciliation、audit retention | concurrent search + partial delete failure test |
| GAP-RD-017 | critical | missing/partial | `memorag-service.ts:292-350` の cutover/rollback は delete/supersede 後の re-ingest 失敗を補償しない | active document 0件、複数 active、old ACL 復活 | FR-072, SQ-006 | isolated manifest、atomic alias/outbox、exactly-one-active invariant | stage-by-stage fault injection |
| GAP-RD-018 | high | conflict | `chat-rag-orchestrator.ts:777-833`, `memorag-service.ts:2882-2919` は raw question/history/evidence/answer を trace に持ち、redacted metadata と実 sanitize が一致しない | debug artifact が機微情報集積になる | FR-074, FR-088 | save-time field sanitize + visibility allowlists + retention/access audit | secret/unauthorized fixture stored/download assertions |
| GAP-RD-019 | high | partial/conflict | accepted benchmark contract は versioned evaluator/RAG profile 選択を許す。一方 `answer-policy.ts:83-115,149-154` は SWEBOK 固有分類語・除外 regex を product runtime に固定し、document metadata から自動選択する。production-equivalence と「期待データを runtime input にしない」検証がない | 正当な評価 profile と dataset 固有 product 分岐が混同され、評価 leakage または本番と異なる経路を見逃す | FR-075, SQ-007 | benchmark evaluator profile は評価側に維持し、product policy は承認済み versioned asset として dataset expected fields から隔離し、同一 runtime path/profile equivalence を検証する | product-source scan + expected-field taint check + profile-equivalence benchmark |
| GAP-RD-020 | high | conflict | `FR-025`/Web は self-signup を要求・提供するが `memorag-mvp-stack.ts:310` は disabled、post-confirmation handler は stack 未接続、章仕様は invite basic | 利用者作成経路が環境・文書で不一致 | FR-025, FR-056, OQ-RD-008 | invite/self/SSO/tenant policy を決定し、infra/Web/docs/test を同期 | CDK assertion + auth E2E |
| GAP-RD-021 | high | conflict | ADR-0005 は CloudFront single entry/PKCE/no wildcard CORS、実装は execute-api URL/password auth/wildcard CORS | accepted trust boundary が deploy 構成に反映されない | FR-056, TC-003 | ADR の採否を再確認し edge/app/public allowlist と auth flow を同期 | CDK/browser origin/auth-flow integration |
| GAP-RD-022 | high | partial/conflict | backend role 12種に対し Cognito group 9種。role change は last SYSTEM_ADMIN/revoke/reason guard が不足 | UI に付与不能 role、管理者喪失、privilege change audit 不足 | FR-058, FR-079, FR-080, FR-086 | role catalog single source、assign/revoke分離、last-admin/self/reason/audit guard | infra/backend/Web catalog contract + admin negative matrix |
| GAP-RD-023 | high | missing/partial | document move は `memorag-service.ts:637-638` で manifest を先に上書きし、vector metadata update は optional で S3 vector store に実装がない。folder move は `memorag-service.ts:512-542` で subtree path を更新するが、配下文書の manifest/vector/index metadata と inherited policy を同じ公開単位で再計算しない | move 後に old folder metadata/policy が検索・表示へ残り、許可済み検索の underfill、旧 scope 混在、経路別認可 drift が起き得る | FR-061, FR-065, FR-070, FR-087, SQ-009 | document/folder move を versioned state transition とし、subtree/manifest/chunk/vector/index/path/direct/inherited grant を reconciliation してから公開する | resource-type/stage fault injection + subtree cycle + semantic search old/new scope matrix |
| GAP-RD-024 | high | missing/partial | `chat-rag-orchestrator.ts:777-833` は per-run trace、benchmark runner は release-time metric を持つが、本番 stage/slice 別 aggregation、drift/critical threshold、alert、safe action の versioned contract がない | corpus/model/policy/dependency 変更後の品質劣化・権限漏えい・injection regression を公開後に検出・封じ込められない | FR-074, FR-075, FR-089, FR-093, SQ-005–SQ-015 | production metric/trace aggregation、versioned monitoring profile、on-call alert、quarantine/rollback/limited-answer runbook を接続する | synthetic drift/critical event、missing-signal、alert/action/rollback drill |

## Prioritized remediation sequence

### P0-A: authoritative identity and tenant

1. OQ-RD-001 と OQ-RD-008 を Product/Security/Identity が決定する。
2. AppUser/worker context に authoritative tenant/account state を追加する。
3. Cognito disable/revoke/restore と admin ledger/audit を一つの account lifecycle contract にし、worker current reauthorization (`FR-090`) を接続する。
4. all store APIs/query keys と artifacts を tenant-scoped に migration する。

Exit criteria:

- suspended actor と stale queued run が全 path で拒否される
- tenant A/B 同 ID negative matrix が unauthorized exposure 0

### P0-B: canonical resource authorization

1. FolderPermissionService/DocumentPermissionService の decision schema/version/reason を定義する。
2. legacy list/upload/search/memory/move/delete/reindex path を同一 service へ移す。
3. SYSTEM_ADMIN normal bypass を除去し、必要なら separate break-glass を設計する。
4. vector/memory/context expansion/citation/cache へ prefilter/recheck を適用する。

Exit criteria:

- path parity test
- SQ-005 must-not-access gate
- revoke race/old index/cache negative tests

### P1: sharing product behavior

1. OQ-RD-002/003 を決定する。
2. directory-backed principal selector、share version/audit/administrative-principal guard。
3. read-only discovery/view/chat scope と minimal list schemas。
4. move/delete/reindex の source/destination/coherent metadata/outbox（GAP-RD-023）。

Exit criteria:

- owner↔read-only user Web E2E
- direct/folder/deny/operation matrix
- no principal/arbitrary metadata in reader responses

### P1/P2: safe ingestion and RAG quality

1. quality default を unverified/ineligible にし source admission/quarantine を実装する。
2. ingest idempotency/state/reconciliation/content boundaries と versioned structure-aware chunking を実装する。
3. injection/claim-citation/trace redaction controls を実装する。
4. executable promotion gate、production monitoring control loop、approved SLO/quality profiles を接続する。

Exit criteria:

- failure-injection ingest/index tests
- injection/poisoning corpus critical leak 0
- claim-level citation/support gate
- approved SQ-006–SQ-015 thresholds または未承認を明記した release block

## Documentation impact

更新が必要な既存文書:

- `FR-025`: signup 方針決定後に state/AC を同期
- `ARC_ADR_004`: legacy migration 完了条件、direct document composition、break-glass
- `ARC_ADR_005`, `TC-003`: accepted/deferred の整理と infra 実装同期
- `DES_API_001`: direct share/move、reader summary/manager detail、current authorization
- `DES_DATA_001`: tenant key、policy version、tombstone、index/ingest manifest、retention
- `OPERATIONS.md`: account revoke、share revoke、quarantine、rollback、SLO/incident runbook

本タスクは target requirements と gap を定義した段階であり、上記 implementation/design docs を実装済み状態へ更新していない。
