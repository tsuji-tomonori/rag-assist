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
