# Phase B Gap: 3-layer authorization

- ファイル: `docs/spec/gap-phase-b.md`
- 種別: `SPEC_GAP`
- 作成日: 2026-05-14
- 状態: Draft
- 対象 task: `B-pre-gap`
- 後続 task: `B-authorization-3layer`

## Scope

Phase B は、仕様 16 / 17 / 18 / 19 / 20 / 21 / 21A の認可モデルを対象にする。

この gap 調査では実装変更を行わず、後続 `B-authorization-3layer` が実装すべき差分、踏襲すべき現行挙動、検証対象を整理する。

## Input Inventory

| ID | 種別 | 対象 | 確度 | 用途 |
| --- | --- | --- | --- | --- |
| B-SPEC-016 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 16 | confirmed | 3 層認可の基本方針。 |
| B-SPEC-017 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 17 | confirmed | `EffectiveFolderPermission` と resource permission。 |
| B-SPEC-018 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 18 | confirmed | feature permission namespace。 |
| B-SPEC-019 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 19 | confirmed | role preset。 |
| B-SPEC-020 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 20 | confirmed | 操作別の最終認可表。 |
| B-SPEC-021 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 21 | confirmed | RAG 認可不変条件。 |
| B-SPEC-021A | 仕様 | `docs/spec/2026-chapter-spec.md` 章 21A | confirmed | API lifecycle と protected endpoint の不変条件。 |
| B-IMPL-AUTH | 実装 | `apps/api/src/authorization.ts` | confirmed | 現行 role / permission / route metadata。 |
| B-IMPL-POLICY | 実装 | `apps/api/src/security/access-control-policy.test.ts` | confirmed | route-level permission 静的保証。 |
| B-IMPL-ROUTES | 実装 | `apps/api/src/routes/*.ts`, `apps/api/src/app.ts` | confirmed | route handler の現行認可処理。 |

## Spec Requirements Summary

| 章 | 要求 summary | 後続実装への入力 |
| --- | --- | --- |
| 16 | 操作可否は `Account status`、`Feature permission`、`Resource permission` の 3 層で判定する。権限エラー時は対象の存在を示唆しない。 | `authorizeOperation` 相当の入口で 3 層結果を合成する。403 body から missing permission 露出を減らす。 |
| 17 | `EffectiveFolderPermission = none / readOnly / full`。readOnly 未満は RAG 検索、citation、debug user 表示から除外。full は upload/delete/share/reindex など危険操作を許す。 | 型追加と folder/document/run scope の resource permission 計算を分離する。 |
| 18 | `chat:*`、`history:*`、`folder:*`、`document:*`、`index:*`、`benchmark:*`、`debug:*`、`agent:*` など namespace が仕様上の正規 permission。 | 現行 `rag:doc:*` / `chat:read:own` などとの互換 mapping を明示し、renaming は段階化する。 |
| 19 | role preset は最小権限。SYSTEM_ADMIN でも会話本文の無制限閲覧は避ける。 | 現行 9 role から仕様 role preset への gap を作る。高権限付与理由・監査は後続 admin/J3 に送る。 |
| 20 | 操作別に feature permission と resource permission を必ず対応させる。新操作追加時は表との差分を検出する。 | `access-control-policy.test.ts` を章 20 の既存 route 相当に拡張し、未実装操作は planning gap として残す。 |
| 21 | LLM に権限判断を任せない。searchScope 正規化、resource permission、quality policy、citation、debug trace sanitize を必ず通す。 | B では resource permission と route-level 認可境界を作り、quality 4 軸は Phase C、tool trace は Phase F/J2 に連携する。 |
| 21A | protected endpoint は user status + feature permission + resource permission を確認する。API error は権限外 resource の存在を示唆しない。 | OpenAPI `x-memorag-authorization` と実装の同期を維持し、error 互換性を B/J1/J2 で分担する。 |

## Chapter 20 Normalization Notes

`B-authorization-3layer` では、章 20 の表をそのまま実装定数に写す前に次の正規化が必要である。

| ID | confirmed / inferred | 正規化が必要な点 | B での扱い |
| --- | --- | --- | --- |
| B-NORM-001 | confirmed | `support:ticket:read/update` は章 18 では `support:ticket:read` と `support:ticket:update` に分かれている。 | support 系は Phase H/J3 依存。B では分離すべき permission として planning gap に残す。 |
| B-NORM-002 | confirmed | `debug:answer_generation:read` / `debug:answer_generation:export` は章 20 にあるが章 18 の debug permission 一覧にない。 | J2 の debug 4 tier で canonical permission を決める。B では現行 `chat:admin:read_all` を preserve。 |
| B-NORM-003 | confirmed | `worker:run:read` 周辺に `debug:trace:read` が出るが、章 18 は `debug:trace:read:self` / `sanitized` / `internal`。 | J2/I/G 依存。B では route metadata の不整合候補として記録のみ。 |
| B-NORM-004 | confirmed | `chat:create` または `rag:run` は代替 permission であり、通常 chat RAG と管理者向け RAG 実行の境界を曖昧にする。 | 既存 chat route は `chat:create` を維持し、`rag:run` は F/J2 の管理機能まで planning。 |
| B-NORM-005 | confirmed | `対象 run へのアクセス`、`対象 scope の管理権限`、`ログ閲覧範囲` は `EffectiveFolderPermission` だけでは表現できない。 | B では folder/document permission と run ownership helper を分ける。run/ticket/workflow resource 型は後続 Phase に渡す。 |
| B-NORM-006 | confirmed | `benchmark runner secret解決 = service permission` は user permission ではなく service principal / Secrets Manager / log masking の境界。 | Phase I に送る。B では user 3 層認可の対象外として明記する。 |
| B-NORM-007 | confirmed | `OpenAPI JSON閲覧 = なし、または api_contract:read` は public/protected が未確定。 | 現行 `/openapi.json` public を preserve し、J1 で runtime source of truth / public endpoint 非機微条件を再確認。 |

## Current Implementation Summary

| 領域 | confirmed current behavior | gap |
| --- | --- | --- |
| Account status | `authMiddleware` が Bearer token を検証し、非 public path に認証を要求する。account status の active/suspended/deleted 判定は `authorization.ts` にはない。 | 章 16 Layer 1 が未実装。B では user status field または adapter 境界の確認が必要。 |
| Feature permission | `authorization.ts` の `Permission` union と `rolePermissions` で判定する。`requirePermission` / `hasPermission` が route handler で使われる。 | 仕様 18 の permission namespace と現行 permission が一致しない。互換 alias または段階 rename 方針が必要。 |
| Resource permission | document upload/list/delete、owned chat run、benchmark seed run など一部 route で scoped check がある。 | `EffectiveFolderPermission` 型と汎用計算関数はない。folder readOnly/full/none の共通 model が不足。 |
| Role preset | 現行 role は `CHAT_USER`、`ANSWER_EDITOR`、`RAG_GROUP_MANAGER`、`BENCHMARK_OPERATOR`、`BENCHMARK_RUNNER`、`USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR`、`SYSTEM_ADMIN`。 | 仕様 19 の `PERSONAL_FOLDER_CREATOR`、`GROUP_FOLDER_MANAGER`、`SUPPORT_AGENT`、`DEBUG_OPERATOR`、`RAG_OPERATOR`、`ASYNC_AGENT_*` などが未実装。 |
| Route metadata | OpenAPI operation に `x-memorag-authorization` を付け、`access-control-policy.test.ts` が handler と metadata の同期を静的保証する。 | 章 20 の操作別 matrix との同期はまだない。 |
| Error message | generic metadata は `Forbidden: missing <permission>` を返す。document group assign など一部は `"Forbidden"` に丸める。 | 章 16/21A の「存在を示唆しない」方針と不一致。B で `missing <permission>` の露出削減方針が必要。 |

## Preserve Existing Behavior

| ID | 踏襲事項 | 根拠 |
| --- | --- | --- |
| B-PRESERVE-001 | `/health` と `/openapi.json` は public allowlist のまま維持する。 | `apps/api/src/app.ts`, `access-control-policy.test.ts` |
| B-PRESERVE-002 | non-public path は `authMiddleware` を必ず通す。 | `apps/api/src/app.ts` |
| B-PRESERVE-003 | OpenAPI の `x-memorag-authorization` と handler permission check の同期を維持する。 | `access-control-policy.test.ts` |
| B-PRESERVE-004 | `/chat/{runId}/events` は `chat:read:own` と run owner check を維持し、`chat:admin:read_all` の条件付き権限を落とさない。 | `chat-routes.ts`, `access-control-policy.test.ts` |
| B-PRESERVE-005 | question requester は本人の問い合わせ取得・解決で、条件により `answer:edit` / `answer:publish` なしでも限定操作できる。 | `question-routes.ts` |
| B-PRESERVE-006 | benchmark seed upload/list/delete は `benchmark:seed_corpus` の isolated metadata / manifest 制約を維持する。 | `document-routes.ts`, `benchmark-seed.ts` |
| B-PRESERVE-007 | document ingest run は owned run と benchmark seed run の scoped read を維持する。 | `document-routes.ts` |
| B-PRESERVE-008 | chat attachment upload は `chat:create`、document upload は `rag:doc:write:group`、benchmark seed upload は `benchmark:seed_corpus` の分岐を維持する。 | `document-routes.ts`, `benchmark-seed.ts` |
| B-PRESERVE-009 | SYSTEM_ADMIN だけに全 permission を持たせる現行挙動は、B で仕様 role へ移すまで互換維持する。 | `authorization.ts` |
| B-PRESERVE-010 | route 追加・削除時に `protected API routes must be explicitly reviewed before they change` の静的検出を維持する。 | `access-control-policy.test.ts` |
| B-PRESERVE-011 | `/questions/{id}` は `answer:edit` なら full response、requester 本人なら `internalMemo` を除外し、第三者には 404 を返す。 | `question-routes.ts` |
| B-PRESERVE-012 | requester による question resolve は、回答済みでない場合 409 を維持する。 | `question-routes.ts` |
| B-PRESERVE-013 | upload session は object key に user scope を含め、他人 scope の uploadId は 403 を維持する。 | `document-routes.ts`, `benchmark-seed.ts` |
| B-PRESERVE-014 | document group read は owner / manager / shared user / shared group / org visibility / SYSTEM_ADMIN、write は owner / manager / SYSTEM_ADMIN の境界を維持する。 | document store / service helpers |
| B-PRESERVE-015 | admin role assignment は自己更新 403、非 SYSTEM_ADMIN による SYSTEM_ADMIN 付与 403 を維持する。 | `admin-routes.ts` |
| B-PRESERVE-016 | benchmark seed upload/delete は metadata whitelist、suite whitelist、`aclGroups: [\"BENCHMARK_RUNNER\"]`、`source: \"benchmark-runner\"`、`docType: \"benchmark-corpus\"` の isolation を維持する。 | `benchmark-seed.ts`, `document-routes.ts` |

## Gap Matrix

| Gap ID | 状態 | 内容 | 後続対応 |
| --- | --- | --- | --- |
| B-GAP-001 | confirmed | `Account status` の active/suspended/deleted layer が現行認可関数にない。 | user directory / auth middleware の user status source を調査し、B 実装で status guard を追加または blocked として分離。 |
| B-GAP-002 | confirmed | `EffectiveFolderPermission` 型と none/readOnly/full の共通計算がない。 | `apps/api/src/authorization.ts` または専用 module に型と comparator を追加。 |
| B-GAP-003 | confirmed | feature permission 名が仕様 18 と現行実装で大きくずれる。 | B では互換 mapping を定数化し、API rename は別 Phase / breaking review へ送る。 |
| B-GAP-004 | confirmed | 章 20 の操作別 matrix が `access-control-policy.test.ts` に入っていない。 | 既存 route に対応する operation matrix subset を静的テストへ追加。未実装操作は planning table に残す。 |
| B-GAP-005 | confirmed | error body が `Forbidden: missing <permission>` を返し、権限外 resource の存在や内部 permission を示唆しうる。 | `requirePermission` と `routeAuthorization` metadata の 403 body を安全化する。OpenAPI docs も同期。 |
| B-GAP-006 | confirmed | debug 権限が `chat:admin:read_all` に寄っており、仕様 18.14 の `debug:*` / sanitize tier と一致しない。 | J2 と分担。B では現行 permission を preserve し、gap として残す。 |
| B-GAP-007 | confirmed | benchmark 権限が現行 `benchmark:query` / `benchmark:download` と仕様 `benchmark:artifact:download` 等で不一致。 | I/J2 と分担。B では現行 benchmark seed exception を preserve。 |
| B-GAP-008 | inferred | SYSTEM_ADMIN の全 permission 付与は仕様 19 の「会話本文の無制限閲覧を避ける」と衝突しうる。 | B では route-level `chat:admin:read_all` の scope を明示し、会話本文閲覧制限は J3/J2 へ送る。 |
| B-GAP-009 | confirmed | 章 21 の quality policy / freshness / supersession は Phase C 依存で、B 単独では完了できない。 | B は resource permission 境界を作り、quality-approved evidence は C/F で接続。 |
| B-GAP-010 | confirmed | 章 21A の API lifecycle drift gate は J1/J2 依存。 | B は `x-memorag-authorization` と 401/403 docs 同期維持に限定。 |
| B-GAP-011 | confirmed | run / ticket / workflow / environment / service secret の resource boundary は folder `EffectiveFolderPermission` だけでは表現できない。 | B では folder/document resource 型と existing run ownership を分け、その他 resource 型は後続 Phase に渡す。 |
| B-GAP-012 | confirmed | `RouteAuthorizationMetadata` は OpenAPI / 静的テスト用で、resource-level 条件は notes と regex test に依存しており、型付き policy ではない。 | B で operation key、resource condition 名、error contract を metadata/test へ入れる。 |
| B-GAP-013 | confirmed | `rolesWithAnyPermission` は conditional permission を含む role 候補を返すだけで、operation の最終許可条件を正確に表現しない。 | `allowedRoles` は表示補助に留め、最終認可は operation policy で表現する。 |
| B-GAP-014 | open_question | `benchmarkSeedListOrPermission` は seed 限定 note だが、現在の `listDocuments(user)` が ACL なし一般文書を BENCHMARK_RUNNER にも見せ得る可能性がある。 | B 実装前に現行意図を確認し、維持か seed 限定修正かを決める。 |

## B-authorization-3layer Implementation Input

後続 `B-authorization-3layer` は、次を最小実装単位にする。

1. `EffectiveFolderPermission = "none" | "readOnly" | "full"` 型を追加する。
2. resource permission の比較 helper を追加する。
3. `Permission` / `Role` / `rolePermissions` を仕様 18/19 と現行互換の差分が見える形に定数化する。
4. 既存 route の `x-memorag-authorization` metadata に、該当する章 20 operation key または resource requirement notes を追加する。
5. `access-control-policy.test.ts` に章 20 subset と route metadata の静的対応を追加する。
6. `requirePermission` の 403 response を generic にし、内部 permission 名の露出を抑える。
7. owner / requester / benchmark seed / upload session / document ingest run の例外を既存どおり維持する。
8. 未実装の仕様 permission / role / operation は実装した扱いにせず、planning gap として docs に残す。
9. typed operation policy には `operationKey`、`requiredFeaturePermission`、`resourceCondition`、`errorContract` を分けて持たせる。
10. `benchmarkSeedListOrPermission` の document list visibility は B 実装前に意図確認し、PR 本文に維持または変更理由を明記する。

## B-authorization-3layer Implementation Result

2026-05-14 の `B-authorization-3layer` では、既存 route と handler 境界を維持したまま 3 層認可 foundation を追加した。

| Gap ID | 実装結果 |
| --- | --- |
| B-GAP-001 | `AppUser.accountStatus` と `AccountStatus` を追加し、`hasPermission` / `requirePermission` の入口で active 以外を拒否する。Cognito custom claim が未指定の場合と local auth は互換維持のため active として扱う。 |
| B-GAP-002 | `EffectiveFolderPermission = none / readOnly / full` と comparator helper を追加し、read / manage 判定 helper をテストした。 |
| B-GAP-004 | 実装済み route subset に `operationKey` と `resourceCondition` を付与し、`access-control-policy.test.ts` で operation matrix subset と metadata 同期を検証する。 |
| B-GAP-005 | `requirePermission` と `routeAuthorization` の既定 403 body を generic `Forbidden` に変更した。benchmark seed / upload session / document upload 系の一部 helper も内部 permission 名を返さない。 |
| B-GAP-012 | `RouteAuthorizationMetadata` に `operationKey`、`resourceCondition`、`errorDisclosure` を追加し、OpenAPI metadata と静的 policy test の対象にした。 |
| B-GAP-014 | 変更しない。`benchmarkSeedListOrPermission` による `/documents` list visibility は現行挙動を preserve し、seed 限定へ変えるかは open question として残す。 |

未実装の仕様 permission / role rename、debug 4 tier、support / async agent / service secret 境界は B の完了扱いにせず、後続 Phase の planning gap として維持する。

## Targeted Validation For B

| 検証 | 目的 |
| --- | --- |
| `npm exec -w @memorag-mvp/api -- tsx --test src/security/access-control-policy.test.ts` | route metadata と handler permission check の静的同期。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/authorization.test.ts` | role / permission / error behavior の回帰。存在しない場合は B で追加。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/**/*.test.ts src/**/**/*.test.ts` | API 全体の認可回帰。 |
| requester question / chat run ownership / document ingest ownership / document group read-write / benchmark seed upload-delete / admin self-system assignment の targeted API tests | 既存の重要な resource boundary を落としていないことを確認する。 |
| `packages/contract/src/schemas/benchmark.ts` 周辺の privileged group override test | benchmark runner の権限昇格防止を維持する。 |
| `git diff --check` | whitespace / conflict marker 確認。 |
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` | spec-recovery 変更時の検証。B-pre では spec-recovery 未変更でも実行して記録する。 |

## Open Questions

| ID | 種別 | 内容 | 次の判断 |
| --- | --- | --- | --- |
| B-OQ-001 | open_question | `Account status` の source of truth が Cognito group / user directory / local store のどこか。 | B 実装前に `AppUser` と user directory adapter を確認する。 |
| B-OQ-002 | open_question | 仕様 permission 名への rename を B で行うか、互換 alias として残すか。 | B は後続 wave への影響が大きいため互換 mapping 優先。 |
| B-OQ-003 | open_question | 章 20 の未実装操作を policy test にどう表現するか。 | 実装済み route subset と planning-only operation を分ける。 |
| B-OQ-004 | open_question | generic 403 への変更が既存 UI / tests の文言期待に影響するか。 | B 実装で API test と UI error handling test を確認する。 |
| B-OQ-005 | open_question | `benchmarkSeedListOrPermission` の `/documents` list は seed 限定であるべきか、ACL なし一般文書可視 behavior を維持するべきか。 | B 実装前に service / product 意図を確認し、変更する場合は回帰テストを追加する。 |
