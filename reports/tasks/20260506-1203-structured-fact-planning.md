# Structured Fact Planning による回答可否判定

保存先: `reports/tasks/20260506-1203-structured-fact-planning.md`

## 背景

`answerability-gate.ts` は質問文に含まれる固定語彙から amount / date / procedure を推定し、根拠文側も正規表現で確認している。この方式では担当者、対象条件、例外、頻度、場所、ステータス、バージョン、適用範囲などの required fact を扱いにくい。

## 目的

質問から required facts と fact type を構造化し、回答可否判定を固定 regex ではなく fact type と evidence support に基づく設計へ移行する。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/state.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/answerability-gate.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/sufficient-context-gate.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts`
- agent node tests / graph tests

## 方針

- `RequiredFact` に `factType`、`subject`、`scope`、`expectedValueType` などの optional structured fields を追加する。
- regex gate は最終判定ではなく fallback / debug signal に落とす。
- sufficient context gate の LLM structured output を主判定に寄せる。
- deterministic extractor は fact type ごとの plug-in として扱う。

## 必要情報

- 前提タスク: `reports/tasks/20260506-1203-rag-policy-profile.md`
- 関連箇所:
  - `answerability-gate.ts`
  - `retrieval-evaluator.ts`
  - `sufficient-context-gate.ts`
- 既存 `RequiredFactSchema` は `agent/state.ts` にある。

## 実行計画

1. `RequiredFact` の拡張フィールドを設計する。
2. 質問 planning prompt または lightweight planner の導入範囲を決める。
3. `extractRequiredFacts` が structured fields を埋めるようにする。
4. `answerability-gate` の固定 regex 判定を段階的に debug signal 化する。
5. `sufficient-context-gate` の prompt / normalize 処理を structured fact に対応させる。
6. amount / date / procedure 既存ケースに加え、person / condition / status などのテストを追加する。
7. trace に required fact の type / scope / support 状態を表示する。

## 受け入れ条件

- `RequiredFact` が fact type と scope を表現できる。
- amount / date / procedure の既存判定が structured fact 経由で維持される。
- fixed regex だけで answerable / unanswerable が確定しない。
- sufficient context gate が structured facts を考慮して判定する。
- debug trace で fact type と判定理由を追える。

## 検証計画

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/nodes/node-units.test.ts`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts`
- `git diff --check`

## 未決事項・リスク

- LLM planner を入れる場合、latency と cost が増える。
- structured fields の schema を厳しくしすぎると、既存の簡易質問で過剰な missing 判定が出る可能性がある。
- planner 失敗時の fallback strategy が必要。
