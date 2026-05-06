# 作業完了レポート

保存先: `reports/working/20260506-1233-pr117-comparator-consequence-guards.md`

## 1. 受けた指示

- PR #117 の最新 head `9af802d` に対する追加レビュー指摘を修正する。
- `comparator` が quote に ground されていない問題を guard する。
- `consequence.target` / `effect` が quote に ground されていない問題を guard する。
- マージ前に検証する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `condition.comparatorText` を schema に追加する | 高 | 対応 |
| R2 | `comparatorText` の quote 内存在と comparator enum の固定対応を検証する | 高 | 対応 |
| R3 | `consequence.targetText` / `effectText` を schema に追加する | 高 | 対応 |
| R4 | `targetText` / `effectText` の quote 内存在を検証する | 高 | 対応 |
| R5 | prompt / mock / tests / design docs を更新する | 中 | 対応 |
| R6 | 関連検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- 今回の修正は自然文 parser を追加するのではなく、LLM 抽出結果の provenance validation として実装した。
- `operatorFromComparatorText` は MVP 固定語彙に限定し、未知表現や enum 不一致は computed fact を生成しない方針にした。
- consequence は `targetText` と `effectText` の exact span を quote に含める契約にし、省略表現を扱う場合は LLM に quote 範囲を広げさせる方針にした。
- mock は、短い clause に target が含まれない場合に chunk 内の広い quote を返すよう調整した。

## 4. 実施した作業

- `PolicyComputationExtractionSchema` に `condition.comparatorText`、`consequence.targetText`、`consequence.effectText` を追加した。
- `policyExtractionToComputedFacts` で comparatorText / targetText / effectText の quote 内存在を確認するようにした。
- `operatorFromComparatorText` を追加し、`以上`、`超`、`以下`、`未満`、`等しい` 系の固定対応だけを許可した。
- `quoteExistsInText` が空文字 span を通さないようにした。
- extraction prompt に新しい provenance 制約と JSON schema 例を追加した。
- mock Bedrock の policy extraction 応答を新 schema に合わせた。
- comparator enum 取り違え、comparatorText quote 不一致、target hallucination、effectText quote 不一致の回帰テストを追加した。
- `DES_DLD_005.md` に comparator / consequence grounding guard を反映した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.ts` | TypeScript | comparator / consequence provenance guard | R1-R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.test.ts` | TypeScript test | P1 追加指摘の回帰テスト | R2, R4 |
| `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts` | TypeScript | LLM 抽出 prompt の schema と制約更新 | R5 |
| `memorag-bedrock-mvp/apps/api/src/adapters/mock-bedrock.ts` | TypeScript | mock extraction 応答の新 schema 対応 | R5 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md` | Markdown | 設計文書の guard 記述更新 | R5 |
| `reports/working/20260506-1233-pr117-comparator-consequence-guards.md` | Markdown | 本作業レポート | R6 |

## 6. 検証

| コマンド | 結果 |
|---|---|
| `./node_modules/.bin/tsx --test apps/api/src/agent/policy-computation.test.ts` | pass: 7 tests |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api` | pass |
| `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api` | pass: 125 tests |
| `npm --prefix memorag-bedrock-mvp run lint` | pass |
| `pre-commit run --files ...` | pass |
| `git diff --check` | pass |

## 7. 指示への fit 評価

総合fit: 5.0 / 5.0（約100%）

理由: 指摘された P1 2 点を schema、deterministic guard、prompt、mock、テスト、設計文書に反映し、対象テストから API 全体テスト、typecheck、lint、pre-commit まで通した。

## 8. 未対応・制約・リスク

- 未対応事項: なし。
- 制約: `comparatorText` の正規化は MVP 固定語彙に限定しており、未知表現は false negative として computed fact を生成しない。
- リスク: LLM が target / effect を quote に含む範囲で抽出できない場合は computed fact が生成されないが、誤回答回避を優先する設計判断である。
