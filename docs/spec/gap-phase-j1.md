# Phase J1 Gap: OpenAPI runtime source and API lifecycle

- ファイル: `docs/spec/gap-phase-j1.md`
- 種別: `SPEC_GAP`
- 作成日: 2026-05-14
- 状態: Draft
- 対象 task: `J1-pre-gap`
- 後続 task: `J1-openapi-runtime-source`

## Scope

Phase J1 は、仕様 14B「API契約・OpenAPI / oRPC・開発品質ゲート」と 21A「API lifecycle と互換性の不変条件」を対象にする。

この gap 調査ではコード変更を行わず、現行 `GET /openapi.json`、OpenAPI Markdown 生成、docs quality / drift gate、REST / oRPC / shared contract、compatibility / deprecation の差分を整理する。生成済み `docs/generated/openapi.md` と `docs/generated/openapi/` は派生成果物のため手編集しない。

## Input Inventory

| ID | 種別 | 対象 | 確度 | 用途 |
| --- | --- | --- | --- | --- |
| J1-SPEC-14B | 仕様 | `docs/spec/2026-chapter-spec.md` 14B 章 | confirmed | runtime OpenAPI、REST / oRPC / shared contract、drift gate、generated docs、compatibility API の要求。 |
| J1-SPEC-21A | 仕様 | `docs/spec/2026-chapter-spec.md` 21A 章 | confirmed | API lifecycle、breaking change、deprecated endpoint、public/protected endpoint 不変条件。 |
| J1-MAP | 章対応表 | `docs/spec/CHAPTER_TO_REQ_MAP.md` 14B / 21A 行 | confirmed | J1 対象章の REQ / 実装対応。 |
| J1-REQ-FR053 | 要件 | `REQ_FUNCTIONAL_053.md` | confirmed | OpenAPI runtime source of truth と API drift / docs quality gate。 |
| J1-REQ-FR055 | 要件 | `REQ_FUNCTIONAL_055.md` | confirmed | public endpoint / middleware / worker contract。21A の public/protected 不変条件に隣接。 |
| J1-DES-API | 設計 | `docs/3_設計_DES/41_API_API/DES_API_001.md` | confirmed | OpenAPI 生成 Markdown、runtime source of truth、docs check の既存設計記述。 |
| J1-IMPL-APP | 実装 | `apps/api/src/app.ts` | confirmed | `/openapi.json` route、public allowlist、OpenAPIHono、oRPC handler 接続。 |
| J1-IMPL-OPENAPI-DOCS | 実装 | `apps/api/src/generate-openapi-docs.ts` | confirmed | `app.request("/openapi.json")` から Markdown を生成する処理。 |
| J1-IMPL-OPENAPI-CHECK | 実装 | `apps/api/src/validate-openapi-docs.ts`, `apps/api/src/openapi-doc-quality.ts` | confirmed | summary / description / field description / authorization metadata の quality check。 |
| J1-CI-MAIN | CI | `.github/workflows/memorag-ci.yml` | confirmed | `npm run docs:openapi:check` と generated web/infra inventory check を実行。 |
| J1-CI-OPENAPI | CI | `.github/workflows/memorag-openapi-docs.yml` | confirmed | main push / manual で OpenAPI Markdown を再生成して PR 作成。 |
| J1-CONTRACT-TEST | テスト | `apps/api/src/contract/api-contract.test.ts` | confirmed | HTTP response を runtime `/openapi.json` schema に照合する主要 endpoint contract test。 |
| J1-ORPC | 実装 | `packages/contract/src/`, `apps/api/src/orpc/router.ts`, `apps/web/src/shared/api/orpc.ts` | confirmed | oRPC / shared contract が存在する。REST との網羅的 drift 比較は未確認。 |

## Spec Requirements Summary

| 章 / AC | 要求 summary | 現行分類 |
| --- | --- | --- |
| 14B.1 / AC-API-CONTRACT-001 | `GET /openapi.json` を runtime API contract の source of truth とする。 | partially covered |
| 14B.3 | REST endpoint、oRPC procedure、OpenAPI、shared contract の責務を分け、同一 use case の schema drift を許容しない。 | partially covered |
| 14B.4 / AC-API-CONTRACT-002 | REST / oRPC / OpenAPI / docs の drift を CI で検出する。 | missing |
| 14B.5 / AC-API-CONTRACT-003/004 | OpenAPI Markdown を自動生成し、summary / description / field description 不足を gate する。 | partially covered |
| 14B.6 / AC-API-CONTRACT-005 | Web UI inventory を static analysis で生成し、certainty を付与する。 | confirmed |
| 14B.7 / AC-API-CONTRACT-006 | 後方互換同期 API を deprecated / compatibility として表示し、長時間用途は非同期 API へ誘導する。 | partially covered |
| 21A | breaking change は drift gate とレビューで止め、deprecated endpoint と public/protected 不変条件を管理する。 | partially covered |

## confirmed

| ID | 現行で確認できた事実 | 根拠 | 仕様との差分 |
| --- | --- | --- | --- |
| J1-CONF-001 | `GET /openapi.json` は `OpenAPIHono` の runtime route として定義され、`app.getOpenAPIDocument()` に `enrichOpenApiDocument()` を通した JSON を返す。 | `apps/api/src/app.ts` | runtime OpenAPI source は存在する。 |
| J1-CONF-002 | `/health` と `/openapi.json` は public allowlist に含まれ、認証 middleware を通さない。 | `apps/api/src/app.ts`, `apps/api/src/security/access-control-policy.test.ts` | 21A の public endpoint 非機微条件を J1/J2 で継続確認する必要がある。 |
| J1-CONF-003 | OpenAPI Markdown 生成は `app.request("/openapi.json")` の結果を入力にして `docs/generated/openapi.md` と API ごとの Markdown を出力する。 | `apps/api/src/generate-openapi-docs.ts` | 生成 Markdown は runtime JSON の派生成果物という方針に合う。 |
| J1-CONF-004 | `docs/generated/openapi.json` は生成物として commit されておらず、生成スクリプトは既存 JSON を削除して Markdown のみを書き出す。 | `apps/api/src/generate-openapi-docs.ts`, `docs/generated/` | JSON 正本を repository 生成物にしない方針に合う。 |
| J1-CONF-005 | OpenAPI docs quality check は runtime `/openapi.json` を読み、operation summary / description、field description、protected API の authorization metadata と 401 / 403 response を検査する。 | `apps/api/src/validate-openapi-docs.ts`, `apps/api/src/openapi-doc-quality.ts` | docs quality の一部は CI gate されている。 |
| J1-CONF-006 | `.github/workflows/memorag-ci.yml` は `npm run docs:openapi:check` を実行する。 | `.github/workflows/memorag-ci.yml` | PR/CI で description 品質低下は検出できる。 |
| J1-CONF-007 | `.github/workflows/memorag-openapi-docs.yml` は main push / manual で `npm run docs:openapi` と `npm run docs:openapi:check` を実行し、差分があれば generated Markdown 更新 PR を作る。 | `.github/workflows/memorag-openapi-docs.yml` | generated docs 自動更新 PR はある。 |
| J1-CONF-008 | `api-contract.test.ts` は local API を起動し、主要 endpoint の HTTP response を runtime `/openapi.json` の response schema に照合する。 | `apps/api/src/contract/api-contract.test.ts` | major response drift の一部は test で検出できる。 |
| J1-CONF-009 | `packages/contract`、`apps/api/src/orpc/router.ts`、`apps/web/src/shared/api/orpc.ts` に oRPC / shared contract 経路がある。 | `packages/contract/src/router.ts`, `apps/api/src/orpc/router.ts`, `apps/web/src/shared/api/orpc.ts` | 14B が要求する REST / oRPC の関係は存在する。 |
| J1-CONF-010 | 互換同期 API のうち `POST /documents` と `POST /documents/uploads/{uploadId}/ingest` は OpenAPI description 上で非推奨または後方互換用と説明されている。 | `apps/api/src/openapi-doc-quality.ts`, `docs/generated/openapi/post-documents.md`, `docs/generated/openapi/post-documents-uploads-uploadid-ingest.md` | compatibility 表示の一部は実装済み。 |
| J1-CONF-011 | `POST /chat` は設計 docs 上は後方互換同期 JSON APIと説明されている。 | `docs/3_設計_DES/41_API_API/DES_API_001.md` | runtime OpenAPI description では deprecated / compatibility とまでは明示していない。 |
| J1-CONF-012 | Web UI inventory は generated docs と check script が存在し、CI で `npm run docs:web-inventory:check` が実行される。 | `package.json`, `.github/workflows/memorag-ci.yml`, `docs/generated/web-ui-inventory.json` | 14B.6 は J1 範囲では確認済み。 |

## partially covered

| ID | 内容 | 根拠 | 残差分 |
| --- | --- | --- | --- |
| J1-PART-001 | `GET /openapi.json` は runtime source として存在し、生成 Markdown もそこから作るが、source-of-truth 関係を機械的に保証する dedicated test は限定的。 | `app.ts`, `generate-openapi-docs.ts`, `api-contract.test.ts` | 後続で runtime source を直接検証する minimal test / docs gate の責務を明確化する。 |
| J1-PART-002 | docs quality gate は summary / description / field description / authorization metadata を検査する。 | `openapi-doc-quality.ts` | operationId、schema 互換、REST/oRPC schema drift、breaking change は検出しない。 |
| J1-PART-003 | generated Markdown 更新 PR workflow は存在する。 | `.github/workflows/memorag-openapi-docs.yml` | 通常 PR 上で「generated Markdown が stale か」を fail する drift gate ではない。main 反映後の追従 PR で処理する方式。 |
| J1-PART-004 | 主要 endpoint response は runtime OpenAPI schema に照合される。 | `api-contract.test.ts` | request schema、全 endpoint、oRPC contract、breaking/deprecation lifecycle までは網羅しない。 |
| J1-PART-005 | public endpoint は allowlist で維持される。 | `app.ts`, `access-control-policy.test.ts` | `/openapi.json` の公開範囲、非機微性、rate/abuse 対策の明文化は不足。 |
| J1-PART-006 | 互換 API の一部は description で非推奨を説明する。 | `openapi-doc-quality.ts`, `DES_API_001.md` | OpenAPI `deprecated: true`、`x-memorag-lifecycle`、利用状況監視、migration note はない。 |

## missing

| Gap ID | 状態 | 内容 | 後続対応 |
| --- | --- | --- | --- |
| J1-GAP-001 | missing | REST route と oRPC procedure の use case 対応表、schema 差分検出、operationId / request / response drift の CI gate がない。 | `J1-openapi-runtime-source` で最小比較対象を定義し、網羅的比較は後続へ分割する。 |
| J1-GAP-002 | missing | PR 上で `npm run docs:openapi` 実行結果と checked-in `docs/generated/openapi*` の差分を検出して fail する gate がない。 | Markdown stale drift を CI fail にするか、自動 PR 方式を正式運用として残すか決める。 |
| J1-GAP-003 | missing | `ApiContractArtifact` の `artifactId`、`contractVersion`、`sourceCommitSha`、endpoint count、driftStatus、docsQualityStatus、artifact path を保存または表示する実装がない。 | まず generated report または CI summary から開始し、管理画面表示は J3 へ送る。 |
| J1-GAP-004 | missing | breaking change 判定、deprecated endpoint registry、migration note、削除予定時期、利用状況監視がない。 | `x-memorag-lifecycle` または別 lifecycle registry を設計する。 |
| J1-GAP-005 | missing | `/openapi.json` に対する abuse/rate limit 方針や public exposure policy が明文化されていない。 | J1/J2 で public endpoint 非機微条件と運用 guard を文書化する。 |
| J1-GAP-006 | missing | compatibility endpoint の timeout failure から asynchronous run への誘導 contract が統一されていない。 | `POST /chat`、sync ingest、sync document create の error/migration response を設計する。 |

## divergent

| ID | 内容 | 根拠 | 判断 |
| --- | --- | --- | --- |
| J1-DIV-001 | 仕様 14B.4 は REST / oRPC / OpenAPI / generated docs の drift を CI fail で止める想定だが、現行は docs quality check と post-main generated docs PR が中心。 | `.github/workflows/memorag-ci.yml`, `.github/workflows/memorag-openapi-docs.yml` | 現行運用を踏襲しつつ、J1 で fail gate 化する範囲を限定する。 |
| J1-DIV-002 | `GET /openapi.json` は public endpoint だが、quality validator の `requiresAuthorization()` は `/health` 以外を protected とみなす。 | `app.ts`, `openapi-doc-quality.ts` | OpenAPI document 自体は route 一覧の出力対象ではなく、public allowlist と quality validator の責務差として扱う。 |
| J1-DIV-003 | 仕様は synchronous compatibility API を deprecated / compatibility と明示するが、runtime OpenAPI は一部 endpoint の日本語 description に留まり、機械可読 lifecycle metadata はない。 | `openapi-doc-quality.ts` | 後続で `deprecated: true` を使うか custom extension にするかを決める。 |

## Preserve Existing Behavior

| ID | 踏襲すべき既存挙動 | 根拠 | J1 での扱い |
| --- | --- | --- | --- |
| J1-PRESERVE-001 | `GET /openapi.json` は runtime `app.getOpenAPIDocument()` から生成し、checked-in `openapi.json` を正本にしない。 | `app.ts`, `generate-openapi-docs.ts`, `DES_API_001.md` | source-of-truth として維持する。 |
| J1-PRESERVE-002 | generated Markdown は `npm run docs:openapi` で作り、手編集しない。 | generated file comment, `generate-openapi-docs.ts` | J1 では generated docs を直接編集しない。 |
| J1-PRESERVE-003 | `/health` と `/openapi.json` は public allowlist として維持する。 | `app.ts`, `access-control-policy.test.ts`, `gap-phase-b.md` | 21A の public endpoint 非機微条件を文書化し、保護 route の認証境界を弱めない。 |
| J1-PRESERVE-004 | `x-memorag-authorization` と handler permission check の同期を静的 test で維持する。 | `access-control-policy.test.ts`, `gap-phase-b.md` | lifecycle metadata 追加時も authorization metadata を削らない。 |
| J1-PRESERVE-005 | OpenAPI quality gate は日本語 summary / description / field description を要求する。 | `openapi-doc-quality.ts` | drift gate 追加時も docs quality gate を置き換えない。 |
| J1-PRESERVE-006 | 既存 compatibility API は即削除せず、同期 `/chat`、同期 document create / ingest の互換性を保つ。 | `DES_API_001.md`, `openapi-doc-quality.ts`, `api-contract.test.ts` | deprecation 表示を追加する場合も breaking removal はしない。 |
| J1-PRESERVE-007 | API contract test は runtime `/openapi.json` に対する主要 response schema 照合として維持する。 | `api-contract.test.ts` | drift gate 追加時も HTTP contract regression を残す。 |

## J1-openapi-runtime-source Scope

後続 `J1-openapi-runtime-source` の最小 scope は次とする。

1. `GET /openapi.json` が runtime source of truth であることを、docs と最小検証で明確化する。
2. `npm run docs:openapi` が runtime OpenAPI から Markdown を生成する派生成果物であることを維持し、生成 Markdown を手編集しない方針を PR body / docs に残す。
3. `docs:openapi:check` の責務を「description / auth metadata quality gate」として明確化し、drift gate との差を文書化する。
4. PR 上で generated Markdown stale を検出する方式を採用する場合は、`npm run docs:openapi` 実行後の diff 検出を追加する。自動 PR 方式を採用する場合は、その運用を明示し、CI fail gate ではないことを明記する。
5. REST / oRPC / shared contract drift は、初回では対応表または代表 endpoint の比較に限定し、網羅的 schema equivalence は後続 task とする。
6. compatibility API には機械可読 lifecycle metadata の候補を追加する。ただし既存 client 互換を壊す field removal や endpoint removal はしない。
7. public `/openapi.json` の非機微性、保護 route の authorization metadata、401 / 403 docs の同期を維持する。

## J1-openapi-runtime-source Scope-out

| ID | scope-out | 理由 / 委譲先 |
| --- | --- | --- |
| J1-OUT-001 | 全 REST endpoint と全 oRPC procedure の完全な schema equivalence checker。 | 初回で扱うには大きい。代表 use case と対応表から始める。 |
| J1-OUT-002 | API 管理画面での drift / deprecated endpoint 表示。 | J3 管理画面または運用 dashboard task。 |
| J1-OUT-003 | compatibility endpoint の削除、breaking API version 導入。 | 既存 client 互換を壊すため別 major / migration task。 |
| J1-OUT-004 | rate limit / WAF / abuse protection の実装。 | public endpoint 運用 guard として J2/infra/ops と調整する。 |
| J1-OUT-005 | generated web inventory の機能追加。 | 14B.6 は現行で確認済み。J1 は OpenAPI / API lifecycle を優先する。 |

## Open Questions

| ID | 種別 | 内容 | 次の判断 |
| --- | --- | --- | --- |
| J1-OQ-001 | open_question | generated Markdown stale を PR CI で fail させるか、main push 後の自動 PR を正式運用として維持するか。 | review latency と generated docs churn を見て決める。 |
| J1-OQ-002 | open_question | deprecated / compatibility 表示は OpenAPI 標準 `deprecated: true`、custom `x-memorag-lifecycle`、または外部 registry のどれを source にするか。 | client generator 影響と docs 表示要件を比較する。 |
| J1-OQ-003 | open_question | REST / oRPC の同一 use case 対応表をコードに持つか、docs/spec に持つか。 | drift gate の自動化範囲に合わせて決める。 |
| J1-OQ-004 | open_question | public `/openapi.json` の濫用対策を API middleware で入れるか、edge / WAF / CDN policy で扱うか。 | デプロイ環境と cost risk に合わせて J2/infra と調整する。 |

## Targeted Validation For J1

| 検証 | 目的 |
| --- | --- |
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` | spec-recovery 構造と ID 存在の確認。 |
| `git diff --check` | Markdown whitespace / conflict marker 確認。 |
| `npm run docs:openapi:check` | OpenAPI 関連 docs を更新した場合の runtime OpenAPI quality gate 確認。 |

## J1-openapi-runtime-source Implementation Result

| ID | 状態 | 内容 | 根拠 |
| --- | --- | --- | --- |
| J1-IMPL-001 | implemented | `GET /openapi.json` が `app.getOpenAPIDocument(openApiConfig)` に `enrichOpenApiDocument()` を適用した runtime document と一致することを test で固定した。 | `apps/api/src/openapi-runtime-source.test.ts` |
| J1-IMPL-002 | implemented | `npm run docs:openapi:check` が runtime OpenAPI から generated Markdown を再レンダリングし、checked-in `docs/generated/openapi.md` / `docs/generated/openapi/` と一致しない場合に fail する。`docs/generated/openapi.json` は commit しない。 | `apps/api/src/generate-openapi-docs.ts`, `apps/api/src/validate-openapi-docs.ts` |
| J1-IMPL-003 | implemented | 互換同期 API に `x-memorag-lifecycle` を付与し、stage / replacement / migrationNote / removalPolicy の最小 metadata を docs quality gate で検証する。 | `apps/api/src/openapi-doc-quality.ts`, `docs/generated/openapi/post-chat.md`, `docs/generated/openapi/post-documents.md` |
| J1-IMPL-004 | implemented | `packages/contract` に定義された代表 oRPC route が runtime OpenAPI に存在し、input/output を持つ procedure が requestBody / 200 response を持つことを check する。 | `apps/api/src/openapi-contract-drift.ts`, `apps/api/src/openapi-runtime-source.test.ts` |
| J1-IMPL-005 | documented | `GET /openapi.json` は public endpoint として、route/schema/公開 description/authorization/lifecycle metadata のみ返し、問い合わせ本文、回答、参照 chunk、内部 memo、debug trace、署名付き URL、個人別データを返さないことを設計 docs に明記した。 | `docs/3_設計_DES/41_API_API/DES_API_001.md` |

## Remaining Scope After J1-openapi-runtime-source

| ID | 状態 | 内容 | 理由 |
| --- | --- | --- | --- |
| J1-REM-001 | open_question | 全 REST endpoint と全 oRPC procedure の schema equivalence checker は未実装。 | 初回 J1 では代表 route mapping と requestBody / 200 response presence に限定したため。 |
| J1-REM-002 | open_question | breaking change 判定、削除予定日、利用状況監視を含む lifecycle registry は未実装。 | 既存 client 互換を壊さず、`x-memorag-lifecycle` の最小 metadata から開始したため。 |
| J1-REM-003 | open_question | `/openapi.json` の rate limit / WAF / CDN policy は未実装。 | J1 ではアプリ内 contract metadata と docs gate を対象にし、edge 側 abuse guard は J2/infra/ops task へ残したため。 |
