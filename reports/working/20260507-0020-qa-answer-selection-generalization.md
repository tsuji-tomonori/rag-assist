# QA 回答文選択の汎用改善 作業レポート

## 受けた指示

- ローカル QA sample で 50 件中 4 件の期待語句未一致が残っている問題に対応する。
- retrievalRecallAtK / citationHitRate は 1.0 のため、取得済み根拠から回答文へ渡す情報選択を改善する。
- 固定値、期待語句、QA sample 固有条件、benchmark 特化の分岐、キーワード列挙は使わず、汎用的な改善にする。
- 同種の修正ミスを防ぐため、レビュー観点、skill、設計方針へ明文化する。

## 要件整理

- 実装は `memorag-bedrock-mvp/apps/api/src/rag/context-assembler.ts` を中心に、質問と根拠の一般的な関連度で回答文脈を選ぶ。
- QA sample の値や部署名、期待語句を直接扱わない。
- retrieval / citation の責務は変更せず、回答に渡す根拠単位の選択と順序を改善する。
- 検証結果は未実施分を実施済みとして扱わない。

## 検討・判断

- 以前の補正に含まれていた answer/domain 固定語句や intent cue 相当の列挙は、benchmark 特化になりやすいため削除した。
- 代替として、質問から動的に抽出した語、漢字 bigram、Markdown 見出し文脈、数値・コード・URL などの一般的な value signal、条件節の一般的な扱いを使って relevance score を組み立てた。
- mock answer selection と prompt context selection が別々の固定語句ロジックを持たないよう、汎用スコア関数を共有した。
- docs / skill には「期待語句や QA sample 固有値で benchmark 指標だけを上げる修正を禁止する」観点を追加した。

## 実施作業

- `context-assembler.ts` に根拠単位分割と汎用的な `textAnswerRelevanceScore` を追加し、回答文脈の優先順位付けに利用した。
- `prompts.ts` と `mock-bedrock.ts` の回答文選択を共通スコアへ寄せ、固定語句リストに依存しない形へ整理した。
- `prompts.test.ts` に、domain word list なしで質問語と value signal により回答文脈が選ばれることを確認するテストを追加した。
- `AGENTS.md`、`skills/pr-review-self-review/SKILL.md`、`skills/task-file-writer/SKILL.md`、`DES_DLD_002.md` に再発防止のレビュー観点と設計方針を追記した。

## 成果物

- 汎用化した RAG 回答文脈選択ロジック。
- 固定語句リストを使わない answer selection の単体テスト。
- benchmark 特化修正を防ぐレビュー観点、skill、設計方針の追記。
- task file: `tasks/do/20260506-2331-qa-answer-selection-generalization.md`

## 検証

- `git diff --check`: pass
- 固定語句・旧シンボルの `rg` 確認: 対象ファイルで該当なし
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass、151 tests
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass、25 tests
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `API_BASE_URL=http://localhost:8792 task benchmark:sample`: pass
  - total: 50
  - answerContainsRate: 1
  - retrievalRecallAtK: 1
  - citationHitRate: 1
  - failures: 0

## Fit 評価

- 固定値、期待語句、QA sample 固有 ID、benchmark suite 固有分岐を実装に入れず、質問と根拠の一般的な信号に基づく改善として対応した。
- QA sample は 50/50 で期待語句一致となり、retrievalRecallAtK / citationHitRate は 1.0 を維持した。
- 再発防止として、レビュー観点、skill、設計方針へ benchmark 特化修正を禁止する観点を追加した。

## 未対応・制約・リスク

- CI はまだ未確認。PR 作成後に GitHub 側の check 状態を確認する必要がある。
- mock adapter 内には、回答文選択とは別責務のポリシー計算用サンプル表現が既存で残る。今回の対象は回答文選択の固定語句依存の除去に限定した。
