# Phase C Gap: 3B knowledge quality and RAG eligibility

- ファイル: `docs/spec/gap-phase-c.md`
- 種別: `SPEC_GAP`
- 作成日: 2026-05-14
- 状態: Draft
- 対象 task: `C-pre-gap`
- 後続 task: `Phase C implementation`

## Scope

Phase C は、仕様 3B「ナレッジ品質・RAG利用可否」を対象にする。

この gap 調査では実装変更を行わず、仕様 3B と既存 document store / RAG フィルタの差分、踏襲すべき現行挙動、未確定事項を整理する。`docs/spec/CHAPTER_TO_REQ_MAP.md` は 3B 行が既に存在するため編集しない。

## Input Inventory

| ID | 種別 | 対象 | 確度 | 用途 |
| --- | --- | --- | --- | --- |
| C-SPEC-3B | 仕様 | `docs/spec/2026-chapter-spec.md` 章 3B | confirmed | ナレッジ品質、RAG利用可否、受け入れ条件 `AC-KQ-*` の正。 |
| C-SPEC-4A10 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 4A.10 | confirmed | RAG回答時の品質ポリシーと trace sanitize 方針。 |
| C-SPEC-21 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 21 | confirmed | authorized and quality-approved evidence の不変条件。 |
| C-MAP-3B | 章対応表 | `docs/spec/CHAPTER_TO_REQ_MAP.md` 3B 行 | confirmed | 3B は `FR-002`, `FR-045`, `GAP-013`, `GAP-014` 対応、状態 missing。 |
| C-REQ-FR014 | 要件 | `REQ_FUNCTIONAL_014.md` | confirmed | 回答前 sufficient context / answerability gate の preserve 対象。 |
| C-REQ-FR015 | 要件 | `REQ_FUNCTIONAL_015.md` | confirmed | 回答後 answer support verification の preserve 対象。 |
| C-REQ-FR019 | 要件 | `REQ_FUNCTIONAL_019.md` | confirmed | benchmark の refusal / citation / unsupported 指標の preserve 対象。 |
| C-IMPL-TYPES | 実装 | `apps/api/src/types.ts` | confirmed | 現行 `DocumentManifest`, `VectorMetadata`, `DocumentLifecycleStatus` の型。 |
| C-IMPL-INGEST | 実装 | `apps/api/src/rag/memorag-service.ts` | confirmed | ingest 時 metadata 保存、filterable vector metadata、document list filtering。 |
| C-IMPL-SEARCH | 実装 | `apps/api/src/search/hybrid-search.ts` | confirmed | lexical / semantic / RRF / adaptive filtering / manifest ACL 再確認。 |
| C-IMPL-MEMORY | 実装 | `apps/api/src/agent/nodes/retrieve-memory.ts`, `search-evidence.ts` | confirmed | memory hit と memory source chunk の manifest / ACL / lifecycle 再確認。 |
| C-IMPL-GATES | 実装 | `apps/api/src/agent/nodes/*gate*.ts`, `validate-citations.ts`, `verify-answer-support.ts` | confirmed | minScore、sufficient context、citation validation、answer support の現行挙動。 |
| C-IMPL-METADATA-BUDGET | 実装 | `apps/api/src/adapters/s3-vectors-store.ts` | confirmed | S3 Vectors filterable metadata 2,048 bytes 制限。 |
| C-BENCH-CHATRAG | benchmark / tests | `benchmark/chatrag-bench.ts`, `benchmark/datasets/conversation/chatrag-bench-v1.jsonl`, `apps/api/src/agent/graph.test.ts` | confirmed | ChatRAG follow-up / refusal contamination 回帰期待値。 |

## Spec Requirements Summary

| 章 / AC | 要求 summary | 後続実装への入力 |
| --- | --- | --- |
| 3B.1 | `active` と `ragEligible` を分離し、RAG対象を search scope、resource permission、active、品質状態、検証状態、鮮度、抽出品質の積集合にする。 | `DocumentQualityProfile` と検索時 quality gate を document / chunk / memory の全経路に接続する。 |
| 3B.2 | `KnowledgeQualityStatus`, `VerificationStatus`, `FreshnessStatus`, `SupersessionStatus`, `ExtractionQualityStatus`, `DocumentQualityProfile`, `QualityFlag` を管理する。 | 現行 `DocumentManifest.metadata` の任意 metadata ではなく、型付き保存・表示・監査対象を定義する。 |
| 3B.3 | expired / superseded / rejected は通常回答の根拠にしない。stale / unverified は policy により警告付きまたは answer_unavailable。 | 通常 RAG と過去情報モードの境界を分ける。最初の Phase C では通常 RAG の除外条件を優先する。 |
| 3B.4 | `RagEligibilityPolicy` は tenant / folder / document / benchmark scope で品質状態を許可する。判定順は active -> ragEligibility -> verification -> freshness -> supersession -> extraction -> confidence -> citation。 | policy scope の source of truth と継承順位が必要。benchmark scope は既存 benchmark seed isolation と衝突しないようにする。 |
| AC-KQ-012 | 品質ステータス変更は embedding 再計算なしで検索時に即時反映する。 | vector の filterable metadata だけに依存すると既存 vector の metadata 更新が必要になる。manifest / quality profile の検索後再確認が必要。 |
| AC-KQ-015 | 権限のない文書が品質ポリシーで除外された場合でも、存在を示唆しない。 | ACL / quality の順序と user-facing debug sanitize を維持する。 |
| 4A.10 / 21 | authorized and quality-approved evidence のみ LLM、citation、computedFacts、answer support、debug trace に渡す。 | document chunk、memory card、previous citation anchor、computed fact のすべてで quality-approved を不変条件にする。 |

## confirmed

| ID | 現行で確認できた事実 | 根拠 | 仕様 3B との差分 |
| --- | --- | --- | --- |
| C-CONF-001 | `DocumentLifecycleStatus` は `active / staging / superseded` のみで、3B の `verificationStatus`、`freshnessStatus`、`supersessionStatus`、`extractionQualityStatus`、`ragEligibility` 型は document store の正規型にない。 | `apps/api/src/types.ts` | `AC-KQ-001` 未充足。 |
| C-CONF-002 | `DocumentManifest.metadata` と `VectorMetadata` は任意 metadata として `domainPolicy`、`ragPolicy`、`answerPolicy` を保持できるが、3B の品質状態を解釈する filter / policy はない。 | `apps/api/src/types.ts`, `apps/api/src/rag/memorag-service.ts` | 品質 profile は保存できても、RAG利用可否としては未実装。 |
| C-CONF-003 | document list と lexical index は manifest の `lifecycleStatus` が active のものに絞り、`scopeType=chat` を通常 document list から除外する。 | `MemoRagService.listDocuments`, `getLexicalIndex` | active gate はあるが quality gate はない。 |
| C-CONF-004 | semantic vector hit は S3 / local vector store で候補取得後、manifest を読み直して active、manifest ACL、search scope を再確認する。 | `filterAccessibleVectorHits` | `AC-KQ-012` の「検索時即時反映」に使える設計点。ただし品質 profile 再確認は未接続。 |
| C-CONF-005 | memory hit も manifest active、manifest ACL、search scope を再確認する。 | `retrieve-memory.ts` | memory summary を quality-approved にする gate は未接続。 |
| C-CONF-006 | `minScore` は request / runtime policy で正規化され、rerank 後の `selectedChunks` と answerability gate の top score 判定で使われる。 | `runtime-policy.ts`, `rerank-chunks.ts`, `answerability-gate.ts` | 品質 gate 追加時も score gate を迂回してはいけない。 |
| C-CONF-007 | `searchRag` は lexical / semantic を RRF で融合し、adaptive retrieval 有効時は combined score floor と effectiveTopK を診断に出す。 | `hybrid-search.ts` | quality filter 追加時も diagnostics と benchmark 解釈を壊さない必要がある。 |
| C-CONF-008 | citation validation は `usedChunkIds` または selected chunks から citation を作り、`strictGrounded` で citation / computed fact なし回答を拒否する。 | `validate-citations.ts` | quality gate 通過前の chunk を citation にしてはいけない。 |
| C-CONF-009 | answer support verifier は cited chunks と computed facts に基づき、unsupported sentence が残る場合は repair を試し、失敗時は `unsupported_answer` として拒否する。 | `verify-answer-support.ts`, `FR-015` | 3B 実装後も quality-approved evidence のみに対して検証する必要がある。 |
| C-CONF-010 | S3 Vectors の filterable metadata は `text` を除いて 2,048 bytes を超えると put 時に失敗する。 | `s3-vectors-store.ts` | `DocumentQualityProfile` 全体を vector metadata に載せる設計は危険。 |
| C-CONF-011 | ChatRAG Bench sample は multi-turn の coreference / topic continuation で期待語句と期待ファイルを評価する。API graph test は VPN follow-up で refusal text が rewrite に混入しないこと、1 search action、`chatrag_sample_it.md` citation を確認する。 | `benchmark/dataset.chatrag-bench.sample.jsonl`, `benchmark/datasets/conversation/chatrag-bench-v1.jsonl`, `apps/api/src/agent/graph.test.ts` | quality gate 追加で ChatRAG follow-up が過剰 refusal にならないよう preserve が必要。 |
| C-CONF-012 | benchmark metrics は refusal precision / recall、unsupported sentence rate、citation hit、expected file / page hit を既存評価軸として持つ。 | `REQ_FUNCTIONAL_019.md`, `benchmark/run.test.ts` | 3B の品質起因 answer_unavailable は既存 refusal / support 指標と接続して評価する。 |

## inferred

| ID | 推定 | 根拠 | 後続確認 |
| --- | --- | --- | --- |
| C-INF-001 | Phase C の最小実装は、vector prefilter より manifest / quality profile 再確認を優先した方が安全。 | 共有解除と lifecycle は manifest 再確認で即時反映しており、metadata budget も小さい。 | query latency と manifest read 数を benchmark で確認する。 |
| C-INF-002 | `ragPolicy` / `answerPolicy` は将来の品質 policy に流用できるが、3B の正規 field として扱うには名前・値域が不足する。 | `VectorMetadata` に文字列 field はあるが、3B の enum とは一致しない。 | 互換 alias にするか、新規 `qualityProfileId` / `ragEligibility` を追加するか決める。 |
| C-INF-003 | `superseded` の意味は現行 lifecycle と 3B `SupersessionStatus` で重なるが、現行は reindex cutover lifecycle、3B は知識の版管理であり同一視しない方が安全。 | `DocumentLifecycleStatus` と 3B `SupersessionStatus` の用途が異なる。 | migration lifecycle と知識版管理の field 分離を設計する。 |
| C-INF-004 | stale / unverified の警告付き回答は UI / API response に quality warning を追加するまで実装完了扱いにできない。 | 3B.5 / AC-KQ-016 は citation 付近の注意表示を要求する。 | `ChatResponse` / citation schema への warning 表現を J1/F と調整する。 |

## preserve

| ID | 踏襲すべき既存挙動 | 根拠 | Phase C での扱い |
| --- | --- | --- | --- |
| C-PRESERVE-001 | `minScore` は rerank 後の final context selection と answerability gate の両方で効かせ、低 score の推測回答を避ける。 | `rerank-chunks.ts`, `answerability-gate.ts` | quality gate は minScore の代替ではなく追加条件にする。 |
| C-PRESERVE-002 | lexical / semantic / RRF / adaptive retrieval の diagnostics を維持する。 | `hybrid-search.ts`, `docs/LOCAL_VERIFICATION.md` | quality filter 後の件数や除外理由は追加しても、既存 metric 名を壊さない。 |
| C-PRESERVE-003 | manifest / document group ACL / search scope の再確認を semantic vector hit と memory hit の両方で維持する。 | `filterAccessibleVectorHits`, `filterAccessibleMemoryHits` | quality gate 追加時も ACL 再確認を省略しない。 |
| C-PRESERVE-004 | `citation` は selected chunk または computed fact 由来に限定し、`strictGrounded` で citation なし回答を拒否する。 | `validate-citations.ts` | quality-excluded chunk を citation に含めない。 |
| C-PRESERVE-005 | answer support verification は unsupported answer を返さず、repair 不可なら拒否する。 | `verify-answer-support.ts`, `FR-015` | quality warning 付き回答でも support verifier を必ず通す。 |
| C-PRESERVE-006 | sufficient context gate は primary fact が根拠で支持されている `PARTIAL` を過剰 refusal にせず、primary missing / conflict は拒否する。 | `sufficient-context-gate.ts`, `FR-014` | stale / unverified の policy 追加で primary evidence の扱いを壊さない。 |
| C-PRESERVE-007 | ChatRAG follow-up は previous citation を anchor にできるが、拒否文の contamination を query rewrite に入れない。 | `build-conversation-state.ts`, `apps/api/src/agent/graph.test.ts` | previous citation は品質・権限・score gate を省略する理由にしない。 |
| C-PRESERVE-008 | ChatRAG Bench / conversation benchmark の expectedContains、expectedFiles、expectedResponseType、refusal precision / recall を維持する。 | `benchmark/chatrag-bench.ts`, `benchmark/metrics/conversation.ts`, `benchmark/run.test.ts` | 3B quality refusal を追加する場合も既存 refusal benchmark を再評価する。 |
| C-PRESERVE-009 | benchmark seed corpus isolation は `source=benchmark-runner`、`docType=benchmark-corpus`、`benchmarkSuiteId`、`aclGroups: [\"BENCHMARK_RUNNER\"]` を維持する。 | `docs/LOCAL_VERIFICATION.md`, `apps/api/src/agent/graph.test.ts` | quality policy の benchmark scope は seed isolation を弱めない。 |
| C-PRESERVE-010 | S3 Vectors filterable metadata 2,048 bytes budget を維持し、長い品質 profile や warning 配列を vector metadata に入れない。 | `s3-vectors-store.ts` | filterable metadata は小さい enum / id / coarse flag に限定する。 |
| C-PRESERVE-011 | user-facing trace / UI に権限外文書や内部 policy 詳細を出さない。 | 仕様 4A.10 / 21、現行 ACL 再確認 | quality exclusion count は operator_sanitized 以上の扱いを設計するまで一般表示しない。 |

## Gap Matrix

| Gap ID | 状態 | 内容 | 後続対応 |
| --- | --- | --- | --- |
| C-GAP-001 | confirmed | `DocumentQualityProfile` と 3B の品質 enum が正規型・store にない。 | document manifest metadata への暫定保存ではなく、型付き profile と更新 API / store を設計する。 |
| C-GAP-002 | confirmed | `ragEligibility = excluded` を RAG 検索対象から外す filter がない。 | lexical index、semantic hit 再確認、memory hit、memory source expansion に同じ quality gate を入れる。 |
| C-GAP-003 | confirmed | freshness / verification / supersession / extraction quality / confidence による通常 RAG 除外がない。 | 通常 RAG の hard exclude と warning allowed を policy として定義する。 |
| C-GAP-004 | confirmed | 品質ステータス変更を embedding 再計算なしで即時反映する update path がない。 | vector metadata 更新に依存せず、manifest / quality profile lookup を検索時 gate にする。必要なら cache invalidation を設計する。 |
| C-GAP-005 | confirmed | `AC-KQ-013/014` の品質変更監査ログがない。 | audit log store / admin operations との接続は J3/14 と調整する。 |
| C-GAP-006 | confirmed | quality warning を API response / citation / UI に出す schema がない。 | warning 付き回答の最小 schema を F/J1 と調整する。 |
| C-GAP-007 | confirmed | quality-related answer_unavailable から benchmark case / support ticket を作る loop は未整備。 | 7B / 9B / H / I に接続する planning gap として残す。 |
| C-GAP-008 | inferred | lifecycle `superseded` と 3B `SupersessionStatus.superseded` を混同すると reindex cutover と知識版管理が衝突する。 | field 名と migration lifecycle の責務を分ける。 |
| C-GAP-009 | confirmed | operator 向け quality debug と user-facing sanitize tier が未接続。 | J2 の debug 4 tier と合わせて、quality exclusion reason の表示範囲を決める。 |
| C-GAP-010 | confirmed | metadata budget の制約により、品質 profile をそのまま S3 Vectors filterable metadata に入れられない。 | vector metadata は `qualityProfileId`、`ragEligibility` など最小値に限定し、詳細は store lookup にする。 |

## Phase C Implementation Input

後続 Phase C は、次を最小実装単位にする。

1. `DocumentQualityProfile` と 3B enum を型として追加し、既存 `DocumentManifest.lifecycleStatus` と分離する。
2. quality profile の保存場所を決め、documentId から検索時に参照できるようにする。
3. `RagEligibilityPolicy` の最小 default を定義する。初期値は通常 RAG で `eligible` のみ許可し、`eligible_with_warning` は API / UI warning が整ってから有効化する。
4. lexical index 作成、semantic vector hit 再確認、memory hit、memory source chunk expansion に同じ quality gate を通す。
5. quality gate は ACL / search scope / active lifecycle を弱めず、quality-excluded の存在を user-facing response に出さない。
6. `minScore`、sufficient context、citation validation、answer support verification を既存通り通す。
7. S3 Vectors filterable metadata は 2,048 bytes budget を守り、詳細 profile を載せない。
8. ChatRAG follow-up / refusal benchmark、answer support、citation hit、unsupported sentence、refusal precision / recall を targeted regression として実行する。
9. 品質変更監査、管理画面、support ticket、quality benchmark case 作成は Phase C の最小範囲に含めるか、H/I/J2/J3 に分割するかを PR で明記する。

## Open Questions

| ID | 種別 | 内容 | 次の判断 |
| --- | --- | --- | --- |
| C-OQ-001 | open_question | `DocumentQualityProfile` の source of truth は manifest metadata、別 object store ledger、DynamoDB item、document group store 拡張のどれか。 | embedding 再計算なし即時反映と query latency を比較して決める。 |
| C-OQ-002 | open_question | `eligible_with_warning` を初回から回答に使うか、UI / API warning schema 完成まで除外扱いにするか。 | `AC-KQ-016` を満たせる表示面の有無で判断する。 |
| C-OQ-003 | open_question | 高リスクカテゴリの source は folder metadata、document metadata、tenant policy、benchmark row metadata のどれか。 | policy scope 優先順位を設計する。 |
| C-OQ-004 | open_question | stale / historical 文書を「過去情報モード」で使う UX / API parameter を Phase C に含めるか。 | 通常 RAG の hard exclude と過去情報検索を別 feature として分ける。 |
| C-OQ-005 | open_question | quality exclusion diagnostics を debug trace のどの tier で出すか。 | J2 の debug sanitize policy と整合させる。 |
| C-OQ-006 | open_question | benchmark corpus に quality profile を付ける場合、`benchmark` scope policy は通常利用者の document list / chat retrieval とどう分離するか。 | 既存 benchmark seed isolation を維持する前提で I と調整する。 |

## Targeted Validation For Phase C

| 検証 | 目的 |
| --- | --- |
| `npm exec -w @memorag-mvp/api -- tsx --test src/agent/graph.test.ts` | ChatRAG follow-up、minScore refusal、citation / answer support の回帰確認。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/agent/nodes/node-units.test.ts` | answerability / citation / support node の境界確認。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/rag/memorag-service.test.ts` | document store、debug trace、chat response の回帰確認。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/adapters/s3-vectors-store.test.ts` | metadata budget と vector filter 互換確認。 |
| `npm exec -w @memorag-mvp/benchmark -- tsx --test run.test.ts conversation.test.ts conversation-run.test.ts` | refusal precision / recall、ChatRAG multi-turn、citation 指標の回帰確認。 |
| `task benchmark:sample` または targeted ChatRAG benchmark | quality gate 追加後の over-refusal / citation hit / unsupported rate 確認。 |
| `git diff --check` | whitespace / conflict marker 確認。 |
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` | spec-recovery 変更時の検証。C-pre では spec-recovery 未変更でも実行して記録する。 |
