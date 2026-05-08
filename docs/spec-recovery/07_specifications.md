# Specifications

## SPEC-DOC-001: ドキュメント管理画面の登録・状態表示

- Requirement: REQ-DOC-001
- Type: screen
- Target: ドキュメント管理画面
- Confidence: inferred
- Source: OP-001, OP-002, EXP-001, E2E-DOC-001

### Specification
ドキュメント管理画面は、権限を持つユーザーに文書 upload 操作と登録済み文書一覧を提供する。文書一覧はファイル名、処理状態、失敗時の調査に必要な識別子または状態を表示する。

### Verification
- E2E-DOC-001

## SPEC-DOC-002: 文書 ingest run/event contract

- Requirement: REQ-DOC-001, REQ-OPS-001
- Type: API/data
- Target: `/document-ingest-runs`
- Confidence: confirmed
- Source: EXP-002, AC-DOC-001, SRC-003, SRC-004

### Specification
文書 ingest は runId を持つ非同期 run として保存され、events endpoint で queued / processing / final / error を追跡できる。大きな PDF や OCR fallback を考慮し、同期 API は後方互換用途に留める。

### Verification
- AC-DOC-001

## SPEC-CHAT-001: 非同期 chat run UI

- Requirement: REQ-CHAT-001
- Type: screen/API
- Target: チャット画面 / `/chat-runs`
- Confidence: confirmed
- Source: OP-010, OP-011, OP-012, EXP-011, E2E-CHAT-001

### Specification
チャット画面は `POST /chat-runs` で run を作成し、`GET /chat-runs/{runId}/events` の SSE を `fetch` stream で購読する。UI は queued / processing / final / error / timeout をユーザーが判別できる形で表示する。

### Verification
- E2E-CHAT-001

## SPEC-CHAT-002: Chat stream の再接続・failure marker

- Requirement: REQ-CHAT-001, REQ-OPS-001
- Type: API/reliability
- Target: `/chat-runs/{runId}/events`
- Confidence: confirmed
- Source: EXP-013, AC-CHAT-003, SRC-003, SRC-011

### Specification
SSE stream は event id を返し、クライアントは `Last-Event-ID` で再接続できる。worker timeout/failure 時は run status を failed に更新し、error event を永続化する。

### Verification
- AC-CHAT-003

## SPEC-RAG-001: 回答支持検証

- Requirement: REQ-RAG-001
- Type: AI/RAG quality
- Target: `verify_answer_support`
- Confidence: confirmed
- Source: EXP-010, FACT-005

### Specification
回答生成後、回答文ごとに citation/final evidence との支持関係を検証する。支持されない文がある場合は安全側に回答不能へ落とし、unsupported answer を通常回答として返さない。

### Verification
- AC-CHAT-001

## SPEC-RAG-002: 回答前根拠十分性 gate

- Requirement: REQ-RAG-002
- Type: AI/RAG quality
- Target: `answerability_gate`, `sufficient_context_gate`
- Confidence: confirmed
- Source: EXP-012, FACT-004

### Specification
検索結果なし、低 score、missing fact、partial、unanswerable の場合は回答生成へ進めず、回答不能または確認質問に分岐する。`answerability_gate` は cheap precheck、`sufficient_context_gate` は後段 judge として扱う。

### Verification
- AC-CHAT-002

## SPEC-SRCH-001: Hybrid retriever と retrieval evaluator

- Requirement: REQ-SRCH-001
- Type: search/API
- Target: `/search`, RAG graph search path
- Confidence: confirmed
- Source: OP-030, EXP-030, FACT-006

### Specification
検索は lexical tokenization、BM25、prefix/fuzzy/n-gram、vector search、RRF、cheap rerank を組み合わせ、retrieval evaluator が `sufficient`、`partial`、`irrelevant`、`conflicting` と `nextAction` を state/trace に残す。

### Verification
- AC-SRCH-001

## SPEC-QA-001: 問い合わせ本人確認と担当者導線

- Requirement: REQ-QA-001, REQ-SEC-001
- Type: API/screen
- Target: `/questions`
- Confidence: confirmed
- Source: OP-020, OP-021, OP-022, EXP-020, FACT-009

### Specification
問い合わせ作成時は requesterUserId を保存する。本人は自分の ticket 詳細と解決済み化を実行でき、担当者は `answer:edit` / `answer:publish` により一覧、回答登録、解決を行う。

### Verification
- AC-QA-001
- AC-QA-002

## SPEC-HIST-001: 会話履歴 store の userId boundary

- Requirement: REQ-HIST-001, REQ-SEC-001
- Type: data/API
- Target: `/conversation-history`
- Confidence: confirmed
- Source: EXP-022, FACT-010

### Specification
会話履歴は userId を partition boundary として保存・一覧・削除する。ローカル開発では local store、本番では DynamoDB store を使う。

### Verification
- AC-HIST-001

## SPEC-HIST-002: お気に入り状態

- Requirement: REQ-HIST-001
- Type: screen/data
- Target: 履歴画面
- Confidence: confirmed
- Source: OP-023, EXP-023, FACT-010

### Specification
会話履歴 item は `isFavorite` を持つ。未指定の既存 item は `false` として扱い、UI はお気に入り toggle と favorite-only view を提供する。

### Verification
- E2E-HIST-001

## SPEC-DBG-001: Debug trace の管理者限定と redaction

- Requirement: REQ-DBG-001, REQ-SEC-001
- Type: security/API
- Target: `/debug-runs`, chat `includeDebug`
- Confidence: confirmed
- Source: OP-031, EXP-032, FACT-011

### Specification
Debug trace の一覧、詳細、download、chat `includeDebug=true` は `chat:admin:read_all` を要求する。trace output は raw embeddings、raw retrieved/selected chunks、raw answer などの機微フィールドを不要に含めない。

### Verification
- AC-DBG-001

## SPEC-BENCH-001: Benchmark run と artifact 管理

- Requirement: REQ-BENCH-001, REQ-OPS-001
- Type: operations/API
- Target: `/benchmark-runs`, CodeBuild runner
- Confidence: confirmed
- Source: OP-032, EXP-033, FACT-012, FACT-015

### Specification
Benchmark operator は suite を選択して run を起動できる。runner は service user token を自動取得し、本番 API を通じて query/search/corpus seed を実行する。結果は summary/results/report/log artifact として追跡・download できる。

### Verification
- AC-BENCH-001
- AC-OPS-001

## SPEC-ADM-001: Role 付与と Cognito group 同期

- Requirement: REQ-ADM-001, REQ-SEC-001
- Type: admin/security
- Target: `/admin/users/{userId}/roles`
- Confidence: confirmed
- Source: OP-033, EXP-034, FACT-008

### Specification
管理者が role を付与・削除すると、管理台帳と Cognito group が同期される。人間の性能テスト担当は `BENCHMARK_OPERATOR`、runner service user は `BENCHMARK_RUNNER` として分離する。

### Verification
- AC-ADM-001

## SPEC-SEC-001: Route-level permission policy

- Requirement: REQ-SEC-001
- Type: security/API
- Target: protected API routes
- Confidence: confirmed
- Source: EXP-003, FACT-007, SRC-005

### Specification
保護対象 route は auth middleware coverage と route-level permission を持つ。新規 route または permission 変更時は `access-control-policy.test.ts` を更新し、所有者境界や seed 例外を明示する。

### Verification
- static policy test

## SPEC-SEC-002: 問い合わせ内部メモの非公開

- Requirement: REQ-QA-001, REQ-SEC-001
- Type: security/API
- Target: `/questions/{questionId}`
- Confidence: confirmed
- Source: EXP-021, FACT-009

### Specification
通常ユーザー本人向け問い合わせ詳細 response は担当者向け `internalMemo` を返さない。担当者向け一覧/回答 API は `answer:*` 権限に閉じる。

### Verification
- AC-QA-002

## SPEC-SEC-003: 検索結果の ACL/metadata filter と response allowlist

- Requirement: REQ-SRCH-001, REQ-SEC-001
- Type: security/search
- Target: `/search`
- Confidence: confirmed
- Source: EXP-031, FACT-006

### Specification
検索結果は user/group/tenant/source/docType などの許可された metadata で filter される。通常ユーザー response の metadata は allowlist に限定し、ACL group、許可 user list、内部 alias 定義、project code を返さない。

### Verification
- AC-SRCH-001

## SPEC-AUTH-001: Cognito 認証 flow と初回パスワード

- Requirement: REQ-AUTH-001
- Type: security/UI/API
- Target: Auth UI / Cognito
- Confidence: confirmed
- Source: OP-040, EXP-040, FACT-017

### Specification
ログイン、初回パスワード変更、自己登録、password guidance は Cognito の許可 flow に限定する。自己登録を許可する場合でも初期 role は最小権限にし、管理 role は管理者操作を経由する。

### Verification
- AC-AUTH-001

## SPEC-API-001: API 契約・OpenAPI・policy 同期

- Requirement: REQ-API-001
- Type: API/maintainability/security
- Target: API routes / OpenAPI / access-control-policy.test
- Confidence: confirmed
- Source: AC-API-001, FACT-024

### Specification
API route の分割や OpenAPI 更新時は、request/response schema、examples、docs check、access-control policy を同期する。保護 route には route-level permission と所有者境界を明示する。

### Verification
- AC-API-001

## SPEC-UI-001: Chat UI 操作性

- Requirement: REQ-UI-001
- Type: UI/usability
- Target: Chat UI
- Confidence: confirmed
- Source: OP-041, EXP-041, FACT-021

### Specification
チャット画面は送信ショートカット、copy、loading/streaming、根拠表示、debug panel 表示を layout 破綻なく提供する。copy は対象テキストのみを扱い、不要な feedback action を出さない。

### Verification
- AC-UI-001

## SPEC-HIST-003: 履歴検索・sort・通知

- Requirement: REQ-HIST-002
- Type: UI/API/data
- Target: History UI / History API
- Confidence: confirmed
- Source: OP-042, EXP-042, FACT-021

### Specification
履歴検索、sort、favorite filter、問い合わせ回答通知は userId 境界内で動作する。短い substring や同一時刻 item でも安定した表示順を維持する。

### Verification
- AC-HIST-002

## SPEC-DOC-003: PDF/OCR/大容量 ingest boundary

- Requirement: REQ-DOC-002, REQ-OPS-001
- Type: API/operations
- Target: Upload API / S3 / Textract / ingest run
- Confidence: confirmed
- Source: OP-043, EXP-043, FACT-022

### Specification
文書 upload は size/quota validation、S3 handoff、async OCR/ingest を扱う。OCR timeout や抽出不能文書は error/skip reason として記録し、run/artifact から追跡できる。

### Verification
- AC-DOC-003

## SPEC-RAG-003: 回答可能性 policy profile

- Requirement: REQ-RAG-003
- Type: AI/RAG quality
- Target: Answerability gate / Support verifier / LLM judge
- Confidence: confirmed
- Source: OP-044, EXP-044, FACT-018

### Specification
回答可能性判定は threshold、clause polarity、abbreviation、value mismatch を汎用 policy として扱う。dataset 固有の期待語句や QA sample 固有値を product 実装に hardcode しない。

### Verification
- AC-RAG-003

## SPEC-SRCH-002: Retrieval adoption gate

- Requirement: REQ-SRCH-002
- Type: search/RAG quality
- Target: Chunker / Retrieval evaluator / RAG graph
- Confidence: confirmed
- Source: OP-045, EXP-045, FACT-019

### Specification
semantic chunking、hybrid retrieval、retrieval evaluator は chunk、score、quality、nextAction を trace する。採用基準を満たす根拠だけを回答生成へ渡し、満たさない場合は再検索、context expansion、回答不能へ流す。

### Verification
- AC-SRCH-002

## SPEC-DBG-002: Debug timeline artifact

- Requirement: REQ-DBG-002
- Type: security/operations
- Target: Debug panel / trace artifact
- Confidence: confirmed
- Source: OP-046, EXP-046, FACT-020

### Specification
Debug trace artifact は timeline、sentence assessments、finalEvidence、判定 step を再現できる。JSON/Markdown download は admin only とし、artifact 生成または download 時に redaction を適用する。

### Verification
- AC-DBG-002

## SPEC-BENCH-002: Dataset adapter と metrics

- Requirement: REQ-BENCH-002
- Type: benchmark/evaluation
- Target: Benchmark adapters / Metrics / Reports
- Confidence: confirmed
- Source: OP-047, EXP-047, FACT-023

### Specification
Allganize、MMRAG DocQA、NeoAI などの dataset は、source context、expected answer、skip reason、metrics、report artifact を一貫形式に正規化する。dataset 固有分岐は adapter に閉じ込め、product RAG 実装へ入れない。

### Verification
- AC-BENCH-002

## SPEC-BENCH-003: Benchmark timeout/cost/artifact operation

- Requirement: REQ-BENCH-003, REQ-OPS-001
- Type: operations/reliability
- Target: Benchmark UI/API / CodeBuild / cost guard
- Confidence: confirmed
- Source: AC-BENCH-003, FACT-023, FACT-024

### Specification
Benchmark run は timeout、progress、metrics、raw results download、artifact generation を追跡する。運用では cost/anomaly/tag guard を持ち、失敗時は原因と未生成 artifact を区別する。

### Verification
- AC-BENCH-003

## SPEC-DOCS-001: 作業レポート分類と仕様復元 trace

- Requirement: REQ-DOCS-001
- Type: documentation/traceability
- Target: `docs/spec-recovery`
- Confidence: confirmed
- Source: OP-048, EXP-048, FACT-016, FACT-025, FACT-026

### Specification
作業レポート本文は product behavior に関係するカテゴリと、commit/PR/merge only など task 化対象外カテゴリに分ける。各 report に `RPT-*` ID を付け、関連 task、対象/対象外、除外理由を inventory に残す。仕様化対象カテゴリは facts/tasks/AC/E2E/REQ/SPEC/gap に task family 経由で trace する。

### Verification
- AC-DOCS-001
