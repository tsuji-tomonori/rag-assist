# 作業完了レポート

保存先: `reports/working/20260505-2316-policy-extraction-guards.md`

## 1. 受けた指示

- LLM policy extraction 方針は維持しつつ、マージ前に deterministic guard を追加する。
- `questionTarget.amountText` が元質問に存在することを検証する。
- `condition.thresholdText` が根拠 quote に存在することを検証する。
- `sourceChunkId` の `<chunk id>` / `chunkId` 曖昧性を避ける。
- `allowed` / `eligible` 系 effect の `satisfiesCondition=false` 表示規約を補強する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 質問金額表記が元質問に含まれる場合だけ computed fact 化する | 高 | 対応 |
| R2 | 閾値金額表記が quote に含まれる場合だけ computed fact 化する | 高 | 対応 |
| R3 | `sourceChunkId` は `<chunk id>` を優先し、fallback 時も quote を持つ chunk だけ選ぶ | 中 | 対応 |
| R4 | `allowed` / `not_allowed` / `eligible` / `not_eligible` の false 条件規約を補強する | 中 | 対応 |
| R5 | 回帰テストと設計文書を更新する | 高 | 対応 |

## 3. 検討・判断したこと

- `amountValue` だけを信頼すると LLM の金額取り違えを検出できないため、MVP では `amountText` の質問内存在を必須にした。
- `thresholdValue` だけを信頼すると quote にない閾値で比較できてしまうため、`thresholdText` の quote 内存在を必須にした。
- `sourceChunkId` はまず context XML の `<chunk id>` に完全一致する chunk を探し、見つからない場合だけ `metadata.chunkId` と quote の同時一致へ fallback する方針にした。
- effect false の最終表示は、回答 LLM が肯定へ倒さないよう prompt と mock の両方で明示した。

## 4. 実施した作業

- `policyExtractionToComputedFacts` に元質問を渡すよう node 呼び出しを変更した。
- `questionTarget.amountText` と `condition.thresholdText` の provenance guard を追加した。
- quote を持つ chunk を選ぶ `findChunkForQuote` に変更した。
- `sourceChunkId` を computed fact 上では unique な `chunk.key` として保持するようにした。
- `POLICY_COMPUTATION_EXTRACTION_JSON` prompt に sourceChunkId / amountText / thresholdText の抽出制約を追加した。
- final answer prompt と mock answer に effect false 条件の表示規約を追加した。
- `policy-computation.test.ts` に P1/P2 の回帰テストを追加した。
- 設計文書に provenance guard と chunk 解決方針を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.ts` | TypeScript | 金額表記 provenance と quote-bearing chunk guard | R1-R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/extract-policy-computations.ts` | TypeScript | 元質問を deterministic 変換へ渡す | R1 |
| `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts` | TypeScript | extraction / final answer prompt の guard 規約 | R1-R4 |
| `memorag-bedrock-mvp/apps/api/src/adapters/mock-bedrock.ts` | TypeScript | policy extraction mock と effect false 回答の補正 | R3-R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.test.ts` | TypeScript test | P1/P2 guard の回帰テスト | R1-R5 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md` | Markdown | 設計 guard の追記 | R5 |

## 6. 検証

- `./node_modules/.bin/tsx --test apps/api/src/agent/policy-computation.test.ts apps/api/src/agent/graph.test.ts apps/api/src/agent/nodes/node-units.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass（124 tests）
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass
- `pre-commit run --files <changed-files>`: pass
- mock service で `benchmark/corpus/standard-agent-v1/handbook.md` を ingest し、「5200円の経費精算では領収書いる?」が `llm_policy_extraction` 由来の `threshold_comparison` で answerable になることを確認した。

## 7. 指示へのfit評価

総合fit: 5.0 / 5.0（約100%）

理由: 指摘された P1 2 件を deterministic guard として実装し、P2 の曖昧性・表示規約も同じ変更範囲で補強した。

## 8. 未対応・制約・リスク

- 複雑な複合条件の自然文解釈は LLM extraction 側に委ねる。deterministic guard は抽出値の provenance と検算に限定している。
