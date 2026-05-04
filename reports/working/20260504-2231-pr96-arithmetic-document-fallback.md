# 作業完了レポート

保存先: `reports/working/20260504-2231-pr96-arithmetic-document-fallback.md`

## 1. 受けた指示

- PR #96 最新 head `0c990525...` のレビュー指摘に対応する。
- 文書確認 cue を含む金額計算質問が compute-only arithmetic に誤ルーティングされる可能性を解消する。
- arithmetic intent でも document verification cue がある場合は compute-only を抑制する。
- `この資料では1,200円を15人で12か月使うと総額いくらと記載されていますか？` の RAG fallback test を追加する。
- 検証、commit、push、PR 更新まで行う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | document verification 時は arithmetic intent を compute-only にしない | 高 | 対応 |
| R2 | 文書 cue のない `1,200円を15人で12か月使うといくら？` は compute-only を維持する | 高 | 対応 |
| R3 | 文書確認 cue + 金額計算語彙の intent test を追加する | 高 | 対応 |
| R4 | graph test で document-source arithmetic verification が RAG に流れることを確認する | 高 | 対応 |
| R5 | API typecheck / test / diff check を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- Phase 1 の Calculator は question-only の明示計算に限定する方針のため、`資料`、`契約書`、`記載`、`合っていますか` などの文書確認 cue がある金額質問は RAG path に戻すのが安全と判断した。
- `資料の金額を使って計算して` のような RAG + Calculator は Phase 2 の `documentEvidence -> NumericFactExtractor -> Calculator` で扱う想定とし、今回の修正では question-only compute-only を抑制する範囲に留めた。
- 恒久 docs の Phase 1 / Phase 2 補足と矛盾しないため docs は更新せず、PR 本文と本レポートに反映する方針にした。

## 4. 実施した作業

- `detectToolIntent()` の arithmetic intent を `!asksDocumentVerification` 条件付きにした。
- intent test に以下を追加した。
  - `1,200円を15人で12か月使うといくら？` は compute-only。
  - `この資料では1,200円を15人で12か月使うと総額いくらと記載されていますか？` は `canAnswerFromQuestionOnly=false` / `needsSearch=true`。
  - `この契約書では1,200円を15人で12か月使うと216,000円で合っていますか？` は `needsSearch=true`。
- graph test に document-source arithmetic verification 質問が RAG retrieval / search action に進み、`execute_computation_tools` を呼ばないことを確認するケースを追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | document verification 時の arithmetic compute-only 抑制 | R1-R2 |
| `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts` | TypeScript test | 金額計算 intent の compute-only / RAG fallback test | R2-R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | TypeScript test | document-source arithmetic verification の RAG route test | R4 |
| `reports/working/20260504-2231-pr96-arithmetic-document-fallback.md` | Markdown | 本作業の完了レポート | リポジトリ作業報告要件 |

## 6. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: pass
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts src/agent/computation.test.ts`: pass（script の glob により API 全 100 tests）
- `git diff --check`: pass

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 指摘された arithmetic の document verification false positive を抑制した |
| 制約遵守 | 5 | 変更範囲を API intent / tests に限定し、作業レポートを追加した |
| 成果物品質 | 5 | compute-only 維持ケースと RAG fallback ケースを両方固定した |
| 説明責任 | 5 | 判断理由、検証内容、docs 更新不要理由を明記した |

総合fit: 5.0 / 5.0（約100%）

## 8. 未対応・制約・リスク

- `task docs:check` は今回の差分では実行していない。対象は API intent 判定と API test のため、API typecheck / test と `git diff --check` を選択した。
- RAG evidence からの数値抽出と Calculator 実行は Phase 2 の範囲として未実装のまま。今回の修正は Phase 1 の question-only compute-only 誤ルーティング防止に限定している。
