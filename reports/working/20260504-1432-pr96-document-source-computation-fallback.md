# 作業完了レポート

保存先: `reports/working/20260504-1432-pr96-document-source-computation-fallback.md`

## 1. 受けた指示

- PR #96 最新 head `ae92142...` のレビュー指摘に対応する。
- document source cue を含む日付・営業日確認質問が compute-only に誤ルーティングされる可能性を解消する。
- `asksDateComputation` / `asksBusinessDayCalculation` を document verification 時は false にする。
- document source cue + `期限切れ` / `営業日` 表現の RAG fallback test を追加する。
- 検証、commit、push、PR 更新まで行う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | document verification 時は date computation intent を compute-only にしない | 高 | 対応 |
| R2 | document verification 時は business day calculation intent を compute-only にしない | 高 | 対応 |
| R3 | 文書 cue のない `2026-05-01期限は期限切れですか？` は compute-only を維持する | 高 | 対応 |
| R4 | document source cue + `期限切れ` / `5営業日以内` の intent test を追加する | 高 | 対応 |
| R5 | graph test で document-source deadline status が RAG に流れることを確認する | 高 | 対応 |
| R6 | API typecheck / test / diff check を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- `資料`、`規程`、`記載` などの document source cue がある場合、質問文に `期限切れ`、`超過`、`5営業日以内` が含まれても、資料上の記載確認として扱う方が安全と判断した。
- 一方、文書 cue のない明示的な期限判定質問は、既存の DateCalculator 対象として維持した。
- 今回の変更は intent routing の局所修正であり、恒久 docs の既存説明と矛盾しないため docs は更新せず、PR 本文と本レポートに反映する方針にした。

## 4. 実施した作業

- `detectToolIntent()` で `asksBusinessDayCalculation` と `asksDateComputation` を `!asksDocumentVerification` 条件付きにした。
- intent test に以下を追加した。
  - `この資料では2026-05-01期限切れと記載されていますか？` は `canAnswerFromQuestionOnly=false` / `needsSearch=true`。
  - `この資料では5営業日以内と記載されていますか？` は `canAnswerFromQuestionOnly=false` / `needsSearch=true`。
- graph test に document-source deadline status 質問が RAG retrieval / search action に進み、`execute_computation_tools` を呼ばないことを確認するケースを追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | document verification 時の date / business day computation intent 抑制 | R1-R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts` | TypeScript test | document source cue + computation 語彙の RAG fallback intent test | R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | TypeScript test | document-source deadline status 質問の RAG route test | R5 |
| `reports/working/20260504-1432-pr96-document-source-computation-fallback.md` | Markdown | 本作業の完了レポート | リポジトリ作業報告要件 |

## 6. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: pass
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts src/agent/computation.test.ts`: pass（script の glob により API 全 98 tests）
- `git diff --check`: pass

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 指摘された date / business day の document-source false positive を抑制した |
| 制約遵守 | 5 | 変更範囲を API intent / tests に限定し、作業レポートを追加した |
| 成果物品質 | 5 | compute-only 維持ケースと RAG fallback ケースを両方 test で固定した |
| 説明責任 | 5 | 判断理由、検証内容、docs 更新不要理由を明記した |

総合fit: 5.0 / 5.0（約100%）

## 8. 未対応・制約・リスク

- `task docs:check` は今回の差分では実行していない。対象は API intent 判定と API test のため、API typecheck / test と `git diff --check` を選択した。
- ルールベース intent 判定は自然文の網羅性に限界があるため、今後も新しい文書確認表現が見つかった場合は回帰テストを追加する必要がある。
