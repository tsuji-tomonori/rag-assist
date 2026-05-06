# Typed Claim Extraction による Conflict 判定

保存先: `tasks/todo/20260506-1203-typed-claim-conflict.md`

## 状態

- todo

## 背景

`retrieval-evaluator.ts` の value mismatch は deadline / money の正規表現に限定されている。現行制度、旧制度、適用期間、部署、対象条件などの scope 差分を扱うには、値だけではなく claim の subject / predicate / scope を構造化する必要がある。

## 目的

evidence sentence から typed claim を抽出し、同一 subject / predicate / scope で排他的な value がある場合だけ conflict candidate として扱う。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/agent/nodes/retrieval-evaluator.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/state.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts`
- benchmark fact-slot datasets / graph tests as needed

## 方針

- `Claim` schema を追加し、`subject`、`predicate`、`value`、`unit`、`scope`、`effectiveDate`、`sourceChunkId` を表現する。
- 既存の deadline / money regex は fallback extractor として保持する。
- v1 の claim extraction は deterministic extractor を主にし、LLM は conflict candidate の最終確認に限定して全件呼び出しを避ける。
- v1 の extractor 対象は `date`、`money`、`duration`、`count`、`status`、`version`、`condition` を推奨初期範囲とする。
- scope が異なる claim は conflict ではなく no-conflict candidate として trace に残す。
- claim schema は内部 state / trace の optional field として導入し、公開 API / benchmark result の既存 required field は変更しない。

## 必要情報

- 前提タスク:
  - `tasks/todo/20260506-1203-structured-fact-planning.md`
  - `tasks/todo/20260506-1203-rag-policy-profile.md`
- 関連既存レポート:
  - `reports/working/20260502-1517-value-mismatch-judge.md`
  - `reports/working/20260502-1457-retrieval-evaluator-review-fix.md`
- 関連要求・設計:
  - `FR-014`, `FR-015`, `FR-016`, `FR-017`, `FR-019`
  - `SQ-001`, `NFR-010`
  - `ASR-GUARD-001`, `ASR-EVAL-001`, `ASR-SEC-*`

## 実行計画

1. `Claim` と `ConflictCandidate` の schema を設計する。
2. 既存 deadline / money 抽出を claim extractor に包む。
3. evidence sentence ごとに claim を抽出し、fact id と紐づける。
4. conflict 判定を normalized value 比較から claim scope 比較へ移す。
5. LLM judge prompt を claim / candidate 入力に更新する。
6. old/current、部署違い、適用期間違い、同一 scope mismatch のテストを追加する。
7. benchmark fact slot または node test に conflicting evidence と scope-different no-conflict のケースを追加する。
8. debug trace に claims と conflict candidate summary を出す。

## ドキュメントメンテナンス計画

- 要求仕様: `FR-014`、`FR-015`、`FR-016`、`FR-017`、`FR-019`、`SQ-001` について、conflicting evidence、unsupported citation、claim scope 判定の受け入れ条件更新要否を確認する。
- architecture / design: claim / conflict candidate schema、retrieval evaluator、support verifier、debug trace の責務を該当 DLD と `DES_DATA_001` に反映する。
- README / API examples / OpenAPI: claim / conflict summary が optional trace field として出る場合は OpenAPI / API examples / debug trace docs を更新する。既存 required schema を変えない場合は後方互換を PR 本文に書く。
- benchmark / operations: fact slot dataset、baseline comparison、LLM judge の呼び出し条件、cost / latency 影響を benchmark docs または operations docs に追記する。
- PR 本文: 同一 scope conflict と scope-different no-conflict の扱い、LLM 呼び出し条件、docs 更新範囲、未確認 benchmark を明記する。

## 受け入れ条件

- 同一 scope の排他的な値は conflict candidate になる。
- 旧制度 / 現行制度など scope が違う値は、直ちに conflict 扱いされない。
- deadline / money の既存 mismatch テストが維持される。
- conflict 判定理由に claim の subject / predicate / scope が含まれる。
- LLM judge 呼び出しは risk signal がある場合に限定される。
- claim / conflict の追加 field は optional で、既存 API / benchmark output の required schema を壊さない。
- conflicting evidence、unsupported citation、no-answer の regression test がある。
- trace に conflict summary が残り、raw prompt や機密 chunk text を通常利用者へ露出しない。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/agent/graph.test.ts`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`
- 必要に応じて `task benchmark:sample`
- `git diff --check`

## PRレビュー観点

- semver は、内部 conflict 判定強化と optional trace 追加なら `patch`、benchmark dataset / output schema に新 optional profile field を追加するなら `minor` を推奨する。
- PR 本文に conflict 判定の対象 fact type、LLM 呼び出し条件、latency / cost 影響、未確認 benchmark を書く。
- 同一 scope mismatch と scope-different no-conflict を混同していないか確認する。
- answerability gate、retrieval evaluator、support verifier の責務が混ざっていないか確認する。
- debug trace / benchmark artifact に raw prompt、internal memo、ACL metadata、過剰な chunk text が出ないか確認する。
- benchmark では refusal precision、unsupported rate、citation hit rate、conflicting evidence ケースを見る。

## 未決事項・リスク

- 未決事項なし。
- 決定事項: v1 では claim extraction を deterministic 主体にし、LLM は conflict candidate の最終確認に限定する。
- 決定事項: v1 の deterministic extractor は `date`、`money`、`duration`、`count`、`status`、`version`、`condition` から始める。
- 決定事項: claim schema は optional field として追加し、既存 API / benchmark result の required schema は変えない。
- リスク: extractor 対象を広げるほど保守負荷が増えるため、新 fact type は test fixture と benchmark case を追加できる場合だけ増やす。
