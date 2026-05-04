# 作業完了レポート

保存先: `reports/working/20260505-0029-pr96-self-contained-verification.md`

## 1. 受けた指示

- PR #96 最新 head `dfe8e8a...` のレビュー指摘に対応する。
- `合っていますか` / `正しいですか` が一律 document verification cue として扱われ、自己完結した arithmetic / temporal verification が RAG に誤ルーティングされる問題を修正する。
- 文書 source cue 付き、または fact confirmation pattern の場合だけ document verification とする。
- `1,200円を15人で12か月使うと216,000円で合っていますか？` の compute-only test を追加する。
- 検証、commit、push、PR 更新まで行う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `合っていますか` / `正しいですか` 単独を document verification cue から外す | 高 | 対応 |
| R2 | 文書 cue 付きの value confirmation は RAG fallback を維持する | 高 | 対応 |
| R3 | 自己完結 arithmetic verification を compute-only に戻す | 高 | 対応 |
| R4 | 自己完結 temporal verification を compute-only に戻す | 高 | 対応 |
| R5 | graph test で自己完結 arithmetic verification が computedFacts route に入ることを確認する | 高 | 対応 |
| R6 | API typecheck / test / diff check を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- `合っていますか` / `正しいですか` は、文書確認にも計算検算にも使われるため、単独では document verification cue にしない方針にした。
- `資料`、`契約書`、`記載` などの document source cue がある場合は、引き続き RAG fallback とする。
- 期限値確認については、既存の `isDeadlineFactConfirmation()` に `合っていますか` / `正しいですか` を含めつつ、`期限切れ` や相対期限計算 cue がある場合は compute-only に残すよう既存 guard を維持した。
- arithmetic の自己完結検算は `いくら` だけでなく `合っていますか` / `正しいですか` でも Calculator 対象になるようにした。
- 今回の変更は intent routing の局所修正であり、恒久 docs の Phase 1 / Phase 2 方針と矛盾しないため docs は更新せず、PR 本文と本レポートに反映する方針にした。

## 4. 実施した作業

- `isDocumentVerificationQuestion()` から `合っていますか` / `正しいですか` の一律判定を削除した。
- `isDeadlineFactConfirmation()` の確認語尾に `合っていますか` / `正しいですか` を追加し、fact confirmation pattern の範囲でのみ文書確認として扱うようにした。
- arithmetic intent の cue に `合っていますか` / `正しいですか` を追加し、自己完結の金額検算を Calculator 対象にした。
- intent test に以下を追加した。
  - `1,200円を15人で12か月使うと216,000円で合っていますか？` は compute-only。
  - `1,200円を15人で12か月使う計算は正しいですか？` は compute-only。
  - `2026-05-01期限は期限切れで合っていますか？` は compute-only。
  - `申請日は2026-04-15で、申請から30日以内の期限は2026-05-15で合っていますか？` は compute-only。
- graph test に自己完結 arithmetic verification が `execute_computation_tools` に進み、retrieval に進まないことを確認するケースを追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | document verification cue と self-contained verification intent の修正 | R1-R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts` | TypeScript test | arithmetic / temporal verification の intent 回帰テスト | R3-R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | TypeScript test | self-contained arithmetic verification の computedFacts route test | R5 |
| `reports/working/20260505-0029-pr96-self-contained-verification.md` | Markdown | 本作業の完了レポート | リポジトリ作業報告要件 |

## 6. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: pass
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts src/agent/computation.test.ts`: pass（script の glob により API 全 101 tests）
- `git diff --check`: pass

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 指摘された self-contained verification の false negative を修正した |
| 制約遵守 | 5 | 変更範囲を API intent / tests に限定し、作業レポートを追加した |
| 成果物品質 | 5 | 文書確認 fallback と自己完結 compute-only の両方を test で固定した |
| 説明責任 | 5 | 判断理由、検証内容、docs 更新不要理由を明記した |

総合fit: 5.0 / 5.0（約100%）

## 8. 未対応・制約・リスク

- `task docs:check` は今回の差分では実行していない。対象は API intent 判定と API test のため、API typecheck / test と `git diff --check` を選択した。
- 自然文 intent 判定はルールベースのため、今後も文書確認と自己完結検算の境界表現が見つかった場合は回帰テストの追加が必要になる可能性がある。
