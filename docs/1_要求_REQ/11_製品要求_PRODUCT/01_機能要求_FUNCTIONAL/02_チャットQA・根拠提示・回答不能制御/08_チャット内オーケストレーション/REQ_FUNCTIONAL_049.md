# FR-049 チャット内オーケストレーション

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/spec/2026-chapter-spec.md` 4B 章
- FR-049: チャット内の RAG 検索、回答生成、ツール実行、回答不能判定を `ChatOrchestrationRun` として扱い、非同期エージェント実行とは別の同期チャット処理として管理できること。

## 要求

チャット内の RAG 検索、回答生成、ツール実行、回答不能判定を `ChatOrchestrationRun` として扱い、非同期エージェント実行とは別の同期チャット処理として管理できること。

## 受け入れ条件

- [ ] 旧 `AgentRun` 相当の同期チャット処理が `ChatOrchestrationRun` として trace / store / contract 上で参照できる。
- [ ] チャット内 tool 実行は実行ユーザーの feature permission と resource permission を超えない。
- [ ] 既存の grounded refusal、citation validation、answer support verification の挙動を維持する。

## 備考

Phase D / F で詳細化する。
