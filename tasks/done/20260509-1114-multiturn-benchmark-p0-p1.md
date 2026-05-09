# Multi-turn benchmark P0/P1 対応

状態: done

## 背景

MTRAG / mtRAG / ChatRAG Bench 系の multi-turn / conversational RAG benchmark に向け、会話履歴を benchmark runner と QA agent の入力として扱えるようにする必要がある。

## 目的

P0 benchmark adapter と P1 conversation-aware query rewriting の最小実装を追加し、会話単位で turn を逐次実行できる土台を作る。

## スコープ

- benchmark dataset row の conversation metadata 拡張
- benchmark runner の conversation 単位逐次実行
- multi-turn benchmark sample / adapter の追加
- `ChatInput` への conversation history 追加
- QA graph への deterministic conversation state / decontextualized query trace 追加
- P2/P3/P4 を別 task として `tasks/todo/` に登録

## 作業計画

1. 既存 benchmark runner と QA graph の入力・trace 構造を確認する。
2. P2/P3/P4 の backlog task を作成する。
3. P0 として multi-turn dataset schema と conversation runner を実装する。
4. P1 として `ChatInput.conversation`、conversation state builder、decontextualized query trace を実装する。
5. fixture / unit test を追加または更新する。
6. 変更範囲に見合う検証を実行する。
7. 作業完了レポートを作成する。

## ドキュメント保守計画

本変更は benchmark schema と API debug trace の挙動に影響する。既存 docs / README に該当する benchmark dataset adapter 記述がある場合は更新要否を確認し、必要に応じて追記する。大きな仕様文書化は後続の P2/P3/P4 ではなく本 PR の P0/P1 範囲に限定する。

## 受け入れ条件

- [x] `conversationId` / `turnIndex` / `history` / `expectedStandaloneQuestion` / `turnDependency` を dataset row と結果に保持できる。
- [x] runner が同一 `conversationId` の turn を `turnIndex` 順に逐次実行し、前 turn の回答・citation を後続 turn の `conversation` 入力へ渡せる。
- [x] summary に turn dependency 別の metrics が出る。
- [x] `ChatInput` が conversation history/state を受け取れる。
- [x] QA debug trace に deterministic な conversation state / standalone question / retrieval query 群が出る。
- [x] RAG 実装に dataset row id、expected answer、benchmark 固有期待語句による分岐を入れていない。
- [x] 関連する unit / benchmark test と `git diff --check` を実行し、結果を記録している。
- [x] 作業完了レポートを `reports/working/` に作成している。

## 検証計画

- benchmark runner unit test
- QA agent graph / node unit test の該当部分
- TypeScript typecheck または該当 workspace test
- `git diff --check`

## PR レビュー観点

- multi-turn dataset 固有の期待値を実装の retrieval / answer logic に混入させていないか。
- 会話履歴の assistant answer を根拠として扱わず、citation / document evidence に戻す構造になっているか。
- 既存 single-turn benchmark の互換性を壊していないか。
- debug trace に検証可能な形で rewrite 情報が残るか。

## リスク

- P1 は deterministic rewrite を最小実装とし、LLM rewrite や reranker は後続 task とするため、実 benchmark の精度改善は限定的な可能性がある。

## 検証結果

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## 完了メモ

P2 reranking、P3 memory grounding、P4 answer calibration は `tasks/todo/` に別 task として登録済み。
