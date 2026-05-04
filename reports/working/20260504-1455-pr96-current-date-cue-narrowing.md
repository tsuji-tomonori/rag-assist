# 作業完了レポート

保存先: `reports/working/20260504-1455-pr96-current-date-cue-narrowing.md`

## 1. 受けた指示

- PR #96 最新 head `dcf2ea2...` のレビュー指摘に対応する。
- `current_date` 判定の `今` / `現在` が広すぎる問題を修正する。
- `今月の締切は何日ですか？` のような RAG 質問を current date compute-only に誤ルーティングしないようにする。
- intent test と graph test を追加する。
- 検証、commit、push、PR 更新まで行う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | bare `今` / `現在` の current date 判定を狭める | 高 | 対応 |
| R2 | `今月の締切は何日ですか？` を RAG retrieval に流す | 高 | 対応 |
| R3 | `今週の申請期限は何日ですか？` / `現在の提出期限は何日ですか？` を RAG intent にする | 高 | 対応 |
| R4 | `今は何日ですか？` は current date compute-only に残す | 高 | 対応 |
| R5 | graph test で current-month deadline が RAG に流れることを確認する | 高 | 対応 |
| R6 | API typecheck / test / diff check を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- `今日` / `本日` は current date cue として比較的安全なため、従来通り `日付` / `何日` との組み合わせを許可した。
- `今` / `現在` は `今月`、`今週`、`現在の提出期限` のように業務データや文書に依存する表現が多いため、`今の日付` / `今は何日` / `現在の日付` / `現在は何日` に限定した。
- 既存の RAG fallback 群を崩さないよう、intent unit test と graph route test の両方で回帰を固定した。
- 今回の変更は intent routing の局所修正であり、既存 docs の current date 制約説明と整合するため docs 更新は不要と判断した。

## 4. 実施した作業

- `isCurrentDateRequest()` の正規表現を狭め、`今月.*何日` / `今週.*何日` / `現在の提出期限.*何日` が current date に入らないよう修正した。
- intent test に以下を追加した。
  - `今は何日ですか？` は compute-only。
  - `今月の締切は何日ですか？` は `canAnswerFromQuestionOnly=false` / `needsSearch=true`。
  - `今週の申請期限は何日ですか？` と `現在の提出期限は何日ですか？` は `needsSearch=true`。
- graph test に `今月の締切は何日ですか？` が RAG retrieval / search action に進み、`execute_computation_tools` を呼ばないことを確認するケースを追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | current date cue の絞り込み | R1-R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts` | TypeScript test | `今` / `現在` 系 intent の回帰テスト | R2-R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | TypeScript test | current-month deadline の RAG route test | R5 |
| `reports/working/20260504-1455-pr96-current-date-cue-narrowing.md` | Markdown | 本作業の完了レポート | リポジトリ作業報告要件 |

## 6. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: pass
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts src/agent/computation.test.ts`: pass（script の glob により API 全 99 tests）
- `git diff --check`: pass

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 指摘された `今` / `現在` の false positive を狭め、指定ケースをテストした |
| 制約遵守 | 5 | 変更範囲を API intent / tests に限定し、作業レポートを追加した |
| 成果物品質 | 5 | compute-only 維持ケースと RAG fallback ケースを両方固定した |
| 説明責任 | 5 | 判断理由、検証内容、docs 更新不要理由を明記した |

総合fit: 5.0 / 5.0（約100%）

## 8. 未対応・制約・リスク

- `task docs:check` は今回の差分では実行していない。対象は API intent 判定と API test のため、API typecheck / test と `git diff --check` を選択した。
- 自然文 intent 判定はルールベースのため、今後も新しい `今` / `現在` 系の業務表現が見つかった場合は回帰テストの追加が必要になる可能性がある。
