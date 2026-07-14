# Issue #345 chat・history・assignee journey 仕様復元分析

分析状態: confirmed_for_implementation

分析日: 2026-07-14 JST

対象 commit: `20756cf68e3362e21f0581341218b4feb54b3f07`

## Input inventory

| ID | Source | 日付 | 種別 | 信頼度 | 用途 |
| --- | --- | --- | --- | --- | --- |
| RPT-001 | GitHub Issue `#345` | 2026-07-13 | issue / completion criteria | confirmed | chat journey、responsive/a11y、traceability の目的と全体完了条件 |
| RPT-002 | `tasks/done/20260714-issue-345-chat-assignee-journey.md` | 2026-07-14 | task | confirmed | milestone scope と受け入れ条件 |
| RPT-003 | 関連する atomic FR / `SQ-016` / `DES_UI_UX_001` | current | canonical requirements/design | confirmed | actor、state、RAG quality、UI contract |
| RPT-004 | `apps/api/src/routes/chat-routes.ts`、`question-routes.ts`、history/favorite routes | current | runtime API | confirmed | server-authoritative state transition と request/response |
| RPT-005 | question/history/chat stores と access-control tests | current | runtime data/auth/test | confirmed | owner/assignee boundary、persistence、duplicate/late behavior |
| RPT-006 | `apps/web/src/features/chat/`、`history/`、`favorites/`、`questions/` | current | production UI/hooks | confirmed | visible state、next action、feedback、responsive behavior |
| RPT-007 | 対応する Web/API unit・integration・E2E test | current | executable evidence | confirmed | current verified behavior と未検証 edge case |
| RPT-008 | question escalation / answer notification / assignee UI の既存作業レポート | 2026-05 | work reports | confirmed（実施時点） | 実装意図、既知制約、過去の判断 |
| RPT-009 | `tools/web-inventory/ui-traceability.json` と generated web inventory | current | generated trace/inventory | confirmed | view→requirement→verification gap |

## Report facts

| ID | state | 事実 | 根拠 |
| --- | --- | --- | --- |
| FACT-001 | confirmed | requester は `POST /questions` と自分の `GET /questions/{id}` を利用でき、非 owner は存在を推測できない `404` になる。requester response から `internalMemo` と support diagnostics は除外される。 | RPT-004, RPT-005, `question-routes.ts`, `questions-access.test.ts` |
| FACT-002 | confirmed | answer-editor は `answer:edit` と assignee user/group の双方を満たす ticket だけを一覧・取得・回答でき、admin の read-all は server permission で分離される。 | RPT-004, RPT-005, `question-routes.test.ts`, access-control policy |
| FACT-003 | confirmed | chat response は `answer` / `refusal` / `clarification` と processing event、citation を持つが、完了 message 内に state と次操作を一貫表示する presenter はない。 | RPT-003, RPT-006, `AssistantAnswer.tsx`, `ProcessingAnswer.tsx` |
| FACT-004 | confirmed | question contract は `open` / `in_progress` / `waiting_requester` / `answered` / `resolved` を許可するが、assignee lane と history badge は中間 2 状態を網羅しない。 | RPT-004, RPT-006, `QuestionStatusSchema`, `assigneeLane`, `summarizeQuestionStatus` |
| FACT-005 | confirmed | API は create input と ticket に `messageId` を保持できるが、Web の `Message` と escalation input は送信していない。store create は毎回新しい UUID を採番するため、同じ message の再送を重複 ticket として作成し得る。 | RPT-004〜RPT-006, question stores, `QuestionEscalationPanel.tsx` |
| FACT-006 | confirmed | `useQuestions` は create/answer/resolve の例外を catch して `void` を返すため、呼出 component は失敗を判別できない。`AssigneeWorkspace` は失敗後も下書き保存時刻と clean state を設定し、false success を表示し得る。 | RPT-006, RPT-007, `useQuestions.ts`, `AssigneeWorkspace.tsx` |
| FACT-007 | confirmed | assignee の「下書き保存」は API/永続化を伴わない画面内 state だが、現行文言は「保存済み」と表示する。reload/画面再訪で復元されないことは過去レポートにも明記される。 | RPT-006, RPT-008 |
| FACT-008 | confirmed | chat と history は ticket ID 単位の targeted GET を 20 秒間隔で行い、通常利用者が担当者一覧を取得しない境界を維持する。 | RPT-006〜RPT-008, `useAppShellState.ts` |
| FACT-009 | confirmed | history は own-history API 境界と stable sort を持つが、badge は対象状態だけで次操作を説明せず、複数 ticket の中間状態を分類できない。favorites は shortcut 一覧であり conversation resume は本 task の直接 mutation 対象ではない。 | RPT-003, RPT-006, RPT-007 |
| FACT-010 | confirmed | shared `OperationOutcome` / `OperationFeedback` は success/failure/partial/unknown と target/evidence を表現できるため、新たな架空 status/API を作らず question mutation に適用できる。 | RPT-003, RPT-006 |
| FACT-011 | confirmed | `docs/spec-recovery/` と `scripts/validate_spec_recovery.py` は current tree に存在せず、`scripts/validate_docs.py` は `docs/spec-recovery` を legacy path として拒否する。分析は本レポートと canonical atomic REQ/DES/trace に記録する。 | repository filesystem, `scripts/validate_docs.py` |
| FACT-012 | confirmed | 実ブラウザ screen reader、200%/400% zoom、real-device は未検証であり、Issue 全体の manual evidence task に残る。自動テストを手動 evidence として扱えない。 | RPT-001〜RPT-003, `SQ-016`, `DES_UI_UX_001` |
| FACT-013 | conflict | 過去レポートは `answer:publish` actor が status を問わず resolve できる挙動を維持した一方、question journey は answered 後に resolved へ進む。今回 owner の answered-only 制約は維持し、publisher の追加 transition 制約は既存要求が明示しないため推定で変更しない。 | RPT-003, RPT-008, `question-routes.ts` |
| FACT-014 | open_question | push 通知 channel、SLA、永続下書き、screen-reader/device matrix は current API/確定要求にない。本 milestone では新設せず後続 task/運用判断へ残す。 | RPT-001〜RPT-003, RPT-008 |

## Candidate tasks

| ID | Actor | Intent | Observable outcome | Source |
| --- | --- | --- | --- | --- |
| TASK-JRN-001 | standard-user | RAG 実行結果を判断する | processing、answer/refusal、citation、clarification と次操作が該当 message 内で区別される | FACT-003 |
| TASK-JRN-002 | standard-user | 回答不能 ticket を一度だけ送信する | stable `messageId` により同じ owner/message の再送は同じ ticket を返し、対象付き outcome が表示される | FACT-005, FACT-010 |
| TASK-JRN-003 | answer-editor | 許可された ticket の状態と次操作を判断する | 5 status と割当状態が lane/detail で整合し、回答結果が対象 ID とともに表示される | FACT-002, FACT-004, FACT-006 |
| TASK-JRN-004 | standard-user | 担当者回答を履歴/チャットで追う | targeted polling が owner ticket だけを更新し、中間/回答/解決状態と次操作を item 内に示す | FACT-001, FACT-008, FACT-009 |
| TASK-JRN-005 | operator/tester | mutation failure を判別する | failure/timeout/duplicate/partial/late result を success と表示せず、対象を失わない | FACT-005, FACT-006, FACT-010 |
| TASK-JRN-006 | maintainer | 実装と仕様を同期する | atomic FR、UI design、trace manifest/generated inventory、API schema/test evidence が同じ journey を参照する | FACT-011 |

## Acceptance criteria

| ID | state | 検証可能条件 |
| --- | --- | --- |
| AC-JRN-001 | confirmed | processing 中は未完了として live status を示し、final 後は answer、refusal、clarification のいずれかを message target 内に表示する。 |
| AC-JRN-002 | confirmed | answerable response は API citation だけを参照元として表示し、citation 0 件を架空の根拠で埋めない。refusal は success answer と同じ表示へ変換しない。 |
| AC-JRN-003 | confirmed | clarification は API options/freeform 導線を保持し、選択後の質問を新しい処理として送る。 |
| AC-JRN-004 | confirmed | escalation は message ごとの stable ID を送信し、同一 owner/message の再試行で ticket を増やさない。success/partial/failure/unknown は対象件名と ID（提供時）を伴う。 |
| AC-JRN-005 | confirmed | open、in_progress、waiting_requester、answered、resolved と user/group assignment が requester/assignee/history の語彙・next action に正しく写像される。 |
| AC-JRN-006 | confirmed | answer/resolve mutation の API failure または timeout では local ticket status、下書き clean state、success feedback を更新しない。重複実行は in-flight guard で拒否する。 |
| AC-JRN-007 | confirmed | server が mutation を確定した後の補助 refresh だけが失敗した場合は partial とし、確定済み ticket と未更新範囲を区別する。 |
| AC-JRN-008 | confirmed | standard-user は自分の ticket だけを targeted GET/resolve でき、internal memo/support diagnostics を受け取らない。answer-editor は assigned user/group の ticket だけを回答する。 |
| AC-JRN-009 | confirmed | empty、API error/retry、long answer、many history、5 status、keyboard submit/focus、desktop/mobile reflow を automated test で検証し、manual screen reader/zoom/device は未検証として分離する。 |
| AC-JRN-010 | confirmed | 画面内だけの draft state は「一時保持」と明記し、永続保存や通知配信を実装済みと誤認させない。 |

## E2E and non-UI scenarios

| ID | 種別 | Scenario / expected evidence |
| --- | --- | --- |
| E2E-UI-QUESTION-001 | browser automation | standard-user の refusal → escalation → assignee assigned list/answer → standard-user targeted refresh/history → resolve を test fixture API state で一続きに検証する。fixture は route interception 内だけに置き production fallback にしない。 |
| E2E-UI-QUESTION-002 | browser automation | answer+citation、clarification、long answer、5 status/many history、zero/error、keyboard 操作、mobile viewport で overflow と target status を検証する。 |
| NONUI-QUESTION-001 | API integration | 同一 requester/messageId の create を再送して同じ questionId/1 record になり、別 requester または別 messageId は別 ticket になる。 |
| NONUI-QUESTION-002 | API/security | requester owner/non-owner、assigned user/group/admin の list/get/answer/resolve と response redaction を検証する。 |
| NONUI-QUESTION-003 | component/hook | create/answer/resolve の success/failure/unknown/partial/duplicate と late selection を target-specific outcome として検証する。 |
| NONUI-QUESTION-004 | RAG contract | responseType、isAnswerable、clarification、citation の API 値だけから UI state を生成し、dataset/期待語句固有分岐がないことを unit/semantic test で確認する。 |
| MANUAL-UI-QUESTION-001 | manual pending | representative screen reader、200%/400% zoom、real-device touch/virtual keyboard は `issue-345-manual-a11y-evidence` で取得する。本 milestone の pass に読み替えない。 |

## Operation and expectation groups

| Group | Operation | Expected observable result |
| --- | --- | --- |
| CHAT-RAG | ask / wait / answer / clarify / refuse | server response state、evidence count、next action が同じ assistant message に属する |
| CHAT-HANDOFF | create / retry / poll / resolve | stable message target、idempotent ticket、target-specific outcome、answered-only requester resolve |
| ASSIGNEE | filter / select / edit / temporary hold / answer | 5 status/assignment mapping、許可 ticket のみ、失敗時 draft を保持、永続下書きと誤表示しない |
| HISTORY | search / poll / resume | own conversation、ticket summary と next action、stable order、対象 ticket GET のみ |
| FAVORITES | inspect shortcut | accessible server item のみ。conversation handoff state は history/chat snapshot で扱い、架空 badge を足さない |
| API-AUTH | create/get/list/answer/resolve | owner/assignee/admin boundary、404 non-disclosure、internal field redaction、same-message idempotency |
| RAG-EVIDENCE | citations/refusal/clarification | API が返した根拠・回答不能・確認選択肢だけを表示し、期待語句や dataset 固有値を実装しない |

## Requirement / specification synthesis

新規 requirement ID は増やさず、confirmed gap を既存 atomic requirement の AC と design/trace に同期する。

| Task / AC | Canonical requirement | 更新方針 |
| --- | --- | --- |
| TASK-JRN-001 / AC-JRN-001〜003 | `FR-003`〜`FR-005`, `FR-029`, `FR-042`, `FR-043` | response state/next action と evidence-only 表示を既存 AC の具体的検証へ追記 |
| TASK-JRN-002 / AC-JRN-004 | `FR-021`, `FR-095`, `FR-096` | message-target idempotency と outcome semantics を追記 |
| TASK-JRN-003 / AC-JRN-005〜007,010 | `FR-031`〜`FR-033`, `FR-095`, `FR-096` | 5 status/assignment、temporary draft honesty、mutation outcome を追記 |
| TASK-JRN-004 / AC-JRN-005,008 | `FR-034`〜`FR-036`, `FR-044` | owner targeted polling、history next action、redaction を維持・明記 |
| TASK-JRN-005 / AC-JRN-006〜009 | `FR-095`, `FR-096`, `SQ-016` | retry/unknown/partial/long/many/zero/keyboard/mobile evidence を design/trace へ追加 |
| TASK-JRN-006 | `DES_UI_UX_001`, `ui-traceability.json` | `E2E-UI-QUESTION-001/002` と NONUI evidence を登録し generated inventory を再生成 |

README と運用手順は公開 API の利用方法や deploy 手順を変えないため更新不要。OpenAPI schema は optional `messageId` の conversation message 反映と idempotency description を同期する。route authorization policy 自体は変更しないが、security policy/API tests は回帰実行する。

## Traceability / gap / open questions

| Task | AC | Verification | REQ / DES | Gap result |
| --- | --- | --- | --- | --- |
| TASK-JRN-001 | AC-JRN-001〜003 | E2E-UI-QUESTION-002, NONUI-QUESTION-004 | FR-003〜005, FR-029, FR-042/043, DES UI | implementation + automated evidence required |
| TASK-JRN-002 | AC-JRN-004,007 | E2E-UI-QUESTION-001, NONUI-QUESTION-001/003 | FR-021, FR-095/096, DES UI/API/DATA | duplicate/partial gap confirmed |
| TASK-JRN-003 | AC-JRN-005〜007,010 | E2E-UI-QUESTION-001/002, NONUI-QUESTION-003 | FR-031〜033, FR-095/096, DES UI | 5-state/false-success/draft wording gaps confirmed |
| TASK-JRN-004 | AC-JRN-005,008 | E2E-UI-QUESTION-001/002, NONUI-QUESTION-002 | FR-034〜036, FR-044, DES UI | history next-action gap confirmed; auth already implemented |
| TASK-JRN-005 | AC-JRN-006〜009 | all automated + MANUAL pending | FR-095/096, SQ-016 | automated scope in this milestone; manual remains open |
| TASK-JRN-006 | AC-JRN-009 | docs/trace checks | canonical REQ/DES/generated | sync required in same PR |

### Open questions and exclusions

- `open_question`: notification は 20 秒 polling であり、push channel/SLA は未確定。新設しない。
- `open_question`: server-persisted assignee draft/status transition API は未確定。`in_progress` contract は正しく表示するが、本 task で架空の保存 API を作らない。
- `open_question`: representative browser/screen-reader/device matrix は `OQ-UI-001/002` と manual task に残す。
- `conflict resolution`: `docs/spec-recovery/` は repository validator が legacy path として拒否するため作成しない。spec recovery skill の成果は本レポートから canonical atomic docs と trace へ反映する。
- `validation applicability`: `scripts/validate_spec_recovery.py` は存在しないため実行不可。代わりに `scripts/validate_docs.py`、trace test、generated inventory check を実行対象とする。
