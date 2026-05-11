# ChatRAG smoke 修正の汎化

- 状態: done
- タスク種別: 修正
- 作成日時: 2026-05-11 23:51 JST

## 背景

前回の ChatRAG smoke 修正では、履歴依存質問の standalone 化と requiredFacts fallback を改善したが、英語 stop word や質問語の固定列挙に依存した箇所が残った。ユーザーから「ルールベースになってない? 汎化させて」と指摘があった。

## 目的

benchmark sample 固有の語句や固定 stop word 列挙に依存せず、低情報量語を一般的なスコアリングで抑制し、質問から抽出した情報量のある語句を意味単位にまとめて扱う。

## なぜなぜ分析サマリ

- 問題文: ChatRAG smoke 修正に、`who`, `can` などの固定 stop word 列挙や英語疑問文向けの置換が残り、汎化性に疑義がある。
- confirmed: `build-conversation-state.ts` に英日 stop word 配列と英語疑問文向け正規表現がある。`graph.ts` に `USELESS_FACT_REFERENCES` がある。
- inferred: smoke dataset の失敗症状を最短で抑える過程で、低情報量語の除外を語彙列挙で実装したため、未知ドメイン・別表現での振る舞いが読みづらくなった。
- root cause: 「質問語を消す」処理と「根拠確認に使う意味単位を作る」処理が分離されず、語彙列挙で fallback を補正していた。
- remediation: 固定 stop word 列挙を撤去し、語の長さ・記号/数字/大文字・CJK 長・繰り返しなどの言語非依存寄り特徴で signal terms を抽出する。requiredFacts fallback は単語単位ではなく signal terms を束ねた 1 つの意味句にする。
- open_question: LLM を使った standalone rewrite はコスト・遅延・障害面の影響があるため、このタスクでは既存ローカル処理の汎化に限定する。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/agent/nodes/build-conversation-state.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- 関連 unit tests
- 作業レポート、PR コメント

## 実装計画

1. 固定 stop word 配列と英語疑問文専用 topic extraction を削除する。
2. signal term scoring を導入し、履歴 entity/topic 抽出に使う。
3. requiredFacts fallback を単語列挙から signal phrase 1 件に変更する。
4. テストで smoke 固有値ではなく、別ドメイン語句でも低情報量語を除外できることを確認する。
5. 関連検証を実行し、PR に受け入れ条件とセルフレビューを追記する。

## ドキュメント保守方針

外部仕様や運用手順は変えない。実装上の汎化方針は作業レポートと PR コメントに記録する。

## 受け入れ条件

- 固定 stop word 配列で `who`, `can` などを列挙する実装が残っていない。
- standalone 化が前ターンの拒否文を topic/entity に混ぜにくく、follow-up subject と直前 topic を組み合わせる。
- requiredFacts fallback が質問語の単語分解ではなく、情報量のある語句を束ねた意味句になる。
- QA sample 固有値・benchmark expected phrase 固有の分岐を追加していない。
- API 関連 unit test と typecheck が pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `git diff --check`

## PR レビュー観点

- RAG の根拠性や認可境界を弱めていないこと。
- benchmark sample 固有値への分岐がないこと。
- fixed stop word の代替が過剰に複雑化していないこと。

## リスク

- ローカル rewrite は LLM rewrite ほど自然言語理解できないため、完全な汎化ではなく低情報量語の抑制と意味句 fallback の改善に留まる。
