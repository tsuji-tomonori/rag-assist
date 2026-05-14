# Phase H Gap: support ticket and search improvement loop

- ファイル: `docs/spec/gap-phase-h.md`
- 種別: `SPEC_GAP`
- 作成日: 2026-05-14
- 状態: Draft
- 対象 task: `H-pre-gap`
- 後続 task: `H-support-search-improvement`

## Scope

Phase H は、仕様 7「問い合わせ対応」、7A「回答不能・担当者対応の詳細」、7B「品質起因の担当者対応・改善ループ」、8「検索改善」を対象にする。

この gap 調査ではコード変更を行わず、現行 `question-routes`、チャット回答不能、低評価、品質起因の問い合わせ、検索改善 alias 管理 API の差分、踏襲すべき既存挙動、後続実装の scope / scope-out を整理する。

## Input Inventory

| ID | 種別 | 対象 | 確度 | 用途 |
| --- | --- | --- | --- | --- |
| H-SPEC-7 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 7 | confirmed | SupportTicket、担当者画面、SLA、検索改善候補、監査の要求。 |
| H-SPEC-7A | 仕様 | `docs/spec/2026-chapter-spec.md` 章 7A | confirmed | answer_unavailable 起点、sanitized diagnostics、SupportDraftAnswer、改善 loop の要求。 |
| H-SPEC-7B | 仕様 | `docs/spec/2026-chapter-spec.md` 章 7B | confirmed | 品質起因問い合わせと文書検証 / 再解析 / RAG除外への接続要求。 |
| H-SPEC-8 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 8 | confirmed | 検索改善候補、review / publish、UI 上 alias 非露出、閲覧権限非拡張の要求。 |
| H-MAP | 仕様 map | `docs/spec/CHAPTER_TO_REQ_MAP.md` 7 / 7A / 7B / 8 行 | confirmed | 章別仕様と既存 REQ / 実装の対応状態。 |
| H-IMPL-QUESTION-ROUTES | 実装 | `apps/api/src/routes/question-routes.ts` | confirmed | `/questions` の作成、一覧、詳細、回答、解決、requester 境界。 |
| H-IMPL-QUESTION-STORE | 実装 | `apps/api/src/adapters/*question-store.ts`, `apps/api/src/types.ts`, `apps/api/src/schemas.ts` | confirmed | 現行 `HumanQuestion` の保存項目と status。 |
| H-IMPL-CHAT | 実装 | `apps/api/src/chat-orchestration/`, `apps/api/src/rag/memorag-service.ts` | confirmed | 回答不能分岐、debug trace、chat run 保存。 |
| H-IMPL-ALIAS | 実装 | `apps/api/src/routes/admin-routes.ts`, `apps/api/src/rag/memorag-service.ts`, `apps/api/src/search/alias-artifacts.ts` | confirmed | alias draft / review / disable / publish / audit log と artifact。 |
| H-IMPL-SECURITY | 実装 | `apps/api/src/security/access-control-policy.test.ts`, `apps/api/src/authorization.ts` | confirmed | question route の静的 policy と route-level permission。 |
| H-SPEC-RECOVERY | 復元仕様 | `docs/spec-recovery/03_acceptance_criteria.md`, `07_specifications.md`, `08_traceability_matrix.md`, `09_gap_analysis.md` | confirmed | 既存 QA / search / debug / security traceability。 |

## Spec Requirements Summary

| 章 / AC | 要求 summary | 後続実装への入力 |
| --- | --- | --- |
| 7 / AC-SUPPORT-* | SupportTicket は低評価、answer_unavailable、手動エスカレーションから作成され、担当者、SLA、状態、対応履歴、検索改善候補へつながる。 | `HumanQuestion` 互換を保ちながら `SupportTicket` 相当の source / assignee / status / audit / resolution fields を拡張する。 |
| 7A / AC-UNANSWERABLE-* | 回答不能は推測回答を避ける正常分岐で、messageId / ragRunId / answerUnavailableEventId と sanitized diagnostics から担当者対応へ送れる。 | chat response の回答不能結果から `/questions` へ安全に ticket 化する API / UI / trace reference を追加する。 |
| 7A | 担当者に渡す情報は元質問、AI回答または回答不能メッセージ、権限内 citation、sanitized diagnostics に限定し、権限外文書名・件数・内部 policy は渡さない。 | `support_sanitized` 相当の診断 payload と requester / assignee / operator の表示 tier を分ける。 |
| 7B / AC-SUPPORT-KQ-* | 品質起因の回答不能や低評価は、検索改善だけでなく文書検証、文書オーナー確認、再解析、RAG除外、benchmark case へ接続する。 | Phase C/E の quality profile / extraction warning を SupportTicket の品質分類と改善 action に接続する。 |
| 8 / AC-SEARCHIMP-* | AI は検索改善候補を作れるが自動公開しない。人間 review / publish、検索結果差分、理由入力、監査、UI 上 alias 非露出が必要。 | 現行 alias 管理 API を検索改善 UI / terminology / AI suggest queue / diff test / publish reason と接続する。 |
| 8 | 検索改善ルールはユーザーの閲覧権限を拡張しない。 | alias expansion は検索語の拡張に限定し、ACL / document group / quality gate / search scope を迂回しない。 |

## confirmed

| ID | 現行で確認できた事実 | 根拠 | 仕様との差分 |
| --- | --- | --- | --- |
| H-CONF-001 | `/questions` は `POST /questions`、`GET /questions`、`GET /questions/{questionId}`、`POST /questions/{questionId}/answer`、`POST /questions/{questionId}/resolve` を持つ。 | `apps/api/src/routes/question-routes.ts` | 仕様 7 の担当者対応の最小 API はある。 |
| H-CONF-002 | 問い合わせ作成時は authenticated user の `userId` を `requesterUserId` として保存し、本人詳細では `internalMemo` を削除して返す。 | `MemoRagService.createQuestion`, `requesterVisibleQuestion` | requester 境界と内部メモ非公開は充足。 |
| H-CONF-003 | 担当者一覧は `answer:edit`、回答登録は `answer:publish`、本人詳細 / 本人解決は requesterOrPermission の route metadata を持つ。 | `question-routes.ts`, `access-control-policy.test.ts` | 仕様 7.4 の専用権限名とは異なるが、現行 permission model で境界はある。 |
| H-CONF-004 | `HumanQuestion` は `sourceQuestion`、`chatAnswer`、`chatRunId`、`category`、`priority`、`answerBody`、`internalMemo`、`resolvedAt` を持つ。 | `apps/api/src/types.ts`, `apps/api/src/schemas.ts` | SupportTicket の一部に近いが、`source`、`messageId`、`ragRunId`、`answerUnavailableEventId`、`sanitizedDiagnostics`、`assigneeUserId` はない。 |
| H-CONF-005 | 回答不能分岐は chat orchestration の `finalize_refusal` で通常回答と分離され、debug trace は object store に保存される。 | `apps/api/src/chat-orchestration/graph.ts`, `apps/api/src/chat-orchestration/nodes/finalize-refusal.ts` | 回答不能 event から SupportTicket を自動 / 半自動作成する接続はない。 |
| H-CONF-006 | Debug trace の一覧・詳細・download は `chat:admin:read_all` を要求し、OpenAPI metadata では `debug.trace.read.sanitized` / `debug.trace.export` として記録される。 | `apps/api/src/routes/debug-routes.ts` | 仕様 7A/14A の support_sanitized tier は未実装。担当者向けに限定した trace view はない。 |
| H-CONF-007 | alias 管理 API は draft 作成、更新、review、disable、approved alias の publish、audit log を持つ。 | `apps/api/src/routes/admin-routes.ts`, `MemoRagService.createAlias` ほか | 仕様 8 の人間 review / publish / audit の中核は部分充足。 |
| H-CONF-008 | publish 済み alias artifact は object store に保存され、通常 response では `aliasVersion` のような opaque value を扱う方針が docs にある。 | `MemoRagService.publishAliases`, `docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md`, `docs/3_設計_DES/41_API_API/DES_API_001.md` | 通常 response で alias 本文や ACL metadata を出さない方針は踏襲対象。 |
| H-CONF-009 | admin alias API と code / CSS は内部的に `alias` 名を使う。 | `apps/api/src/routes/admin-routes.ts`, `apps/web/src/styles/features/admin.css` | 仕様 8 の「UI 上 alias 非露出」は product UI 文言での適用が必要。内部 API/path/class 名の即時 rename は scope 外。 |
| H-CONF-010 | Phase C により quality profile / quality gate の最小型と通常 RAG 除外が入り、Phase E により extraction warnings / confidence foundation が入っている。 | `docs/spec/gap-phase-c.md`, `docs/spec/gap-phase-e.md` | 7B の品質起因 SupportTicket / 改善 action 接続は未実装。 |

## partially covered

| ID | 部分充足している仕様 | 現状 | 残差分 |
| --- | --- | --- | --- |
| H-PART-001 | SupportTicket 作成 / 回答 / 解決 | `HumanQuestion` と `/questions` で manual follow-up を作成し、担当者回答と本人解決ができる。 | source 種別、SLA、assignee user/group、in_progress / waiting 系 status、resolutionSummary 必須、対応履歴監査がない。 |
| H-PART-002 | 回答不能からの問い合わせ導線 | `sourceQuestion` / `chatAnswer` / `chatRunId` は payload として保存できる。 | answer_unavailable event、messageId、ragRunId、sanitized diagnostics、低評価からの ticket 化は schema / route / UI とも未接続。 |
| H-PART-003 | 担当者向け機微情報制御 | requester 本人には `internalMemo` を返さない。別通常ユーザーには 404 を返す。 | 担当者自身の割当 ticket / team assignment 境界、support_sanitized trace、文書遷移時の resource permission 再確認は未整備。 |
| H-PART-004 | 検索改善の human review / publish | alias API は review と publish を分け、publish 時に audit log を残す。 | AI suggest queue、検索結果差分 test、差戻し理由必須、UI 用語「検索語対応づけ」、公開前影響範囲確認が不足。 |
| H-PART-005 | 検索改善の権限非拡張 | alias は検索制御データとして document metadata と分離する docs がある。 | runtime alias expansion が実際に ACL / quality / search scope を弱めないことを後続 test で固定する必要がある。 |
| H-PART-006 | 品質起因回答不能の foundation | Phase C/E が quality gate と extraction warning を提供する。 | SupportTicketQualityCategory、文書検証依頼、文書オーナー確認、RAG除外、再解析依頼、benchmark case 登録への接続がない。 |

## missing

| ID | 未実装 / 未整備 | 根拠 | 後続対応 |
| --- | --- | --- | --- |
| H-GAP-001 | `SupportTicket` 正規モデルと既存 `HumanQuestion` の互換 migration 方針。 | `HumanQuestion` は source / messageId / diagnostics / assignee user/group を持たない。 | 既存 API response 互換を維持し、拡張 field は optional から追加する。 |
| H-GAP-002 | 低評価から SupportTicket を作る API / UI / event。 | 低評価 payload / feedback route が確認できない。 | chat UI の feedback action と ticket create を接続する。 |
| H-GAP-003 | answer_unavailable event と SupportTicket の `ragRunId` / `messageId` / `answerUnavailableEventId` 接続。 | chat orchestration trace は保存されるが ticket schema に event id がない。 | refusal finalization 後の user action で event reference を ticket に渡す。 |
| H-GAP-004 | 担当者向け `sanitizedDiagnostics` / support_sanitized trace tier。 | debug route は admin `chat:admin:read_all` のみ。 | `support_sanitized` payload は問い合わせ化された範囲に限定し、権限外文書名・件数・内部 policy を含めない。 |
| H-GAP-005 | assignee user / group、SLA、in_progress / waiting status、resolutionSummary 必須、担当変更履歴。 | `QuestionStatus` は現行 `open / answered / resolved` 系に留まる。 | state transition と監査 log を追加する。 |
| H-GAP-006 | 問い合わせから検索改善候補、文書検証、再解析、RAG除外、benchmark case へ遷移する action。 | `/questions` は create/list/get/answer/resolve のみ。 | H は検索改善候補作成を優先し、品質改善 action は scope-out または後続分割を明記する。 |
| H-GAP-007 | AI suggest による検索改善候補生成。 | alias API は人間作成の draft に近く、AI candidate queue がない。 | AI は candidate を `pending_review` 相当で作成するだけにし、自動 publish は禁止する。 |
| H-GAP-008 | 検索結果差分 test と publish reason / rollback 連携。 | alias publish API は approved alias をまとめて publish するが diff test / reason は route contract にない。 | publish 前 preview と reason input を追加する。 |
| H-GAP-009 | UI 上 alias 非露出の検証。 | code / API は alias 名を使う。product UI の文言監査が必要。 | UI ラベルでは「検索改善」「検索語対応づけ」を使い、内部 identifier は互換維持する。 |

## divergent

| ID | 乖離 | 内容 | 扱い |
| --- | --- | --- | --- |
| H-DIV-001 | SupportTicket vs HumanQuestion | 章別仕様は SupportTicket / SupportDraftAnswer / SupportTicketQualityCategory を要求するが、現実装は `HumanQuestion` と `QuestionStore` が中心。 | 後続 H は既存 endpoint と type を壊さず、互換 alias / optional field 追加で段階移行する。 |
| H-DIV-002 | 仕様 permission 名 vs 現行 permission 名 | 仕様は `support:ticket:*` / `search_improvement:*`、現行は `chat:create` / `answer:edit` / `answer:publish` / `rag:alias:*`。 | Phase B の 3 層認可方針に従い、route metadata の operationKey は仕様寄せ、実権限は互換維持または alias mapping を明記する。 |
| H-DIV-003 | search improvement UI 用語 | 仕様は UI に alias を出さないが、現行 API path / type / CSS は alias を使う。 | Product UI 文言を優先して変更し、API path rename は互換破壊のため scope-out。 |
| H-DIV-004 | debug trace visibility | 仕様は `user_safe / support_sanitized / operator_sanitized / internal_restricted` を想定するが、現行 debug route は admin 中心。 | H では support_sanitized payload の最小 data contract を定義し、広い trace tier 実装は J2 と調整する。 |

## Preserve Existing Behavior

| ID | 踏襲すべき既存挙動 | 根拠 | H での扱い |
| --- | --- | --- | --- |
| H-PRESERVE-001 | requester 本人以外の通常ユーザーには問い合わせ詳細の存在を示唆せず 404 を返す。 | `question-routes.ts` | SupportTicket 拡張後も owner mismatch は generic not found を維持する。 |
| H-PRESERVE-002 | requester 本人向け response から `internalMemo` を削除する。 | `requesterVisibleQuestion` | `sanitizedDiagnostics` 追加時も本人向けと担当者向け payload を分ける。 |
| H-PRESERVE-003 | 担当者一覧 / 回答 / 解決は `answer:edit` / `answer:publish` 以上に閉じる。 | `question-routes.ts`, `access-control-policy.test.ts` | 新規 route 追加時は access-control static policy を更新する。 |
| H-PRESERVE-004 | 回答不能時は推測回答に倒さず refusal / answer_unavailable として扱う。 | `finalize-refusal.ts`, `REQ-RAG-002` | ticket 作成は回答不能を覆す処理ではなく、後続 human follow-up として分離する。 |
| H-PRESERVE-005 | debug trace / diagnostics は raw prompt、権限外文書、ACL group、内部 policy を通常 response に出さない。 | `SPEC-DBG-001`, `SPEC-SEC-003` | support_sanitized でも権限外文書名・件数・内部 policy は出さない。 |
| H-PRESERVE-006 | alias / ACL metadata は通常検索 response に出さず、`aliasVersion` は opaque value とする。 | `DES_DATA_001`, `DES_API_001`, `NFR-012` | 検索改善実装で AI candidate や trace に alias 本文を不用意に露出しない。 |
| H-PRESERVE-007 | alias review / publish は human approval を必須とし、AI が直接 publish しない。 | `admin-routes.ts`, 仕様 8 | AI suggest は draft / pending review までに限定する。 |
| H-PRESERVE-008 | 検索改善は ACL / resource permission / quality gate / search scope を拡張しない。 | 仕様 8、Phase B/C | alias expansion は query expansion に限定し、document filtering は既存順序を維持する。 |

## H-support-search-improvement Scope

後続 `H-support-search-improvement` の最小 scope は次とする。

1. 既存 `/questions` と `HumanQuestion` 互換を保ち、SupportTicket 相当の optional fields を追加する。
2. `source` を `negative_feedback / answer_unavailable / manual_escalation` として保存できるようにする。
3. `chatRunId` に加えて `messageId`、`ragRunId` または trace reference、`answerUnavailableReason`、`sanitizedDiagnostics` を問い合わせへ紐付けられるようにする。
4. `sanitizedDiagnostics` は `support_sanitized` 相当の allowlist とし、権限外文書名、権限外件数、ACL group、内部 policy、raw prompt、LLM の内部推論を含めない。
5. requester 本人、担当者、管理者の read surface を分け、既存 `internalMemo` 非公開と generic 404 を維持する。
6. 低評価または回答不能から検索改善候補を作成できる API / service を追加する。ただし候補は human review 待ちに留める。
7. 現行 alias draft / review / publish / audit を検索改善の内部 artifact として活用し、UI 文言では「alias」ではなく「検索改善」「検索語対応づけ」を使う。
8. 検索改善候補の publish 前に、検索結果差分、影響範囲、理由入力を記録できる形にする。
9. route 追加 / permission 変更がある場合は `apps/api/src/security/access-control-policy.test.ts` と API contract / OpenAPI docs を同時更新する。
10. Phase C/E の quality warning を使う場合は、品質起因 ticket を検索改善だけに閉じず、文書検証・再解析・RAG除外の後続 action へ分岐できる形にする。

## H-support-search-improvement Scope-out

| ID | scope-out | 理由 / 委譲先 |
| --- | --- | --- |
| H-OUT-001 | `/admin/aliases` API path / persisted alias artifact の全面 rename。 | 互換破壊が大きい。H は product UI 文言と docs 上の「検索語対応づけ」へ寄せる。 |
| H-OUT-002 | 全面的な debug trace 4 tier 実装。 | J2 / 14A と調整が必要。H は ticket 用 sanitized diagnostics の最小 allowlist を扱う。 |
| H-OUT-003 | SLA 通知、通知基盤、外部 ticket system 連携。 | support workflow 拡張として別 task。 |
| H-OUT-004 | 品質改善 action の全実装。 | 文書検証、再解析、RAG除外、benchmark case 登録は C/E/I/J と分割する。 |
| H-OUT-005 | 検索改善ルールの runtime 適用方式の全面刷新。 | H は候補・review・publish・非露出・権限境界を優先し、retriever の大幅変更は F/I と調整する。 |
| H-OUT-006 | UI 全体の問い合わせ / 検索改善画面刷新。 | API / data contract 確定後の Web task に送る。 |

## Open Questions

| ID | 種別 | 内容 | 次の判断 |
| --- | --- | --- | --- |
| H-OQ-001 | open_question | `HumanQuestion` を残したまま `SupportTicket` 名へ寄せるか、API response は `QuestionSchema` 互換で内部だけ SupportTicket と呼ぶか。 | 既存 Web / contract 互換を確認して決める。 |
| H-OQ-002 | open_question | `answerUnavailableEventId` の source of truth を chat message id、debug trace step id、専用 event store のどれにするか。 | chat run event stream / debug trace 保存粒度と合わせる。 |
| H-OQ-003 | open_question | support_sanitized diagnostics に chunk preview を含めるか、citation metadata だけにするか。 | 権限外推測リスクと担当者調査効率を比較する。 |
| H-OQ-004 | open_question | AI suggest の候補生成は chat orchestration tool に置くか、admin batch / benchmark failure analyzer に置くか。 | 低評価・問い合わせ・0件検索のイベント source を決める。 |
| H-OQ-005 | open_question | publish 前の検索結果差分 test を live index で実行するか、snapshot / benchmark subset で実行するか。 | latency、再現性、権限境界の検証方法を決める。 |

## Targeted Validation For H

| 検証 | 目的 |
| --- | --- |
| `npm exec -w @memorag-mvp/api -- tsx --test src/questions-access.test.ts` | requester / internalMemo / resolve 境界の回帰確認。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/security/access-control-policy.test.ts` | 新規 / 変更 route の route-level permission と question route 静的 policy 確認。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/contract/api-contract.test.ts` | Question / alias schema と OpenAPI contract の互換確認。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/chat-orchestration/graph.test.ts src/chat-orchestration/nodes/node-units.test.ts` | 回答不能 / trace / search diagnostics の回帰確認。 |
| `npm run test -w @memorag-mvp/api` | route / service / alias / RAG 変更が広い場合の API full test。 |
| `git diff --check` | whitespace / conflict marker 確認。 |
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` | spec-recovery 更新の構造確認。 |
