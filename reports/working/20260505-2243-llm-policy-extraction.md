# 作業完了レポート

保存先: `reports/working/20260505-2243-llm-policy-extraction.md`

## 1. 受けた指示

- `threshold_comparison` を regex / heuristic parser で作る方針を改める。
- 自然文理解は LLM、数値比較・JSON 検証・根拠照合は deterministic code に分離する。
- retrieval / rerank 後に LLM-based policy extraction node を追加する。
- `execute_computation_tools` は deterministic computation layer として維持する。
- 曖昧、低 confidence、quote 不一致、質問要件不一致の場合は computed fact を生成しない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | rule-based threshold parser を撤去する | 高 | 対応 |
| R2 | `extract_policy_computations` node を追加する | 高 | 対応 |
| R3 | LLM extraction JSON を schema / quote / JPY / comparator / confidence で検証する | 高 | 対応 |
| R4 | 通過した extraction だけを `threshold_comparison` に変換する | 高 | 対応 |
| R5 | `effect` を追加し、必要/不要以外にも拡張できる形にする | 中 | 対応 |
| R6 | prompt、mock、テスト、設計文書を更新する | 高 | 対応 |
| R7 | 検証して PR に反映する | 高 | 対応 |

## 3. 検討・判断したこと

- 質問金額、条件句、必要/不要、対象語の自然文解釈は LLM extraction prompt に移した。
- deterministic code は、LLM 出力を信用しすぎないために quote が selected chunk に存在すること、金額が JPY として正規化可能なこと、`matchesQuestion` と confidence が十分であることを必須にした。
- `threshold_comparison` は `source: "llm_policy_extraction"` と `effect` を持つ computed fact に拡張した。
- `execute_computation_tools` は selected chunks を受け取らない形に戻し、日付・算術・未対応 index 判定の deterministic layer とした。

## 4. 実施した作業

- `extract_policy_computations` node を追加し、RAG の `rerank_chunks` 後に実行するよう graph を更新した。
- `PolicyComputationExtractionSchema` と `policyExtractionToComputedFacts` を追加した。
- rule-based threshold parser 関数群を `computation.ts` から削除した。
- final answer / sufficient context / support verification prompt を `effect` ベースに更新した。
- mock model に `POLICY_COMPUTATION_EXTRACTION_JSON` の固定抽出応答を追加した。
- `policy-computation.test.ts` を追加し、prompt 契約、quote 不一致、低 confidence、質問要件不一致、曖昧条件の破棄を検証した。
- graph の E2E テストを `extract_policy_computations` trace に合わせて更新した。
- Computation Layer 設計文書を LLM extraction + deterministic validation/comparison の責務分離に更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/extract-policy-computations.ts` | TypeScript | LLM-based policy extraction node | R2 |
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.ts` | TypeScript | extraction JSON 検証と deterministic threshold fact 変換 | R3-R5 |
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | rule-based threshold parser 撤去、deterministic layer 化 | R1 |
| `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts` | TypeScript | extraction prompt と effect ベース回答規約 | R2-R6 |
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.test.ts` | TypeScript test | extraction 契約と deterministic guard の単体テスト | R3-R6 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md` | Markdown | 設計方針の更新 | R6 |

## 6. 検証

- `./node_modules/.bin/tsx --test apps/api/src/agent/computation.test.ts apps/api/src/agent/policy-computation.test.ts apps/api/src/agent/graph.test.ts apps/api/src/agent/nodes/node-units.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `npm --prefix memorag-bedrock-mvp exec -w @memorag-mvp/api -- tsx --test src/contract/api-contract.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: 初回は contract server readiness で 8 件失敗、再実行で 122 tests pass
- mock service で `benchmark/corpus/standard-agent-v1/handbook.md` を ingest し、「5200円の経費精算では領収書いる?」が `llm_policy_extraction` 由来の `threshold_comparison` で answerable になることを確認した。

## 7. 指示へのfit評価

総合fit: 5.0 / 5.0（約100%）

理由: 指示された設計分担に合わせて、自然文 rule-based threshold parser を撤去し、LLM extraction node と deterministic validation/comparison に切り替えた。テスト、prompt、mock、設計文書、対象 corpus 確認まで実施した。

## 8. 未対応・制約・リスク

- MVP の対象は JPY 金額閾値条件と、selected chunks 内に quote が実在する明示条件に限定している。
- 複雑な AND / OR 条件、日付条件との複合、部署別 scope conflict、原則/例外の完全な優先順位解釈は未対応。曖昧な extraction は computed fact を作らず不回答寄りに倒す。
