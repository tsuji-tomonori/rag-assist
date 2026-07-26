# Issue #359 Phase B2: session-local evidence RAG integration

- 状態: do
- タスク種別: 機能追加
- base: Phase B1 PR head
- 関連 PR: `#338`
- branch: `codex/issue-359-rag-integration`
- worktree: `.worktrees/issue-359-rag-integration`
- 開始日: 2026-07-17

## 実装計画

1. current Chat/Search scopeとB1 `sessionDocumentContext`の接続点、retrieval・answer・traceの認可再評価点を確認する。
2. authoritative contextからbounded normalized scopeを作り、single-scope互換とclient-only scope拒否を実装する。
3. retrieval時とanswer確定前のcurrent authorization、citation anchor、abstention、safe traceを実装する。
4. RAG docs/generated docsを同期し、targeted/full API、root verify、GitHub Actionsで検証する。

## ドキュメント保守計画

- FR-067とRAG design/APIにauthoritative context優先、再認可、abstention、bounded traceを追記する。
- OpenAPI/source-backed docsはpublic contract変更が発生した場合だけ生成更新する。

## PRレビュー観点

- B1 tenant/user/session ownershipとterminal stateを弱めていないこと。
- assistant本文や権限外citationを根拠へ昇格しないこと。
- client-only temporary scope、revoked/expired evidence、途中失効がanswer/citationへ残らないこと。
- traceが内部ID・policy・権限外存在を列挙しないこと。

## 目的

Phase B1 の authoritative session contextをRAG orchestrationへ接続し、毎ターンのscope normalization、current evidence reauthorization、follow-up anchor、answer/citation/traceを安全に統合する。

## 受け入れ条件

- [x] MT-TEMP-001〜006 のRAG側: active temporary scope継承、base scope合成、複数scope、removed、TTL、session/user/tenant mismatchをnormalization testで検証する。
- [x] normalizationはB1 authoritative contextを読み、client requestだけでtemporary scopeを追加・復活できない。
- [x] MT-CONTEXT-001〜006: previous citation anchorはsource document/chunk由来で、assistant本文、expired/revoked/unauthorized evidenceを根拠にしない。
- [x] MT-RETRIEVE-001〜006: temporary/ordinary scope合成、current authorization、tenant/user/session isolation、revocation後denyをretriever/orchestration testで検証する。
- [x] current evidence reauthorizationはretrieval時とanswer確定前に適用し、途中revocationをcitation/answerから除外する。
- [x] MT-ANSWER-001〜004: answer/citationは許可済みsourceだけにgroundingされ、insufficient evidenceは正直にabstainする。
- [x] MT-TRACE-001〜003: user-safe traceはnormalize/deny理由を記録するが、権限外存在、tenant/user/session ID、内部policyを列挙しない。
- [x] old single `temporaryScopeId` client互換とnew authoritative contextの優先規則をcontract testで固定する。
- [x] RAG REQ/DES/API、OpenAPI/source-backed docs、requirements coverageを同期する。
- [ ] targeted RAG/security/contract test、typecheck、docs check、root CI、GitHub Actions final-head CIが成功する。
- [ ] Phase B1 head向けstacked draft PR、受け入れ条件comment、self-review、task/report lifecycleを完了する。

## 実施結果（PR作成前）

- B1 `sessionDocumentContext` と current manifest を入力に、通常 scope と最大20件の temporary scope を合成する正規化を実装した。21件以上の public input はschemaで拒否し、内部防御でも `scope_limit_exceeded` と denied countを記録する。
- `/chat`、`/chat-runs`、`/search` を authoritative contextへ接続した。`/search` は `conversationId` がない場合に client-only temporary scopeを採用しない。
- lexical/semantic/memory retrieval と revocation cleanupを複数 temporary scopeへ対応させ、回答/citation確定前は current manifest と最新B1 contextを再読する。
- 保存済みcitation memoryは current permission と実在source document/chunkを確認してからfollow-up anchorへ変換し、client citationとassistant本文は根拠に使わない。
- user-safe traceのsession identifier・citation identifier列挙をやめ、件数とbounded reason codeだけを残した。

## 検証（PR作成前）

- focused RAG/security/contract/coverage tests: success
- `npm run typecheck -w @memorag-mvp/api`: success
- `task docs:check`: success
- `task verify`: success（lint、全workspace typecheck/build）
- `npm test -w @memorag-mvp/api`: success（810 tests）
- sandbox内full API testの初回はserver/tsx IPC socket作成が`EPERM`となった。sandbox外の同一固定scriptを確認付きで再実行し810/810成功した。
- GitHub Actions final-head CI: PR作成後に確認する。

## 対象外

- context store/API ownership contractの再設計。B1へ返す。
- Web UI/history restore。Phase Cで扱う。
- #338 close/merge、deploy/release。
