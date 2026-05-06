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
- v1 では新しい standalone LLM planner を hot path に追加せず、既存の sufficient context gate の structured output と lightweight deterministic planner を主に使う。
- structured fields は optional + confidence 付きにし、欠落だけで即 unanswerable にしない。
- planner が失敗した場合は legacy required facts を fallback とし、fallback 使用を debug trace に残す。
- deterministic extractor は fact type ごとの plug-in として扱う。

## 必要情報

- 前提タスク: `reports/tasks/20260506-1203-rag-policy-profile.md`
- 関連箇所:
  - `answerability-gate.ts`
  - `retrieval-evaluator.ts`
  - `sufficient-context-gate.ts`
- 既存 `RequiredFactSchema` は `agent/state.ts` にある。
- 関連要求・設計:
  - `FR-005`, `FR-014`, `FR-015`, `FR-016`, `FR-017`
  - `SQ-001`, `NFR-010`
  - `ASR-GUARD-001`, `ASR-EVAL-001`, `ASR-SEC-*`

## 実行計画

1. `RequiredFact` の拡張フィールドを設計する。
2. lightweight deterministic planner と existing sufficient context gate の structured output で埋める範囲を実装する。
3. `extractRequiredFacts` が structured fields を埋めるようにする。
4. `answerability-gate` の固定 regex 判定を段階的に debug signal 化する。
5. `sufficient-context-gate` の prompt / normalize 処理を structured fact に対応させる。
6. amount / date / procedure 既存ケースに加え、person / condition / status などのテストを追加する。
7. planner fallback、fact type、scope、support 状態、decision reason を trace に表示する。
8. docs に回答不能制御と trace への影響を反映する。

## ドキュメントメンテナンス計画

- 要求仕様: `FR-014`、`FR-015`、`FR-016`、`FR-017`、`SQ-001` の受け入れ条件へ required facts、fact type、fallback、回答不能制御への影響を反映するか確認する。
- architecture / design: `RequiredFact`、answerability gate、sufficient context gate、debug trace の data / workflow 変更を該当 DLD、`DES_DATA_001`、`DES_API_001` に反映する。
- README / API examples / OpenAPI: optional trace field や debug response schema を追加する場合は OpenAPI / API examples を更新する。通常 `/chat` の必須 field を増やさない場合は、後方互換として更新不要範囲を PR 本文に明記する。
- local verification / operations: no-answer、ambiguous query、required fact 欠落、fallback 発生時の確認観点を `docs/LOCAL_VERIFICATION.md` に追記する。LLM 呼び出しを増やさない v1 方針のため cost / latency 影響が軽微なら operations ではその理由を書く。
- PR 本文: docs 更新の有無、fallback strategy、未実施の benchmark、API / trace schema の互換性を明記する。

## 受け入れ条件

- `RequiredFact` が fact type と scope を表現できる。
- amount / date / procedure の既存判定が structured fact 経由で維持される。
- fixed regex だけで answerable / unanswerable が確定しない。
- sufficient context gate が structured facts を考慮して判定する。
- planner 失敗時は legacy required facts fallback で継続し、fallback 使用が trace に残る。
- debug trace で fact type と判定理由を追える。
- no-answer、ambiguous query、required fact 欠落、根拠不足、unsupported citation の regression test がある。
- API response に optional trace field を追加する場合、既存 client / benchmark runner が壊れない。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/agent/graph.test.ts`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`
- RAG 品質差分がある場合: `task benchmark:sample`
- `git diff --check`

## PRレビュー観点

- semver は、trace schema の optional 追加と内部判定強化なら `patch`、新しい planner / config を利用者が選べるなら `minor` を推奨する。
- PR 本文に、回答不能制御への影響、未確認 benchmark、fallback strategy、latency / cost への影響を書く。
- LLM 判断と deterministic 判定の責務が明確で、regex が最終 gate に残っていないか確認する。
- answerability gate と sufficient context gate の責務が混ざっていないか確認する。
- debug trace に必要な decision reason が残り、raw prompt や機密 chunk text を通常利用者へ露出しないか確認する。
- API / data の optional field 追加が後方互換で、Web / benchmark runner が field 欠落に耐えるか確認する。

## 未決事項・リスク

- 未決事項なし。
- 決定事項: v1 では standalone LLM planner を hot path に追加せず、既存 sufficient context gate と lightweight deterministic planner を使う。
- 決定事項: structured fields は optional + confidence 付きにし、欠落だけでは回答不能にしない。
- 決定事項: planner 失敗時は legacy required facts fallback を使い、trace に `plannerFallback` 相当の signal を残す。
- リスク: structured fact が過剰に細かいと false refusal が増えるため、benchmark で refusal precision と answerable accuracy の両方を見る。
