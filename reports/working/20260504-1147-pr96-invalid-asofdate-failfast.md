# PR #96 invalid asOfDate fail-fast 追加対応

## 受けた指示
- PR #96 最新 head `2b199127...` の再レビューで指摘された invalid `asOfDate` の graph 全体 fail-fast 不成立を修正する。
- invalid `asOfDate` がある場合に RAG retrieval / search へ進まない graph level test を追加する。

## 要件整理
- `buildTemporalContext()` 単体の throw だけでなく、agent graph 全体として fail-fast すること。
- `build_temporal_context` の error trace に invalid `asOfDate` の詳細を残すこと。
- invalid temporal context 後に `retrieve_memory` / `execute_search_action` へ進まないこと。
- docs / report / PR 本文に実際の挙動を反映すること。

## 検討・判断
- `tracedNode` は例外を state に変換するため、`build_temporal_context` 直後に terminal check を追加した。
- `build_temporal_context` の例外は `answerability.reason: "invalid_temporal_context"` として扱い、通常の citation validation failure と区別した。
- `buildTemporalContext()` pure function の throw は維持し、graph では trace を残して `finalize_refusal` に流す設計にした。

## 実施作業
- `AnswerabilitySchema` に `invalid_temporal_context` reason を追加した。
- `tracedNode` の `build_temporal_context` error を `invalid_temporal_context` として記録するようにした。
- graph で `build_temporal_context` 後に `invalid_temporal_context` を検出した場合、即 `finalize_refusal` へ進むようにした。
- invalid `asOfDate` の graph level regression test を追加した。
- 詳細設計 docs に graph fail-fast と `invalid_temporal_context` reason を追記した。

## 成果物
- `memorag-bedrock-mvp/apps/api/src/agent/state.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/trace.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts`
- `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md`

## 検証
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: 成功
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts`: 成功（script の glob により API 全 87 tests を実行）

## Fit 評価
- 指摘された「server date に fallback しないが graph が続行する」問題は、`build_temporal_context` 直後の terminal check で解消した。
- 追加テストで invalid `asOfDate` 時に `retrieve_memory` / `execute_search_action` が実行されないことを確認した。

## 未対応・制約・リスク
- `calculation_unavailable` を `isAnswerable=true` と扱う方針は既存の dedicated reason 設計を維持しており、benchmark 側での扱い整理は別作業。
- `nowIso` の UTC / `+09:00` 表現揺れは今回の correctness 修正範囲外。
