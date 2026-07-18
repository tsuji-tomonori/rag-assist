# Issue #359 Phase B2: session-local evidence RAG integration

- 状態: todo
- タスク種別: RAG normalization・reauthorization 実装
- base: Phase B1 PR head
- 関連 PR: `#338`

## 目的

Phase B1 の authoritative session contextをRAG orchestrationへ接続し、毎ターンのscope normalization、current evidence reauthorization、follow-up anchor、answer/citation/traceを安全に統合する。

## 受け入れ条件

- [ ] MT-TEMP-001〜006 のRAG側: active temporary scope継承、base scope合成、複数scope、removed、TTL、session/user/tenant mismatchをnormalization testで検証する。
- [ ] normalizationはB1 authoritative contextを読み、client requestだけでtemporary scopeを追加・復活できない。
- [ ] MT-CONTEXT-001〜006: previous citation anchorはsource document/chunk由来で、assistant本文、expired/revoked/unauthorized evidenceを根拠にしない。
- [ ] MT-RETRIEVE-001〜006: temporary/ordinary scope合成、current authorization、tenant/user/session isolation、revocation後denyをretriever/orchestration testで検証する。
- [ ] current evidence reauthorizationはretrieval時とanswer確定前に適用し、途中revocationをcitation/answerから除外する。
- [ ] MT-ANSWER-001〜004: answer/citationは許可済みsourceだけにgroundingされ、insufficient evidenceは正直にabstainする。
- [ ] MT-TRACE-001〜003: user-safe traceはnormalize/deny理由を記録するが、権限外存在、tenant/user/session ID、内部policyを列挙しない。
- [ ] old single `temporaryScopeId` client互換とnew authoritative contextの優先規則をcontract testで固定する。
- [ ] RAG REQ/DES/API、OpenAPI/source-backed docs、requirements coverageを同期する。
- [ ] targeted RAG/security/contract test、typecheck、docs check、root CI、GitHub Actions final-head CIが成功する。
- [ ] Phase B1 head向けstacked draft PR、受け入れ条件comment、self-review、task/report lifecycleを完了する。

## 対象外

- context store/API ownership contractの再設計。B1へ返す。
- Web UI/history restore。Phase Cで扱う。
- #338 close/merge、deploy/release。
