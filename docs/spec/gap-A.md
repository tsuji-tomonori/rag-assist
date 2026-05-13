# Phase A Gap Inventory

## 目的と入力

Phase A の対象章 `0 / 1 / 1A / 2 / 3 / 6 / 24` について、canonical 仕様候補、既存実装、既存 docs の対応状況を棚卸す。実装変更は行わず、後続 `A1-docs-spec-canonical` / `A2-chapter-to-req-map` / `A3-cleanup-stale-mvp-dir` のスコープ確定材料として扱う。

主な根拠:

- canonical 仕様候補: `/home/t-tsuji/project/rag-assist/.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md`
- 既存仕様復元: `docs/spec-recovery/00_input_inventory.md` から `docs/spec-recovery/12_report_reading_inventory.md`
- 既存要求: `docs/1_要求_REQ/`
- 実装・契約: `apps/api/src/`, `apps/web/src/`, `packages/contract/src/`
- 踏襲挙動の根拠: 指定 commit `2c10256e`, `c438009c`, `01bb1bff`, `71782905`, `1865d193` と関連 reports / tasks

分類:

- `confirmed`: 仕様要素が現実装または既存 docs で直接確認できる。
- `partially covered`: 近い概念はあるが、仕様の型・ルール・運用条件が不足または粒度違い。
- `missing`: Phase A 章の仕様要素として存在するが、現実装・既存 docs で確認できない。
- `divergent`: 仕様候補と現実装・既存 docs が異なる前提で動いている。

## 章別ギャップ

| 章 | 主要型・ルール・操作 | 分類 | 根拠 | メモ |
|---|---|---|---|---|
| 0. 全体方針 | feature permission と resource permission の二段階判定、LLM に権限判断を任せない、機能領域を分ける | confirmed | `apps/api/src/app.ts`, `apps/api/src/authorization.ts`, `apps/api/src/security/access-control-policy.test.ts`, `docs/spec-recovery/07_specifications.md` の `SPEC-SEC-001` | route-level permission と auth middleware の静的検査が存在する。 |
| 0. 全体方針 | 章ごとに定義・データ・ルール・処理・UI を確認できる仕様構成 | partially covered | `docs/DOCS_STRUCTURE.md`, `docs/spec-recovery/README.md`, `.workspace/...章別定義...md` | 既存 docs は SWEBOK-lite / spec-recovery 体系で、章 ID 体系は未 canonical。 |
| 0. 全体方針 | `chat / async agent / history / knowledge management / quality / agent profile / search / benchmark / account / admin / API / deploy` の 12 領域整理 | partially covered | `README.md`, `docs/spec-recovery/06_requirements.md`, `docs/spec-recovery/07_specifications.md`, `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md` | 多くは既存 REQ にあるが、async agent / agent profile は Phase A では索引扱い。 |
| 1. 共通概念 | `User`、`Role`、active user、role による機能権限 | confirmed | `apps/api/src/auth.ts`, `apps/api/src/authorization.ts`, `apps/api/src/types.ts`, `apps/api/src/adapters/user-directory.ts`, `apps/web/src/features/admin/types.ts` | `AppUser` / `ManagedUser` / Cognito groups が現行実装の source。 |
| 1. 共通概念 | `UserGroup` / `GroupMembership` / 入れ子 group / 循環禁止 | partially covered | `apps/api/src/schemas.ts` の `DocumentGroupSchema`, `apps/api/src/types.ts` の `DocumentGroup`, `apps/api/src/adapters/document-group-store.ts` | 汎用 `UserGroup` / `GroupMembership` ではなく文書グループ共有として実装。循環禁止は明示実装未確認。 |
| 1. 共通概念 | 実効権限を UI 表示、API 認可、RAG 検索の共通判断に使う | partially covered | `apps/api/src/rag/memorag-service.ts`, `apps/api/src/routes/document-routes.ts`, `apps/web/src/app/hooks/usePermissions.ts`, `docs/spec-recovery/09_gap_analysis.md` の `GAP-009` | API と UI の permission gate はあるが、章 1 の共通権限モデルとしては未統合。 |
| 1A. 認証・アカウント | Cognito JWT、Bearer auth、Cognito group 由来 RBAC | confirmed | `apps/api/src/auth.ts`, `apps/api/src/adapters/user-directory.ts`, `docs/spec-recovery/07_specifications.md` の `SPEC-AUTH-001` / `SPEC-ADM-001` | 現実装は `Account` 永続型より Cognito と `ManagedUser` 台帳に寄る。 |
| 1A. 認証・アカウント | `Account` と `User` を分離し、emailVerified / MFA / lock / deletion_requested を持つ | missing | `.workspace/...章別定義...md` 1A.2, `apps/api/src/types.ts`, `apps/api/src/auth.ts` | 現実装型には `Account` / `AuthSession` の永続 schema がない。 |
| 1A. 認証・アカウント | ログイン前にアカウント有無を示唆しない | partially covered | `docs/spec-recovery/03_acceptance_criteria.md` の `AC-AUTH-001`, `docs/spec-recovery/07_specifications.md` の `SPEC-AUTH-001`, `apps/web/src/features/auth/components/LoginPage.tsx` | 要求・UI flow はあるが、Cognito の全 failure 文言までは Phase A 調査で未確認。 |
| 1A. 認証・アカウント | パスワード再設定 token single-use、session revoke、削除影響表示 | missing | `.workspace/...章別定義...md` 1A.5-1A.8, `apps/api/src/auth.ts`, `apps/api/src/routes/admin-routes.ts` | Cognito 利用前提はあるが、章 1A の `AuthSession` 管理や削除前影響表示の実装は未確認。 |
| 2. フォルダ管理 | `Folder` は管理者、親、canonical path、個別共有、status を持つ | divergent | `apps/api/src/schemas.ts` の `DocumentGroupSchema`, `apps/api/src/types.ts` の `DocumentGroup`, `apps/web/src/features/documents/types.ts` | 現行は `DocumentGroup` で `ownerUserId`, `visibility`, `sharedUserIds`, `sharedGroups`, `managerUserIds` を持ち、仕様の `Folder` と名前・権限モデルが違う。 |
| 2. フォルダ管理 | パスは管理者ごとに一意、フォルダ名単体では重複判定しない | partially covered | `apps/api/src/schemas.ts`, `apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx`, `tasks/done/20260509-1139-dynamodb-folder-hierarchy.md` | 階層表示・親子 group はあるが、`normalizedCanonicalPath` の永続契約は未確認。 |
| 2. フォルダ管理 | 共有は個人・グループ、階層継承、個別設定は完全な共有設定、full 0 人禁止 | partially covered | `apps/api/src/routes/document-routes.ts`, `apps/api/src/rag/memorag-service.ts`, `apps/api/src/adapters/document-group-store.ts`, `docs/spec-recovery/04_e2e_scenarios.md` | `sharedUserIds` / `sharedGroups` / `managerUserIds` は存在。`full 0 人禁止` や深い階層 policy 優先は未確認。 |
| 2. フォルダ管理 | 移動・削除・管理者変更は危険操作として差分・影響・理由を確認し監査ログへ残す | missing | `.workspace/...章別定義...md` 2.11-2.12, `apps/api/src/routes/document-routes.ts`, `apps/web/src/features/documents/components/workspace/DocumentConfirmDialog.tsx` | 確認 UI は文書操作中心。フォルダ移動・管理者変更の監査契約は未確認。 |
| 3. 文書管理 | `Document` の folder / owner / original file / MIME / fileSize / lifecycleStatus / scopeType | partially covered | `apps/api/src/schemas.ts` の `DocumentManifestSchema` / `DocumentIngestRunSchema`, `apps/api/src/types.ts` の `DocumentManifest`, `apps/web/src/features/documents/types.ts` | 現行の正は manifest / ingest run。仕様の `Document` 型とは lifecycle 値や `folderId` 表現が異なる。 |
| 3. 文書管理 | active 以外は RAG 対象外、active でも品質条件・RAG 利用可否が必要 | partially covered | `apps/api/src/types.ts` の `DocumentLifecycleStatus`, `apps/api/src/rag/memorag-service.ts`, `.workspace/...章別定義...md` 3.2 / 24 | lifecycle は active/staging/superseded。`ragEligibility` / freshness / verification は 3B 以降の計画要素で現実装では部分的。 |
| 3. 文書管理 | アップロードは対象フォルダ full と文書アップロード機能権限が必要 | confirmed | `apps/api/src/routes/document-routes.ts` の `authorizeDocumentUploadSession` / `scopedMetadata`, `apps/api/src/rag/memorag-service.ts` の `assertDocumentGroupsWritable`, `apps/api/src/authorization.ts` の `rag:doc:write:group` | sync upload と upload session / async ingest の両方がある。 |
| 3. 文書管理 | 削除、移動、ファイル名変更、再インデックスは監査ログへ記録 | partially covered | `apps/api/src/routes/document-routes.ts`, `apps/api/src/rag/memorag-service.ts`, `apps/web/src/features/documents/hooks/useDocuments.ts` | delete / reindex stage-cutover-rollback はある。文書移動・ファイル名変更・監査ログ契約は未確認。 |
| 3. 文書管理 | アップロード後に「この資料に質問する」「このフォルダに質問する」「詳細を開く」導線 | confirmed | `apps/web/src/app/hooks/useAppShellState.ts`, `apps/web/src/features/documents/components/DocumentWorkspace.tsx`, `apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx` | document workspace から document scope chat へ移動する test もある。 |
| 6. お気に入り | `Favorite` は所有者、対象種別、対象 ID、ラベル、メモを持つ独立型 | divergent | `apps/api/src/types.ts` の `ConversationHistoryItem.isFavorite`, `apps/web/src/features/history/types.ts`, `apps/web/src/features/history/hooks/useConversationHistory.ts` | 現行は会話履歴 item の boolean。独立 `Favorite` store や folder/document/skill/agent profile 対象は未実装。 |
| 6. お気に入り | 他人のお気に入りは見えず、権限を失った対象は開けない | partially covered | `docs/spec-recovery/01_report_facts.md` の `FACT-010`, `docs/spec-recovery/07_specifications.md` の `SPEC-HIST-002`, `apps/web/src/features/history/hooks/useConversationHistory.ts` | 履歴 favorite は userId 境界内。文書・フォルダ favorite の権限再確認は未確認。 |
| 6. お気に入り | フォルダ、skill、agent profile では管理者とパスを表示する | missing | `.workspace/...章別定義...md` 6.3-6.5, `apps/web/src/features/history/components/HistoryWorkspace.tsx` | 現行 UI は履歴 favorite 中心。folder / skill / agent profile favorite は Phase A2 以降で要仕様化。 |
| 24. 最終まとめ | authorized and quality-approved evidence だけを RAG 根拠にする | partially covered | `apps/api/src/agent/nodes/sufficient-context-gate.ts`, `apps/api/src/agent/nodes/validate-citations.ts`, `apps/api/src/agent/nodes/verify-answer-support.ts`, `docs/spec-recovery/07_specifications.md` | 根拠性 gate は実装済み。quality-approved の文書品質側は 3B/3C として段階導入。 |
| 24. 最終まとめ | チャット内オーケストレーションと非同期エージェント実行を分ける | partially covered | `.workspace/...章別定義...md` 24, `apps/api/src/agent/graph.ts`, `docs/spec-recovery/06_requirements.md` | 現実装は chat RAG graph が中心。非同期エージェントは Phase A では scope-out。 |
| 24. 最終まとめ | OpenAPI / shared contract / generated docs / Taskfile verify で drift を検出する | confirmed | `apps/api/src/generate-openapi-docs.ts`, `apps/api/src/openapi-doc-quality.ts`, `packages/contract/src/`, `Taskfile.yml`, `package.json` | `docs:openapi:check`, `docs:web-inventory:check`, `docs:infra-inventory:check` が存在。 |

## 踏襲すべき既存挙動

| 挙動 | Phase A 関連章 | 根拠 | 後続 task での扱い |
|---|---|---|---|
| ChatRAG follow-up では generic refusal / 定型前置き由来の低情報量 token を retrieval query に混ぜず、compact follow-up の query expansion を抑制する。 | 0 / 24 | commit `2c10256e`, `reports/working/20260512-1342-chatrag-latency-followup.md`, `apps/api/src/agent/nodes/build-conversation-state.ts`, `apps/api/src/agent/graph.test.ts` | A1/A2 の章別仕様移行時に「マルチターン follow-up 性能の既存挙動」として残す。 |
| 通常 RAG 質問では不要な `extract_policy_computations` を skip し、policy / threshold / decision 系の構造 signal がある場合だけ抽出する。 | 0 / 24 | commit `2c10256e`, commit `71782905`, `reports/working/20260512-2017-generalize-policy-computation-gate.md`, `apps/api/src/agent/graph.ts`, `apps/api/src/agent/policy-computation.test.ts` | 仕様文で「常時実行」へ戻さない。latency と根拠性の両方の既存 contract として記録する。 |
| required fact planning は質問語彙 slot rule を増やす方向ではなく、signal phrase primary fact と value signal gate に寄せる。 | 0 / 24 | commit `c438009c`, commit `01bb1bff`, `reports/working/20260512-2046-generalize-required-fact-planning.md`, `reports/working/20260512-2329-remove-rule-based-required-facts.md`, `apps/api/src/agent/graph.ts`, `apps/api/src/agent/question-requirements.ts` | A1/A2 で canonical 仕様に戻す際、`amount/count/procedure/person/...` の固定 slot planning を復活させない。 |
| S3 Vectors の filterable metadata は 2048 bytes budget を守り、rich drawing metadata は vector filter metadata に複製しない。 | 3 / 24 | `reports/working/20260511-2327-s3-vectors-metadata-budget.md`, `apps/api/src/adapters/s3-vectors-store.ts`, `apps/api/src/rag/memorag-service.ts`, `benchmark/corpus.ts` | 章 3 / 24 の metadata 説明に、巨大 metadata は artifact 側へ寄せる制約として残す。 |
| Document ingest worker と Heavy API Lambda は 3008MB memory を前提にし、Document ingest worker timeout は Lambda 上限の 15 分を超えない。 | 3 / 24 | `reports/working/20260510-2240-ingest-lambda-timeout-limit.md`, `reports/working/20260511-1937-adjust-heavy-api-lambda-quota.md`, `infra/lib/memorag-mvp-stack.ts`, `infra/test/memorag-mvp-stack.test.ts` | canonical 仕様に 30 分 timeout や 4096MB 前提を入れない。 |
| API coverage は statements/functions/lines 90%、branches 85% を gate として扱う。 | 0 / 24 | `reports/working/20260510-1238-api-c1-coverage-partial.md`, `apps/api/package.json`, `.github/workflows/memorag-ci.yml` | 開発品質ゲート章へ引き継ぎ、Phase A docs でも未実施検証を pass 扱いしない。 |
| benchmark 用 policy は dataset 固有 row id や expected phrase 分岐ではなく benchmark metadata / policy で切り替える。 | 0 / 24 | `.workspace/...章別定義...md` 4A.13, `reports/working/20260512-2329-remove-rule-based-required-facts.md`, `apps/api/src/agent/runtime-policy.ts` | Phase A では実装へ反映しないが、後続 RAG 仕様移行時の禁止事項として残す。 |

## 後続 task への申し送り

### A1-docs-spec-canonical

- `.workspace/...章別定義...md` は origin/main には存在しないため、A1 では canonical 仕様の取り込み元を明示する。
- Phase A では章 `0 / 1 / 1A / 2 / 3 / 6 / 24` を対象にするが、章 3 は 3A/3B/3C と境界が近い。文書 lifecycle / upload / 権限を章 3 に限定し、抽出・品質・高度解析は後続 Phase に残す。
- root lift 済みのため、旧 `memorag-bedrock-mvp/...` パスを canonical docs に残さない。既存 report の引用では旧パスを史料として扱う。

### A2-chapter-to-req-map

- `docs/spec/CHAPTER_TO_REQ_MAP.md` の Phase A 行を正にし、章 ID と既存 `REQ-*` / `SPEC-*` を二重トレースする。
- `Folder` と現行 `DocumentGroup` は divergence が大きい。REQ 追加時は名前だけを置換せず、管理者ごとの canonical path、継承、full 0 人禁止を別 acceptance criteria に分割する。
- `Favorite` は現行 `ConversationHistoryItem.isFavorite` と仕様候補の独立 `Favorite` 型が divergent。既存履歴 favorite と将来の folder/document favorite を分けて trace する。

### A3-cleanup-stale-mvp-dir

- 本作業では実装変更・削除をしない。A3 で stale directory を扱う場合も、過去 report / task の旧パスは監査資料として残すか、移行注記を付ける。
- `reports/working/` や `docs/spec-recovery/12_report_reading_inventory.md` の旧パスは過去事実の引用であり、機械的置換対象ではない。

## Scope-out 候補

- `Account` / `AuthSession` 永続 schema、MFA、password reset token、session revoke の実装。
- `Folder` への全面 rename、`DocumentGroup` store migration、canonical path index、policy inheritance の実装。
- 独立 `Favorite` store と folder/document/skill/agent profile favorite UI。
- ナレッジ品質 3B / 高度文書解析 3C / チャット 4A 以降の詳細仕様確定。
- benchmark / RAG / infra の既存挙動変更。

## Open Questions

| ID | 問い | 影響 | 推奨扱い |
|---|---|---|---|
| OQ-A-001 | 仕様候補の `Folder` を現行 `DocumentGroup` の上位概念として扱うか、rename/migration 前提の新型として扱うか。 | 章 2 と既存 API / UI のトレース粒度に影響する。 | A2 で `partially covered` として REQ 分割し、実装変更 task を別化する。 |
| OQ-A-002 | `Account` / `AuthSession` は Cognito の外部仕様として参照するだけか、アプリ内台帳を持つか。 | 章 1A の受け入れ条件と security docs に影響する。 | 認証設計 task で決定。Phase A docs では現状 `missing` を明記する。 |
| OQ-A-003 | お気に入りは履歴内 boolean から独立 resource へ拡張するか。 | 章 6 の対象種別、権限再確認、UI 表示に影響する。 | 現行 favorite は履歴 scope として trace し、拡張 favorite は future requirement に分ける。 |
| OQ-A-004 | `ragEligibility` / `quality-approved` を章 3 にどこまで含めるか。 | 章 3 と 3B/3C の責務境界に影響する。 | 章 3 では「必要条件」として参照し、実体定義は 3B/3C に残す。 |
