# Typed Claim Extraction による Conflict 判定

保存先: `reports/tasks/20260506-1203-typed-claim-conflict.md`

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
- LLM judge は conflict candidate の最終確認に限定し、全件呼び出しは避ける。
- scope が異なる claim は conflict ではなく no-conflict candidate として trace に残す。

## 必要情報

- 前提タスク:
  - `reports/tasks/20260506-1203-structured-fact-planning.md`
  - `reports/tasks/20260506-1203-rag-policy-profile.md`
- 関連既存レポート:
  - `reports/working/20260502-1517-value-mismatch-judge.md`
  - `reports/working/20260502-1457-retrieval-evaluator-review-fix.md`

## 実行計画

1. `Claim` と `ConflictCandidate` の schema を設計する。
2. 既存 deadline / money 抽出を claim extractor に包む。
3. evidence sentence ごとに claim を抽出し、fact id と紐づける。
4. conflict 判定を normalized value 比較から claim scope 比較へ移す。
5. LLM judge prompt を claim / candidate 入力に更新する。
6. old/current、部署違い、適用期間違い、同一 scope mismatch のテストを追加する。
7. debug trace に claims と conflict candidate summary を出す。

## 受け入れ条件

- 同一 scope の排他的な値は conflict candidate になる。
- 旧制度 / 現行制度など scope が違う値は、直ちに conflict 扱いされない。
- deadline / money の既存 mismatch テストが維持される。
- conflict 判定理由に claim の subject / predicate / scope が含まれる。
- LLM judge 呼び出しは risk signal がある場合に限定される。

## 検証計画

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/nodes/node-units.test.ts`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts`
- 必要に応じて `task benchmark:sample`
- `git diff --check`

## 未決事項・リスク

- claim extraction を LLM に寄せる場合、再現性とコストの管理が必要。
- deterministic extractor の対象 fact type を広げるとメンテナンス負荷が増える。
- claim schema は後続の benchmark 評価にも影響するため、破壊的変更を避ける必要がある。
