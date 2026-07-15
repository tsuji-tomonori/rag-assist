# Web UI 意味トレーサビリティ

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


> authored metadata: `tools/web-inventory/ui-traceability.json`
>
> production `AppView` / route guard と canonical requirement / AC / test evidence は generator が検証します。`partial` / `planned` は実装済みを意味せず、対応 task の完了が必要です。

## Persona

| ID | 表示名 | 主要 job context |
| --- | --- | --- |
| standard-user | 一般利用者 | 自分に許可された情報で質問し、回答・根拠・履歴・個人設定を扱う |
| answer-editor | 回答担当者 | 許可された問い合わせを検索し、回答・下書き・状態を更新する |
| operator | 運用担当者 | 許可された文書運用、benchmark、debug、利用状況・監査の操作と観測を行う |
| system-admin | システム管理者 | 許可された管理、監査、利用状況、alias governance を扱う |

## AppView trace

| view | canonical URL | route guard | persona | job | REQ / AC | verification | evidence | 状態 | gap task |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chat | /<br>/?view=chat | authenticated session | standard-user<br>answer-editor<br>operator<br>system-admin | JOB-UI-CHAT: 質問し、回答・回答不能・根拠・確認質問・人手対応への状態を追う | FR-094: AC-FR094-002, AC-FR094-004<br>FR-095: AC-FR095-001, AC-FR095-003 | E2E-VIEW-CHAT-001 (implemented) | apps/web/src/features/chat/components/ChatView.tsx | partial | tasks/todo/20260714-issue-345-chat-assignee-journey.md<br>tasks/todo/20260713-2304-responsive-chat-ui-verification.md |
| assignee | /?view=assignee | canAnswerQuestions | answer-editor<br>system-admin | JOB-UI-ASSIGNEE: 許可された問い合わせを検索・選択し、回答または下書きを安全に更新する | FR-094: AC-FR094-003<br>FR-095: AC-FR095-004<br>FR-097: AC-FR097-001<br>FR-098: AC-FR098-001 | E2E-VIEW-ASSIGNEE-001 (implemented) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx | partial | tasks/todo/20260714-issue-345-chat-assignee-journey.md |
| history | /?view=history | authenticated session | standard-user<br>answer-editor<br>operator<br>system-admin | JOB-UI-HISTORY: 自分の会話を検索・選択・再開・削除する | FR-094: AC-FR094-002<br>FR-095: AC-FR095-002, AC-FR095-003<br>FR-096: AC-FR096-001, AC-FR096-003 | E2E-VIEW-HISTORY-001 (implemented) | apps/web/src/features/history/components/HistoryWorkspace.tsx | partial | tasks/todo/20260714-issue-345-chat-assignee-journey.md<br>tasks/todo/20260714-issue-345-risky-operation-feedback.md |
| favorites | /?view=favorites | authenticated session | standard-user<br>answer-editor<br>operator<br>system-admin | JOB-UI-FAVORITES: 自分のお気に入り会話を確認し、再開または解除する | FR-094: AC-FR094-002<br>FR-095: AC-FR095-002 | E2E-VIEW-FAVORITES-001 (implemented) | apps/web/src/features/favorites/components/FavoritesWorkspace.tsx | partial | tasks/todo/20260714-issue-345-chat-assignee-journey.md |
| benchmark | /?view=benchmark | canReadBenchmarkRuns | operator<br>system-admin | JOB-UI-BENCHMARK: benchmark run を開始・監視・停止し、成果物を確認する | FR-094: AC-FR094-003<br>FR-095: AC-FR095-001, AC-FR095-005<br>FR-096: AC-FR096-002, AC-FR096-004 | E2E-VIEW-BENCHMARK-001 (implemented) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx | partial | tasks/todo/20260714-issue-345-risky-operation-feedback.md |
| admin | /?view=admin | canSeeAdminSettings | system-admin | JOB-UI-ADMIN: 管理対象の source/as-of/context を確認して許可された governance 操作を行う | FR-094: AC-FR094-003<br>FR-095: AC-FR095-004, AC-FR095-005<br>FR-096: AC-FR096-005<br>FR-097: AC-FR097-001, AC-FR097-002<br>FR-098: AC-FR098-003 | E2E-VIEW-ADMIN-001 (implemented) | apps/web/src/features/admin/components/AdminWorkspace.tsx | partial | tasks/todo/20260714-1011-admin-ui-governance-quality.md |
| documents | /documents<br>/documents/:documentId<br>/documents/groups/:folderId<br>/documents/reindex-migrations/:migrationId<br>/?view=documents | canReadDocuments | operator<br>system-admin | JOB-UI-DOCUMENTS: 許可された文書を発見・登録・共有・移動し、取り込みと索引状態を追う | FR-094: AC-FR094-002, AC-FR094-003<br>FR-095: AC-FR095-004, AC-FR095-005<br>FR-096: AC-FR096-001, AC-FR096-002<br>FR-097: AC-FR097-001, AC-FR097-003<br>FR-098: AC-FR098-001, AC-FR098-005 | E2E-VIEW-DOCUMENTS-001 (implemented) | apps/web/src/features/documents/components/DocumentWorkspace.tsx | partial | tasks/todo/20260714-issue-345-document-workspace-context.md |
| profile | /?view=profile | authenticated session | standard-user<br>answer-editor<br>operator<br>system-admin | JOB-UI-PROFILE: 本人の設定状態を確認・変更し、安全に sign out する | FR-094: AC-FR094-001, AC-FR094-004<br>FR-095: AC-FR095-003 | E2E-VIEW-PROFILE-001 (implemented) | apps/web/src/app/components/PersonalSettingsView.tsx | partial | tasks/todo/20260713-2301-user-preferences.md |

## 横断品質要件

| 要件 | AC | 適用 view |
| --- | --- | --- |
| NFR-016 | AC-NFR016-001<br>AC-NFR016-002<br>AC-NFR016-003<br>AC-NFR016-004<br>AC-NFR016-005 | * |
| NFR-017 | AC-NFR017-002<br>AC-NFR017-003<br>AC-NFR017-004 | * |
| NFR-018 | AC-NFR018-001<br>AC-NFR018-002<br>AC-NFR018-005<br>AC-NFR018-007 | * |
| SQ-016 | AC-SQ016-001<br>AC-SQ016-002<br>AC-SQ016-003<br>AC-SQ016-007<br>AC-SQ016-008 | * |

## 横断検証

| verification | 状態 | evidence | 未完了 task |
| --- | --- | --- | --- |
| NONUI-UI-TRACE-001 | implemented | tools/web-inventory/ui-traceability.test.mjs | - |
| NONUI-UI-TRACE-002 | implemented | tools/web-inventory/ui-traceability.test.mjs | - |
| E2E-UI-NAV-001 | implemented | apps/web/e2e/visual-regression.spec.ts | - |
| E2E-UI-NAV-002 | implemented | apps/web/e2e/visual-regression.spec.ts | - |
| E2E-UI-ROUTE-001 | implemented | apps/web/e2e/visual-regression.spec.ts | - |
| E2E-UI-ROUTE-002 | implemented | apps/web/e2e/visual-regression.spec.ts | - |
| E2E-UI-STATE-001 | planned | - | tasks/todo/20260714-issue-345-shared-ui-state-contract.md |
| E2E-UI-RISK-001 | planned | - | tasks/todo/20260714-issue-345-risky-operation-feedback.md |
| E2E-UI-DOCUMENTS-001 | planned | - | tasks/todo/20260714-issue-345-document-workspace-context.md |
| E2E-UI-MANUAL-001 | manual | - | tasks/todo/20260714-issue-345-manual-a11y-evidence.md |

## 判定上の注意

- `implemented` は記載された executable evidence 内に verification ID が存在することを表す。
- `partial`、`planned`、`manual` は未達または追加 evidence が必要であり、Issue #345 全体の完了を表さない。
- UI permission/guard は API authorization の代替ではなく、権限外 data を取得・表示しない server-side boundary を維持する。
- 自動 inventory/axe/visual result は keyboard、screen reader、400% zoom、real-device の手動 evidence を代替しない。
