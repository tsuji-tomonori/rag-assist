# RAG ライフサイクル要求 matrix 2026-07

## 1. Target lifecycle

```text
source registry
  ↓ discover/acquire
inspection ── fail ──► quarantined/rejected
  ↓ pass
parse → normalize → chunk → embed → stage index → validate
                                            │
                                  fail ──────┴──► quarantined/rollback
                                            │ pass
                                            ▼
                                         published
                                            │
              supersede / expire / revoke / delete
                                            ▼
                                  deny-first → cleanup → retained tombstone/audit
```

各状態は document と job を分ける。job 全体の成功で個別 document の partial/quarantined を隠さない。

## 2. State model

### 2.1 Source/document states

| State | Searchable | LLM eligible | Required evidence | Allowed transition |
| --- | ---: | ---: | --- | --- |
| discovered | no | no | source ID/location | acquired/rejected |
| acquired | no | no | snapshot/hash/connector version | inspecting/rejected |
| inspecting | no | no | format/size/malware/classification/owner/ACL checks | processing/quarantined |
| processing | no | no | stage state and immutable input version | partial/staged/quarantined |
| partial | no | no | affected page/section/span/block/chunk、warning/reason、retry/review policy | processing/quarantined/rejected |
| staged | isolated evaluator only | `FR-084` の isolated evaluator だけ可。一般利用者は不可 | manifest, counts, hashes, model/pipeline/policy versions | published/quarantined |
| published | yes | yes, subject to current auth/time/classification/usage/quality | approval, active version, current policy | archived/superseded/expired/revoked/deleted |
| archived | no | no | archive timestamp/reason、restore/delete policy | published by explicit review or deleted |
| quarantined | no | no | reasons, owner/reviewer, retry policy | processing/rejected |
| superseded | no for current QA; historical policy applies | no by default | successor/version/effective period | retained/deleted |
| expired/revoked | no | no | authoritative deny timestamp/reason | restored by explicit review or deleted |
| deleted | no | no | minimal tombstone/audit; purge ledger | retained tombstone only |

Target requirements: FR-066, FR-068, FR-072, FR-082, FR-083。

### 2.2 Job states

| Job state | Meaning | Required behavior |
| --- | --- | --- |
| queued | request accepted, work not started | current actor/resource permission not yet assumed valid |
| running | current authorization checked | tenant/corpus/document scoped idempotency key、stage checkpoint、attempt generation/fencing token |
| blocked/quarantined | human/security decision required | no publication; explicit reason |
| failed_retryable | transient failure | bounded retry from checkpoint。new generation 取得後は stale attempt の commit/compensation/publish を拒否 |
| failed_terminal | permanent failure | partial artifacts reconciled/quarantined |
| completed | all required stage outcomes recorded | not equivalent to every document published |
| permission_revoked | current authorization failed | no further read/write/commit |

Worker は開始時、保護対象読取・外部副作用・durable commit 前に `FR-090` の current authorization を再評価し、取り込み stage 復旧は `FR-083` に従う。

## 3. Source registry and admission

| Control | Mandatory metadata/check | Missing/failure action | Requirement |
| --- | --- | --- | --- |
| identity | stable source/document/version ID, snapshot/hash | reject/quarantine | FR-068, FR-072 |
| responsibility | owner, data steward, publication approver, contact | quarantine | FR-068 |
| authorization | tenant, policy reference, classification | deny/quarantine | FR-060, FR-068, FR-069 |
| usage | authoritative status, citation allowed, external-model allowed, log/eval allowed | deny affected use | FR-068, FR-073 |
| lifecycle | effective/expiry/supersedes/delete notification/retention | not current/published | FR-066, FR-068 |
| content safety | MIME/magic bytes, size/page/expanded size, malware, encrypted/unsupported | reject/quarantine | FR-068, FR-071 |
| extraction | parsed range, page/section/span、truncation、OCR mode/confidence、warning count | partial/quarantine; silent truncation prohibited | FR-068, FR-082 |
| quality | reviewer/status/freshness/extraction/eligibility | default unverified/not eligible | FR-068 |

一般 upload caller が tenant、owner、ACL、quality、approval、lifecycle を自己承認できない。

## 4. Ingestion stage contract

| Stage | Input invariant | Output invariant | Failure/recovery |
| --- | --- | --- | --- |
| acquire | authorized upload/connector session; size/hash/expiry | immutable snapshot | one-time/idempotency key |
| inspect | snapshot complete | format/classification/safety result | quarantine before parse |
| parse | approved format/budget | blocks + source spans + warnings | no silent truncation |
| normalize | raw/source mapping retained | normalized blocks + transformations | versioned parser config |
| chunk | parent version/policy と normalized structure/locator available | versioned boundary/structure/table-list-code/budget/overlap rule、stable chunk IDs、inherited attributes | quality violation は再分割/partial/quarantine、count/hash reconciliation |
| embed | approved model/dimension/cost policy | model/version/dimension attached | bounded retry/cache scoped by policy |
| stage index | isolated target index | manifest counts/hashes | current index unchanged |
| validate | stage artifacts complete | security/quality/promotion report | fail prevents publish |
| publish | approved report and optimistic current version | exactly one active logical version | atomic alias/outbox/reconciliation |

Relevant: FR-068, FR-069, FR-072, FR-075, FR-082, FR-083, FR-092。

## 5. Retrieval path contract

| Path | Authorization placement | Quality/lifecycle | Recheck points | Current status |
| --- | --- | --- | --- | --- |
| lexical | build/query only authorized manifests | current classification/usage/quality/lifecycle | before index reuse and use-purpose change | partial; prefiltered index exists |
| semantic/vector | tenant/auth partition or engine filter before finite top-K | current classification/usage/quality/lifecycle | manifest and before prompt/eval | gap; resource post-filter after query |
| memory | same policy as raw evidence; memory is hint not evidence | parent current classification/usage/quality/lifecycle | before clue use and raw evidence support | gap; legacy post-filter |
| multi-query | every query uses same immutable auth context | no relaxed zero-result path | each result merge | partial/needs contract |
| context expansion | each adjacent chunk exact parent match | current policy/lifecycle/quality/scope | every added chunk | gap; no reauthorization |
| cache | key includes tenant/actor-or-policy/policy version/index version | stale/revoke invalidation | cache hit | open/gap |
| citation/source fetch | current read permission | current lifecycle | click/fetch and answer emission | partial/needs revoke behavior |
| old/staged index | current deny/delete still enforced | stage quality | every query | gap/invariant absent |

Relevant: FR-056–FR-060, FR-066, FR-069, FR-070, SQ-005, SQ-006。

## 6. Evidence and generation contract

| Stage | Required input/output | Prohibited behavior | Requirement |
| --- | --- | --- | --- |
| query interpretation | original/resolved question, reference time, auth context, budgets | tenant/ACL inference from question | FR-056, FR-070 |
| candidate retrieval | authorized IDs + score + exclusion reason counts | unauthorized body in application prompt/trace | FR-070 |
| rerank/filter | hard security/time filters separate from soft relevance | zero-result ACL relaxation | FR-070, FR-073 |
| evidence set | topic/role/version/effective period/source span | silent discard of major conflict | FR-073 |
| prompt build | policy/question/evidence/output contract separated | document instruction treated as system instruction | FR-071 |
| generation | evidence-supported claims; explicit state | fill evidence gaps with internal knowledge as fact | FR-005, FR-073 |
| citation | claim ↔ explicit chunk/span mapping | empty used IDs expanded to all chunks | FR-004, FR-073, FR-075 |
| support check | claim-level support/refute/insufficient | missing supporting ID auto-filled | FR-015, FR-075 |

## 7. Prompt injection and poisoning controls

| Layer | Control | Verification |
| --- | --- | --- |
| ingest | detect suspicious instructions/source anomalies; quarantine/review | poisoned document corpus |
| metadata | escape and validate fileName/metadata; protected metadata | delimiter/encoded payload fixtures |
| retrieval | security/quality hard filter; current policy | unauthorized/poisoned high-similarity cases |
| prompt | delimit untrusted evidence and state it is non-instructional | prompt snapshot/behavior tests |
| tool | deterministic permission/allowlist; no document-driven credential/scope change | tool invocation negative tests |
| output | secret/system prompt/other-resource disclosure guard | exfiltration assertions |
| evaluation | attack success, false positive, normal quality separately | FR-075 promotion gate |

Relevant: FR-068, FR-071, SQ-005。

## 8. Index/version invariants

1. logical document/version、chunk、embedding、index、cache は stable IDs と manifest で結ぶ。
2. candidate index は current index から隔離して build/validate する。
3. publish/cutover/rollback は exactly one readable active version を維持する。
4. current authorization/classification/usage/quality/lifecycle deny は active/staged/old index のすべてに適用する。
5. retry は scoped key と attempt generation/fencing により idempotent で、winner attempt だけが partial object/vector/manifest を reconciliation/publish できる。
6. rollback は過去の ACL/quality/deleted content を復活させない。
7. source/pipeline/parser/chunker/chunking-policy/model/prompt/policy/index versions と counts/hashes を trace する。

Relevant: FR-066, FR-069, FR-072, FR-074, FR-083, FR-087, FR-092。

## 9. Evaluation matrix

| Layer | Unit | Metrics / gates | Critical slices |
| --- | --- | --- | --- |
| admission/chunk | document/block/chunk/job | extraction coverage、parser/OCR accuracy、rejected/quarantined/partial、silent truncation 0、locator validity、structure/boundary/overlap、manifest integrity、ACL/provenance missing 0 published | format, OCR, table/list/code, classification |
| retrieval | document/chunk/span | Recall@k, Precision@k, MRR, nDCG, all-evidence recall, underfill | tenant, role, multi-hop, time |
| access control | candidate/body/cache/trace | unauthorized exposure 0, over-denial separately | revoked, NULL, old index, cache |
| evidence | topic/claim | support/conflict/outdated retention | multi-source, policy/date |
| generation | claim/answer | faithfulness, unsupported claim, false answer/refusal | answerability, severity |
| citation | claim/source | precision, completeness, locator validity | numeric/date/exception claims |
| injection | request/session | attack success, secret/tool policy leak, false positive | encoded/indirect/poison |
| operations | stage/run | p50/p95/p99, timeout/error/retry, backlog, cost | dependency degradation |
| E2E | business task | complete/partial/handoff/requery | use case/role/language/OCR |

Promotion is the logical AND of approved thresholds. Unauthorized exposure and critical injection leak are zero-tolerance; unknown threshold is not a pass.

Relevant: FR-075, FR-092, SQ-005–SQ-015。

## 9.1 Production monitoring control loop

本番では `FR-074` の per-run trace と `FR-075` / `SQ-005`–`SQ-015` の metric 定義を、policy/index/model/prompt/pipeline/parser/chunker version と tenant/role/use-case slice ごとに集約する。critical event は即時、その他の drift は承認済み observation window で判定する。

必須 signal の欠損を green に補完せず、zero-tolerance security event、threshold 違反、承認済み drift 条件では、責任者へ profile/version/slice/trace/severity を通知し、runbook の promotion freeze、quarantine、last-known-safe rollback、限定回答、回答保留を実行する。縮退時も `FR-089` の安全制御を維持する（`FR-093`）。

## 10. Trace and data minimization

Required for reproducibility:

- request/run ID
- verified actor/tenant pseudonymous identifiers
- account/resource decision, policy/version, deny reason and counts
- original/resolved query hashes or sanitized text according to visibility
- source/index/model/prompt/parser/chunker/pipeline versions
- stage timing, candidate/result counts, retry/failure reasons
- evidence/citation IDs and locators within current permission

Forbidden by default:

- unauthorized body/title/citation
- raw secrets/credentials/system prompt
- unrestricted conversation/document bodies in general operator logs
- ACL principal lists without audit permission
- `redactedFields` metadata without actual field-level sanitize

Relevant: FR-074, FR-088。

## 10.1 Safe degradation invariant

dependency 遅延、障害、timeout、費用上限のいずれでも、認可、tenant/classification/usage、prompt-injection/tool policy、grounding、citation、output secret guard、trace redaction を無効化しない。承認済み fallback が安全制御を維持できない場合は、限定回答、回答保留、retryable failure のいずれかを選ぶ（`FR-089`）。

## 11. Open decisions

| ID | Decision |
| --- | --- |
| OQ-RD-004 | revocation/delete propagation max/p95/p99 |
| OQ-RD-005 | stage/slice quality threshold profiles |
| OQ-RD-006 | workload, latency/availability/cost SLO |
| OQ-RD-009 | retention/purge/legal hold per artifact type |
| OQ-RD-010 | source authority/effective-date/conflict escalation |

未確定値は `SQ-006`–`SQ-015` を Draft のままにし、測定値を合格値と誤記しない。
