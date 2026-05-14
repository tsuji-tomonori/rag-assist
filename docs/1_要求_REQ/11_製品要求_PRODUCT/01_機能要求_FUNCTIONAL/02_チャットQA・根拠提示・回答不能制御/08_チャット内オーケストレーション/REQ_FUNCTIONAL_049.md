# FR-049 チャット内オーケストレーション

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/spec/2026-chapter-spec.md` 4B 章
- 補助調査: `docs/spec/gap-phase-f.md`
- FR-049: チャット内の RAG 検索、回答生成、ツール実行、回答不能判定を `ChatOrchestrationRun` として扱い、非同期エージェント実行とは別の同期チャット処理として管理できること。

## 要求

チャット内の RAG 検索、回答生成、ツール実行、回答不能判定を `ChatOrchestrationRun` として扱い、非同期エージェント実行とは別の同期チャット処理として管理できること。

Phase F では、上記に加えて仕様 4A/4B の `ChatToolDefinition` registry と multi-turn 状態を扱う。現行 `chat-orchestration` graph node は内部 pipeline step であり、`toolId` / permission / approval / audit metadata を持つ registry とは別概念として整理する。

## Phase F-pre 調査結果

- `apps/api/src/chat-orchestration/` には RAG pipeline、`decontextualizedQuery`、previous citation anchoring、RequiredFact、answerability / sufficient context / citation / support verification が部分実装されている。
- `ChatToolDefinition` / `ChatToolInvocation` の schema、registry、toolId ごとの認可・承認・監査 metadata は未実装。
- conversation history store は raw `messages` 中心で、仕様 4A の `rollingSummary`、`queryFocusedSummary`、`citationMemory`、`taskState` は永続化されていない。
- 後続実装では ChatRAG follow-up 軽量化、required fact planning 汎化、policy computation 汎化、answer support verification、minScore filter、diversity、context budget を踏襲する。

## 受け入れ条件

- [ ] 旧 `AgentRun` 相当の同期チャット処理が `ChatOrchestrationRun` として trace / store / contract 上で参照できる。
- [ ] チャット内 tool 実行は実行ユーザーの feature permission と resource permission を超えない。
- [ ] `ChatToolDefinition` は `toolId`、入出力 schema、必要 feature permission、必要 resource permission、承認要否、監査要否、有効状態を持つ。
- [ ] `ChatToolInvocation` は実行者、toolId、入出力概要、状態、承認、時刻、結果を監査可能にする。
- [ ] multi-turn 状態は raw messages だけに依存せず、文脈独立化クエリ、rolling summary、query-focused summary、citation memory、task state の保存方針を持つ。
- [ ] 既存の grounded refusal、citation validation、answer support verification の挙動を維持する。

## 備考

Phase D / F で詳細化する。
