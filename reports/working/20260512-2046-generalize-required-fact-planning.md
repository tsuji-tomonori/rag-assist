# Required fact planning 汎化 作業レポート

## 指示

- PR #274 merge 後、「次の改善があれば対応して」という依頼を受けた。
- 前回の既知リスクとして残した `planStructuredFacts` / `question-requirements.ts` の rule-based 重複を確認し、実装可能な改善を行う。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | required fact planning の重複した固定 regex 分岐を削減する | 対応 |
| R2 | policy computation gate に必要な `amount` / `condition` fact を維持する | 対応 |
| R3 | ChatRAG follow-up の低情報量 token 逆戻りを防ぐ | 対応 |
| R4 | benchmark expected phrase / dataset 固有分岐を入れない | 対応 |
| R5 | 関連 docs を更新する | 対応 |
| R6 | 変更範囲に見合う検証を実行する | 対応 |

## 検討・判断

- PR #274 では policy computation gate を汎化したが、入力となる `RequiredFact` の生成に `graph.ts` 独自の固定 regex が残っていた。
- いきなり LLM planner 化すると latency、prompt validation、mock、テスト範囲が大きくなるため、今回は hot path の deterministic planner を維持しつつ、slot 判定の入口を `detectQuestionRequirements` に集約した。
- 非 JPY の threshold / policy comparison への拡張余地として、`$75` や `50%` のような構造的数量 signal を amount slot として扱うようにした。

## 実施作業

- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
  - `planStructuredFacts` 内の独自 regex 分岐を削除。
  - `QuestionRequirement` を `RequiredFact` に変換する `factCandidateForRequirement` に集約。
  - `asksForMoney` 直接依存を graph から除去。
- `memorag-bedrock-mvp/apps/api/src/agent/question-requirements.ts`
  - amount / count / procedure / person / condition / classification slot を追加。
  - deadline 系 date label を `期限` として出すようにした。
  - currency symbol / percentage の構造的数量 signal を amount slot として検出。
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts`
  - `$75` と `50%` の amount slot regression を追加。
- `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md`
  - required fact planning は question requirement detector の slot と signal を使い、検索計画側に同じ slot 判定を重複実装しない方針を追記。

## 検証

- `npm ci`: pass。
  - 既存依存について `npm audit` が 1 moderate / 2 high を報告。今回の変更とは別件。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: 初回 fail。
  - `fixed workflow search plan trace records complexity, facts, actions, and stop criteria from input` で deadline fact が落ちたため、deadline slot を question requirement detector 側へ追加して修正。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: 修正後 pass。211 tests pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。
- `pre-commit run --files memorag-bedrock-mvp/apps/api/src/agent/graph.ts memorag-bedrock-mvp/apps/api/src/agent/question-requirements.ts memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts 'memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md' tasks/do/20260512-2036-generalize-required-fact-planning.md`: pass。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/graph.ts` | required fact planning の重複分岐削減 |
| `memorag-bedrock-mvp/apps/api/src/agent/question-requirements.ts` | question requirement slot の拡張 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts` | 構造的数量 signal regression |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md` | 設計方針の同期 |
| `tasks/do/20260512-2036-generalize-required-fact-planning.md` | task / RCA / 受け入れ条件 |
| `reports/working/20260512-2046-generalize-required-fact-planning.md` | 本レポート |

## Fit 評価

総合fit: 4.6 / 5.0（約92%）

理由: 次の改善候補として残っていた required fact planning の重複 rule を削減し、既存 regression と API 全体テストを通した。完全な「rule-based 廃止」ではなく、deterministic hot path の単一入口化と構造 signal 追加に留めたため満点ではない。

## 未対応・制約・リスク

- 未対応: LLM required fact planner の導入は未実施。latency、fallback、schema validation、mock、debug trace の設計が必要なため別タスクが適切。
- 制約: 実 API / benchmark runner の再実行は行っていない。API unit / graph / contract を含む test で確認した。
- リスク: `detectQuestionRequirements` に slot 判定を集約したため、この detector の変更が回答要件 validation と required fact planning の両方に影響する。今後は slot 追加時に両用途の期待をテストで固定する必要がある。
