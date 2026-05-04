# 作業完了レポート

保存先: `reports/working/20260504-1414-pr96-polite-temporal-intent.md`

## 1. 受けた指示

- PR #96 最新 head `12f738d...` のレビュー指摘に対応する。
- `isDocumentVerificationQuestion()` が `ですか` を文書確認扱いすることで、自然な current date / relative deadline 計算質問が RAG に誤ルーティングされる問題を修正する。
- 「今日の日付は何日ですか？」と、可能なら丁寧な相対期限計算質問の test を追加する。
- 変更を検証し、commit / push / PR 更新まで行う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `ですか` / `でしょうか` 単独を document verification cue から外す | 高 | 対応 |
| R2 | 資料・契約書・発行日などの文書ソース cue は RAG fallback を維持する | 高 | 対応 |
| R3 | 「今日の日付は何日ですか？」を `current_date` compute-only に戻す | 高 | 対応 |
| R4 | 丁寧な相対期限計算質問を question-only calculation に戻す | 高 | 対応 |
| R5 | intent test / graph test を追加・更新する | 高 | 対応 |
| R6 | API typecheck / test / diff check を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- 単純な疑問語尾は丁寧表現として扱い、文書確認 cue には含めない方針にした。
- 文書確認は `資料`、`契約書`、`発行日` などの文書ソース cue、`合っていますか` / `正しいですか`、または期限値の確認パターンに限定した。
- 既存の false positive 対策を崩さないよう、`経費精算の期限は2026-05-10ですか？` と `経費精算の期限は申請から30日以内ですか？` は引き続き RAG に流す判定を残した。
- `memorag-bedrock-mvp/docs` の current date 制約説明は今回の方針と矛盾しないため、恒久 docs の追加更新は不要と判断した。

## 4. 実施した作業

- `isCurrentDateRequest()` を文書ソース cue のみで除外する形に変更した。
- `isDocumentVerificationQuestion()` から `ですか` / `でしょうか` の単独判定を外し、`hasDocumentSourceCue()` と `isDeadlineFactConfirmation()` に分割した。
- intent test に以下を追加した。
  - `今日の日付は何日ですか？` が compute-only temporal intent になること。
  - `契約書の日付を教えて` が RAG 検索になること。
  - `申請日は2026-04-15で、申請から30日以内の期限はいつですか？` が compute-only になること。
- computation test に丁寧な相対期限計算の `add_days` 結果を追加した。
- graph test を「今日の日付は何日ですか？」で computed current date に進み、retrieval へ行かない確認に更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | document verification / current date / relative deadline intent 判定の修正 | R1-R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts` | TypeScript test | intent と deterministic calculation の追加テスト | R5 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | TypeScript test | polite current date graph route の確認 | R5 |
| `reports/working/20260504-1414-pr96-polite-temporal-intent.md` | Markdown | 本作業の完了レポート | リポジトリ作業報告要件 |

## 6. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: pass
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts src/agent/computation.test.ts`: pass（script の glob により API 全 97 tests）
- `git diff --check`: pass

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 指摘された false negative を修正し、指定された current date と相対期限のテストを追加した |
| 制約遵守 | 5 | AGENTS の作業レポート、検証、commit 前確認の流れに沿っている |
| 成果物品質 | 5 | 既存の RAG fallback テストを維持しつつ、丁寧な計算質問の回帰を防ぐテストを追加した |
| 説明責任 | 5 | 判断理由、検証結果、docs 更新不要理由を明記した |

総合fit: 5.0 / 5.0（約100%）

## 8. 未対応・制約・リスク

- `task docs:check` は今回の差分では実行していない。対象は API intent 判定と API test のため、`git diff --check` と API typecheck / test で確認した。
- 自然文 intent 判定はルールベースのため、今後も新しい言い回しに対する追加回帰テストが必要になる可能性がある。
