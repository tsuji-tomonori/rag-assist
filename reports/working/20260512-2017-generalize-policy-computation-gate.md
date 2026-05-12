# Policy computation gate 汎化 作業レポート

## 指示

- PR #272 merge 後の残差業として、policy computation の実行判定を「ルールベース」ではなく汎化する。
- 固定語彙・金額特化の判定に寄せず、既存の改善効果は維持する。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | `graph.ts` の固定語彙 / 金額特化 gate を除去する | 対応 |
| R2 | ChatRAG follow-up で `extract_policy_computations` skip を維持する | 対応 |
| R3 | policy threshold / decision 系で抽出を維持する | 対応 |
| R4 | benchmark 固有語句や dataset 固有分岐を入れない | 対応 |
| R5 | 関連 docs を更新する | 対応 |
| R6 | 変更範囲に見合う検証を実行する | 対応 |

## 検討・判断

- `extract_policy_computations` 本体は LLM 構造化抽出と deterministic validation で守られているため、今回の主対象は実行前 gate に限定した。
- 旧実装は日本語可否語、金額単位、文書内金額条件 regex に依存しており、非金額・非日本語・別業務の policy comparison に拡張しづらかった。
- 常時実行に戻すと通常 RAG 質問の latency 改善を失うため、`toolIntent`、`searchPlan.requiredFacts`、質問と selected chunk の比較可能な値 signal で候補を絞る方針にした。

## 実施作業

- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
  - `hasPolicyComputationCue` / `isDocumentThresholdComparisonQuestion` を削除。
  - policy computation gate を `hasStructuredPolicyComputationSignal` に置換。
  - arithmetic / aggregation intent は従来どおり抽出対象、temporal / deadline intent は従来どおり対象外にした。
  - fallback 判定は `RequiredFact.factType` と、質問・根拠内の数値/割合/通貨記号/比較演算子の構造 signal の互換性で判断するようにした。
- `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md`
  - policy computation 抽出条件の説明を、金額・閾値・可否語ではなく intent / required fact / 比較可能な値 signal ベースに更新。
- `tasks/do/20260512-2007-generalize-policy-computation-gate.md`
  - なぜなぜ分析、受け入れ条件、検証結果を記録。

## 検証

- `npm ci`: pass。
  - 既存依存について `npm audit` が 1 moderate / 2 high を報告。今回の変更とは別件。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass。211 tests pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。
- `pre-commit run --files memorag-bedrock-mvp/apps/api/src/agent/graph.ts 'memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md' tasks/do/20260512-2007-generalize-policy-computation-gate.md`: pass。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/graph.ts` | policy computation gate 汎化 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md` | 設計説明更新 |
| `tasks/do/20260512-2007-generalize-policy-computation-gate.md` | task / RCA / 受け入れ条件 |
| `reports/working/20260512-2017-generalize-policy-computation-gate.md` | 本レポート |

## Fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: 固定語彙・金額特化 gate を除去し、既存 regression を API 全体テストで確認した。残るリスクは、`RequiredFact.factType` 自体の生成には既存 planner の rule が一部残る点。ただし今回の指示対象だった policy computation 実行前 gate からは固定語彙・金額特化 regex を外している。

## 未対応・制約・リスク

- 未対応: 既存の `planStructuredFacts` / `question-requirements.ts` の rule-based requirement detection は今回のスコープ外。
- 制約: 実 API / benchmark runner の再実行は行っていない。unit / graph / contract を含む API test で確認した。
- リスク: 比較可能な値 signal が広すぎる場合、amount / condition fact の質問で `extract_policy_computations` がやや増える可能性がある。抽出後は schema / quote / comparator validation で computed fact 生成を制限する。
