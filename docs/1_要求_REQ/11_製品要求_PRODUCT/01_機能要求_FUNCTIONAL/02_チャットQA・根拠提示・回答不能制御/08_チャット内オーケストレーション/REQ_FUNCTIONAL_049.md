# FR-049 チャット内オーケストレーション

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` 4B 章
- 補助調査: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md`
- FR-049: チャット内の RAG 検索、回答生成、ツール実行、回答不能判定を `ChatOrchestrationRun` として扱い、非同期エージェント実行とは別の同期チャット処理として管理できること。

## 要求

チャット内の RAG 検索、回答生成、ツール実行、回答不能判定を `ChatOrchestrationRun` として扱い、非同期エージェント実行とは別の同期チャット処理として管理できること。

Phase F では、上記に加えて仕様 4A/4B の `ChatToolDefinition` registry と multi-turn 状態を扱う。現行 `chat-orchestration` graph node は内部 pipeline step であり、`toolId` / permission / approval / audit metadata を持つ registry とは別概念として整理する。

## 現行実装状況

- `apps/api/src/chat-orchestration/` には RAG pipeline、`decontextualizedQuery`、previous citation anchoring、RequiredFact、answerability / sufficient context / citation / support verification が部分実装されている。
- `ChatToolDefinition` / `ChatToolInvocation` の schema と registry があり、enabled graph-backed RAG tool は既存 trace から監査 metadata へ投影される。
- enabled graph-backed RAG tool の required feature permission は、現行 sync / async chat authorization boundary と同じ正規 `ApplicationPermission` の `chat:create` を明示する。helper は unknown permission の default を持たず、catalog membership と `CHAT_USER` grant を test する。
- chat route / worker は `chat:create` と search-scope resource authorization を再検証する。mapped enabled graph tool は node body の直前に registry definition を全件検証し、同じ feature/resource contract を重複排除したうえで、現在 identity の `requiredFeaturePermission` と現在 search scope の `readOnly` authorization を sync / async の共通 semantics で再検証する。
- missing / disabled / approval-required / unknown feature permission / unsupported resource permission の tool contract は node body より前に fail closed となる。一方、拒否を `ChatToolInvocation` status / trace として永続化する経路、approval workflow、future tool executor は未実装である。
- conversation history store は raw `messages` 中心で、仕様 4A の `rollingSummary`、`queryFocusedSummary`、`citationMemory`、`taskState` は永続化されていない。
- 後続実装では ChatRAG follow-up 軽量化、required fact planning 汎化、policy computation 汎化、answer support verification、minScore filter、diversity、context budget を踏襲する。

## 受け入れ条件

- [ ] 旧 `AgentRun` 相当の同期チャット処理が `ChatOrchestrationRun` として trace / store / contract 上で参照できる。
- [x] enabled graph-backed tool は mapped node の実行直前に、registry が宣言する現在の feature permission と `readOnly` resource permission を再検証し、権限を失った node の body / output を実行しない。
- [x] 同一 node に複数の enabled tool が対応する場合も definition を全件検証し、等価な feature/resource authorization contract の評価だけを 1 回へ重複排除する。
- [ ] future / disabled tool の executor は feature/resource permission、approval、credential 境界を実行時に強制する。
- [ ] tool permission 拒否は sanitize された `ChatToolInvocation` status / trace として監査可能に永続化される。
- [x] `ChatToolDefinition` は `toolId`、入出力 schema、必要 feature permission、必要 resource permission、承認要否、監査要否、有効状態を持ち、enabled tool の feature permission は正規 application permission catalog と一致する。
- [x] `ChatToolInvocation` は実行者、toolId、入出力概要、状態、承認、時刻、結果を監査可能にする。
- [x] multi-turn 状態は raw messages だけに依存せず、文脈独立化クエリ、rolling summary、query-focused summary、citation memory、task state の保存方針を持つ。
- [ ] 既存の grounded refusal、citation validation、answer support verification の挙動を維持する。

## 備考

Phase D / F で同期チャット処理の名称移行、tool registry、multi-turn optional state の基盤を追加した。Issue #358 の bounded units で enabled tool の feature permission metadata を `chat:create` へ正規化し、mapped graph node の pre-node current authorization へ接続した。これは enabled graph-backed tool の runtime gate に限定され、future / disabled tool executor、承認 UI、専用 invocation store、拒否 trace の完了とは扱わない。
