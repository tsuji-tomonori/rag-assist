# FR-055 API共通 middleware・非同期 worker 契約

- 種別: `REQ_FUNCTIONAL`
- 状態: Draft（部分実装・部分検証）
- 仕様参照: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` 14D 章
- FR-055: CORS、public endpoint、auth middleware、SSE Last-Event-ID、chat / ingest / benchmark / async agent worker の runId 契約を API 共通処理として管理できること。

## 要求

CORS、public endpoint、auth middleware、SSE Last-Event-ID、chat / ingest / benchmark / async agent worker の runId 契約を API 共通処理として管理できること。

## 受け入れ条件

- [x] public endpoint と protected endpoint の境界が middleware と静的 policy test で明示されている。
- [x] chat/ingest SSE 再接続時の `Last-Event-ID` と `runId` 契約が route と contract/security test で検証されている。
- [ ] worker handler は runId を契約として状態・event・artifact を追跡できる。

## 備考

chat/ingest worker は `tenantId` と `runId` を必須にし、benchmark は run lifecycle と artifact を `runId` で追跡する。async agent は `agentRunId` を用いる service-owned lifecycle であり、chat/ingest/benchmark/async agent を横断する一つの worker handler 契約としては未検証である。

## 実装・検証トレース

- `confirmed`: `apps/api/src/app.ts` は `/health` と `/openapi.json` だけを public とし、それ以外へ auth middleware を適用し、CORS に `Last-Event-ID` を許可する。
- `confirmed`: `apps/api/src/routes/chat-routes.ts` と `document-routes.ts` は SSE reconnect の `Last-Event-ID` と path `runId` を扱う。
- `confirmed`: `apps/api/src/contract/chat-run-events-stream.test.ts`、`apps/api/src/security/access-control-policy.test.ts`、`apps/api/src/worker-contract.test.ts` は chat/ingest SSE と worker runId の current contract を検証する。
- `confirmed`: `apps/api/src/routes/benchmark-routes.ts` と `apps/api/src/benchmark-run-authorization-worker.test.ts` は benchmark の runId lifecycle/artifact 境界を検証する。
- `inferred`: async agent の `agentRunId` は同じ追跡目的を持つが、共通 `runId` worker contract と同一とは扱わない。
- `open_question`: 全 worker の状態/event/artifact と idempotency を共通契約にする範囲は `tasks/todo/20260713-2302-api-lifecycle-common-middleware.md` で追跡する。
