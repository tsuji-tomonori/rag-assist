# MTRAG / ChatRAG Bench 会話 RAG ベンチマーク対応

状態: in_progress

## 背景

`rag-assist` / `memorag-bedrock-mvp` には single-turn RAG benchmark 基盤があるが、MTRAG / ChatRAG Bench のような multi-turn RAG 評価には、会話履歴入力、履歴対応 query/prompt、会話単位 runner、外部 dataset adapter が必要。

## 目的

外部 multi-turn RAG benchmark を既存 benchmark 基盤に接続できる最小実装を追加し、会話履歴を RAG の質問解釈に使えるようにする。

## Scope

- `/chat` / `/benchmark/query` request schema に `conversationHistory` を追加する。
- agent input/state に `conversationHistory` を追加し、normalize / clue / final answer prompt へ渡す。
- 会話履歴は質問解釈にのみ使い、根拠は retrieved chunks / computed facts に限定する。
- `benchmark/conversation-run.ts` と会話 metrics を追加する。
- MTRAG / ChatRAG Bench adapter を追加し、conversation JSONL と corpus Markdown へ変換する。
- npm scripts、Taskfile、benchmark suite 登録を追加する。
- 影響する docs を最小更新し、作業レポートを残す。

## Non-scope

- 外部 benchmark 実データの同梱。
- 本番用 LLM query rewrite node の追加。
- CodeBuild / infra の本格対応は、既存 runner 構造を確認して同一 PR に安全に収まる範囲のみ。

## Plan

1. 既存 API / agent / benchmark / Taskfile / docs の構造を確認する。
2. conversation history schema と state plumbing を実装する。
3. normalize query と prompts を履歴対応にする。
4. conversation runner / metrics / adapters を追加する。
5. scripts / Taskfile / suite / docs を更新する。
6. targeted tests / typecheck / diff check を実行する。
7. report、commit、push、PR、受け入れ条件コメント、セルフレビューコメントを完了する。

## Documentation maintenance plan

- API request shape、benchmark runner、Taskfile の利用方法が変わるため、関連 README / docs を検索して最小更新する。
- `memorag-bedrock-mvp/docs` 更新が必要な場合は既存構成に合わせる。

## 受け入れ条件

- [ ] `ChatRequestSchema` と benchmark query request が `conversationHistory` を受け付ける。
- [ ] `ChatInput` / `QaAgentState` / graph initial state が `conversationHistory` を保持する。
- [ ] normalize query が履歴依存質問を standalone query へ deterministic に補完し、履歴なしでは既存挙動を維持する。
- [ ] clue / final answer prompt が履歴を受け取り、履歴を根拠扱いしないルールを含む。
- [ ] `conversation-run.ts` が conversation JSONL を turn 順に実行し、履歴を `/benchmark/query` に渡し、results / summary / report を出力する。
- [ ] 会話 metrics が最低限 `turnAnswerCorrectRate`, `conversationSuccessRate`, `historyDependentAccuracy`, `abstentionAccuracy`, `retrievalRecallAtK` を出す。
- [ ] MTRAG adapter が raw JSON から conversation JSONL と corpus Markdown を生成できる。
- [ ] ChatRAG Bench adapter が raw input directory から conversation JSONL と corpus Markdown を生成できる。
- [ ] package scripts / Taskfile / benchmark suite に `mtrag-v1` と `chatrag-bench-v1` の導線がある。
- [ ] 変更範囲に見合う tests / typecheck / diff check を実行し、失敗があれば修正または blocked として記録する。
- [ ] 作業レポートを `reports/working/` に保存する。
- [ ] PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## Validation plan

- `git diff --check`
- API workspace の test / typecheck
- benchmark workspace の test / typecheck
- 追加 adapter / metrics の fixture test
- Taskfile target は実行前に解決コマンドを確認する

## PR review points

- 履歴が根拠文書として扱われていないこと。
- 既存 single-turn benchmark の互換性を壊していないこと。
- benchmark expected phrase や dataset 固有値を RAG 実装へ入れていないこと。
- docs と実装が同期していること。

## Risks

- MTRAG / ChatRAG Bench の実 raw schema は環境ごとに差があるため、adapter は薄い defensive parser として実装する。
- API behavior 変更により OpenAPI / docs check の更新が必要になる可能性がある。
