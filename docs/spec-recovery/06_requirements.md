# Requirements

## REQ-DOC-001: 文書を QA 利用可能な知識ベースへ登録できる

- Type: functional
- Actor: `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN`
- Priority: high
- Confidence: confirmed
- Source: TASK-001, AC-DOC-001, AC-DOC-002

### Description
権限を持つユーザーは、文書をアップロードし、非同期 ingest により検索・回答生成の根拠として利用可能にできる。

### Acceptance criteria
- AC-DOC-001
- AC-DOC-002

### Related specifications
- SPEC-DOC-001
- SPEC-DOC-002
- SPEC-SEC-001

## REQ-CHAT-001: ユーザーは登録文書に対して自然言語で質問できる

- Type: functional
- Actor: `CHAT_USER`
- Priority: high
- Confidence: confirmed
- Source: TASK-002, AC-CHAT-001, AC-CHAT-003

### Description
ユーザーはチャット画面から質問を送信し、非同期 streaming による進捗と最終回答を受け取れる。

### Acceptance criteria
- AC-CHAT-001
- AC-CHAT-003

### Related specifications
- SPEC-CHAT-001
- SPEC-CHAT-002

## REQ-RAG-001: 回答は根拠文書に忠実でなければならない

- Type: AI/RAG quality
- Actor: system
- Priority: high
- Confidence: confirmed
- Source: TASK-002, AC-CHAT-001, FACT-004, FACT-005

### Description
回答は検索・rerank 後の根拠 chunk と citation に支持され、支持されない断定を返してはならない。

### Acceptance criteria
- AC-CHAT-001

### Related specifications
- SPEC-RAG-001

## REQ-RAG-002: 根拠不足時は回答不能または確認質問にする

- Type: AI/RAG quality
- Actor: system
- Priority: high
- Confidence: confirmed
- Source: TASK-002, AC-CHAT-002

### Description
検索結果が不十分、partial、unanswerable、または回答支持検証で不支持の場合、システムは推測回答を返さない。

### Acceptance criteria
- AC-CHAT-002

### Related specifications
- SPEC-RAG-002

## REQ-SRCH-001: 検索は lexical/vector/RRF と権限 filter を組み合わせる

- Type: functional
- Actor: system, `CHAT_USER`
- Priority: high
- Confidence: confirmed
- Source: TASK-004, AC-SRCH-001

### Description
検索は BM25/prefix/fuzzy/n-gram、vector search、RRF、metadata/ACL filter により関連根拠を取得する。

### Acceptance criteria
- AC-SRCH-001

### Related specifications
- SPEC-SRCH-001
- SPEC-SEC-003

## REQ-QA-001: 回答不能質問を人手対応へエスカレーションできる

- Type: functional
- Actor: `CHAT_USER`, `ANSWER_EDITOR`
- Priority: high
- Confidence: confirmed
- Source: TASK-003, AC-QA-001, AC-QA-002

### Description
通常ユーザーは回答不能質問を担当者へ送信でき、担当者回答後に本人の履歴から返答状況を確認できる。

### Acceptance criteria
- AC-QA-001
- AC-QA-002

### Related specifications
- SPEC-QA-001
- SPEC-SEC-002

## REQ-HIST-001: 会話履歴とお気に入りはユーザー単位で管理する

- Type: functional
- Actor: `CHAT_USER`
- Priority: medium
- Confidence: confirmed
- Source: TASK-005, AC-HIST-001

### Description
ユーザーは自分の会話履歴を保存・一覧・削除し、履歴 item をお気に入りとして管理できる。

### Acceptance criteria
- AC-HIST-001

### Related specifications
- SPEC-HIST-001
- SPEC-HIST-002

## REQ-DBG-001: Debug trace は管理者の調査用途に限定する

- Type: security / operations
- Actor: `SYSTEM_ADMIN`
- Priority: high
- Confidence: confirmed
- Source: TASK-006, AC-DBG-001

### Description
Debug trace は管理者のみが一覧・詳細・download でき、機微な raw data は不要に露出しない。

### Acceptance criteria
- AC-DBG-001

### Related specifications
- SPEC-DBG-001

## REQ-BENCH-001: Benchmark により RAG 品質を継続評価できる

- Type: functional / operations
- Actor: `BENCHMARK_OPERATOR`, `BENCHMARK_RUNNER`, `SYSTEM_ADMIN`
- Priority: medium
- Confidence: confirmed
- Source: TASK-007, AC-BENCH-001, AC-OPS-001

### Description
評価担当者は benchmark run を起動・追跡・download でき、runner は service user と corpus seed 隔離を使って評価する。

### Acceptance criteria
- AC-BENCH-001
- AC-OPS-001

### Related specifications
- SPEC-BENCH-001

## REQ-SEC-001: API は route-level permission と所有者境界を強制する

- Type: security
- Actor: system
- Priority: high
- Confidence: confirmed
- Source: TASK-003, TASK-004, TASK-005, TASK-008, AC-QA-002, AC-SRCH-001, AC-HIST-001, AC-ADM-001

### Description
保護対象 API は認証 middleware と route-level permission を持ち、問い合わせ、履歴、run、benchmark seed などの所有者/目的境界を維持する。

### Acceptance criteria
- AC-QA-002
- AC-SRCH-001
- AC-HIST-001
- AC-ADM-001

### Related specifications
- SPEC-SEC-001
- SPEC-SEC-002
- SPEC-SEC-003
- SPEC-ADM-001

## REQ-ADM-001: 管理 role 変更は認可源泉へ反映される

- Type: security / admin
- Actor: `ACCESS_ADMIN`, `SYSTEM_ADMIN`
- Priority: high
- Confidence: confirmed
- Source: TASK-008, AC-ADM-001

### Description
管理者による role 付与・削除は、管理台帳だけでなく Cognito group と JWT permission に反映される。

### Acceptance criteria
- AC-ADM-001

### Related specifications
- SPEC-ADM-001

## REQ-OPS-001: 長時間・失敗し得る処理は追跡可能でなければならない

- Type: operations / reliability
- Actor: system, operator
- Priority: medium
- Confidence: confirmed
- Source: TASK-001, TASK-002, TASK-007, AC-CHAT-003, AC-OPS-001

### Description
文書 ingest、chat run、benchmark run は status/event/artifact により追跡でき、timeout/failure 時も調査可能な状態を残す。

### Acceptance criteria
- AC-DOC-001
- AC-CHAT-003
- AC-OPS-001

### Related specifications
- SPEC-DOC-002
- SPEC-CHAT-002
- SPEC-BENCH-001

## REQ-AUTH-001: 認証フローは許可された経路に限定する

- Type: security / functional
- Actor: 未ログインユーザー, 認証済みユーザー, `USER_ADMIN`
- Priority: high
- Confidence: confirmed
- Source: TASK-011, AC-AUTH-001

### Description
login、初回パスワード変更、自己登録、password guidance は Cognito と role policy に従い、許可されない flow や過剰 role を与えてはならない。

### Acceptance criteria
- AC-AUTH-001

### Related specifications
- SPEC-AUTH-001

## REQ-API-001: API 契約と保護 route policy は同期していなければならない

- Type: functional / security / maintainability
- Actor: API consumer, browser client, system
- Priority: high
- Confidence: confirmed
- Source: TASK-012, TASK-022, AC-API-001

### Description
API route、OpenAPI、examples、request validation、access-control policy は同じ契約を表し、保護 route の認証・認可境界を維持する。
`GET /openapi.json` は runtime API contract の source of truth として扱い、生成 Markdown は派生成果物として扱う。
REST / oRPC / shared contract / OpenAPI の drift 検出範囲、docs quality gate、deprecated / compatibility endpoint の lifecycle 表現は、API 変更時に明示する。

### Acceptance criteria
- AC-API-001

### Related specifications
- SPEC-API-001

## REQ-UI-001: チャット UI は主要操作を安定して提供する

- Type: functional / usability
- Actor: `CHAT_USER`
- Priority: medium
- Confidence: confirmed
- Source: TASK-013, AC-UI-001

### Description
ユーザーは質問送信、回答閲覧、引用確認、コピー、送信ショートカット、loading/streaming 状態を layout 破綻なく利用できる。

### Acceptance criteria
- AC-UI-001

### Related specifications
- SPEC-UI-001

## REQ-HIST-002: 履歴検索・並び替え・回答通知を提供する

- Type: functional
- Actor: `CHAT_USER`
- Priority: medium
- Confidence: confirmed
- Source: TASK-014, AC-HIST-002

### Description
ユーザーは自分の履歴を検索・並び替え・favorite filter し、問い合わせ回答通知を本人の履歴から確認できる。

### Acceptance criteria
- AC-HIST-002

### Related specifications
- SPEC-HIST-003

## REQ-DOC-002: PDF/OCR/大容量文書は非同期 ingest で境界値を扱う

- Type: functional / reliability
- Actor: `RAG_GROUP_MANAGER`, `BENCHMARK_RUNNER`
- Priority: high
- Confidence: confirmed
- Source: TASK-015, AC-DOC-003

### Description
PDF、OCR、大容量、抽出不能文書は upload validation、S3 handoff、async ingest、timeout/skip/retry の追跡により安全に扱う。

### Acceptance criteria
- AC-DOC-003

### Related specifications
- SPEC-DOC-003

## REQ-RAG-003: 回答可能性判定は汎用 policy として評価できる

- Type: AI/RAG quality
- Actor: system, evaluator
- Priority: high
- Confidence: confirmed
- Source: TASK-016, AC-RAG-003

### Description
threshold、clause polarity、abbreviation、value mismatch などの回答可能性判定は dataset 固有 hardcode ではなく、根拠・数値・言い換え・否定極性の汎用 policy として評価する。

### Acceptance criteria
- AC-RAG-003

### Related specifications
- SPEC-RAG-003

## REQ-SRCH-002: retrieval adoption gate は回答根拠を選別する

- Type: AI/RAG quality / search
- Actor: system, evaluator
- Priority: high
- Confidence: confirmed
- Source: TASK-017, AC-SRCH-002

### Description
semantic chunking、search cycle、retrieval evaluator は、回答に採用できる根拠だけを選び、採用できない場合は再検索、context expansion、回答不能に流す。

### Acceptance criteria
- AC-SRCH-002

### Related specifications
- SPEC-SRCH-002

## REQ-DBG-002: Debug trace artifact は時系列再現と redaction を両立する

- Type: security / operations
- Actor: `SYSTEM_ADMIN`
- Priority: medium
- Confidence: confirmed
- Source: TASK-018, AC-DBG-002

### Description
管理者は trace timeline、sentence assessments、finalEvidence、JSON/Markdown artifact を取得できるが、artifact は redaction 済みでなければならない。

### Acceptance criteria
- AC-DBG-002

### Related specifications
- SPEC-DBG-002

## REQ-BENCH-002: dataset adapter と metrics は dataset をまたいで比較可能にする

- Type: evaluation / operations
- Actor: `BENCHMARK_OPERATOR`, `BENCHMARK_RUNNER`
- Priority: medium
- Confidence: confirmed
- Source: TASK-019, AC-BENCH-002

### Description
Allganize、MMRAG DocQA、NeoAI などの dataset は、source context、expected answer、skip reason、metrics、artifact を一貫した形式へ正規化する。

### Acceptance criteria
- AC-BENCH-002

### Related specifications
- SPEC-BENCH-002

## REQ-BENCH-003: Benchmark 実行は timeout・cost・artifact を運用管理できる

- Type: operations / reliability
- Actor: `BENCHMARK_OPERATOR`, Ops
- Priority: medium
- Confidence: confirmed
- Source: TASK-020, AC-BENCH-003

### Description
長時間 benchmark は timeout、progress、metrics、raw results、cost/anomaly/tag guard により運用可能に追跡する。

### Acceptance criteria
- AC-BENCH-003

### Related specifications
- SPEC-BENCH-003

## REQ-DOCS-001: 作業レポートは仕様化対象と対象外を分けて扱う

- Type: documentation / traceability
- Actor: Codex agent, reviewer
- Priority: medium
- Confidence: confirmed
- Source: TASK-023, TASK-024, AC-DOCS-001, FACT-026

### Description
作業レポート本文全量から product behavior に関係する情報だけを facts/tasks/AC/REQ/SPEC に抽出し、commit/PR/merge only のレポートは process evidence として分類する。各 report には `RPT-*` ID を付け、関連 task へ trace できるようにする。

### Acceptance criteria
- AC-DOCS-001

### Related specifications
- SPEC-DOCS-001
