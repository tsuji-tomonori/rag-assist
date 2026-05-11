# chatrag bench smoke failure 修正

- 状態: done
- タスク種別: 修正
- ブランチ: `codex/fix-chatrag-smoke`
- 作業開始: 2026-05-11 23:19 JST

## 背景

`chatrag-bench-v1` は CodeBuild と HTTP 呼び出し自体は成功しているが、2 ターンとも `資料からは回答できません。` となり、`turnAnswerCorrectRate`、`conversationSuccessRate`、`historyDependentAccuracy` が 0.0 になっている。

ユーザー提供の観測では、1 ターン目は期待文書 `chatrag_sample_it.md` を retrieved に含んでいるにもかかわらず refusal になり、`citation_validation_failed` と `The specified key does not exist.` が出ている。2 ターン目は `What about contractors?` の standalone query に前ターンの refusal 文や断片語が混入し、retrieved が 0 件になっている。

## 目的

RAG API の end-to-end smoke として、検索済み根拠がある質問では過剰 refusal せず、履歴依存質問を適切に文脈化し、citation validation の key 不整合で回答全体が不当に失敗しないようにする。

## スコープ

- RAG API の回答可否判定、sufficient context 判定、citation validation、履歴依存 decontextualization のうち、今回の smoke failure に直接関係する範囲。
- benchmark レポートの failure reason 表示は、実装位置と影響範囲を確認して必要最小限で対応する。
- API route の認可境界や本番 UI は変更しない想定。

## なぜなぜ分析サマリ

### 問題文

2026-05-10 実行の `chatrag-bench-v1` で、CodeBuild と HTTP/API 呼び出しは成功したが、RAG API の回答本文と citation が期待を満たさず、1 会話 2 ターンすべてが回答不正解になった。

### 確認済み事実

- 1 ターン目は期待文書が retrieved に含まれている。
- 1 ターン目の中間判定では `answerability_gate` が `answerable=true` としている。
- 後続の `sufficient_context_gate` が `PARTIAL` / `missing_required_fact` として refusal に倒している。
- debug 上で `citation_validation_failed` と `The specified key does not exist.` が発生している。
- 2 ターン目は standalone query に前ターン refusal 文や `Who` / `can` などの断片が混入し、retrieved が 0 件になっている。

### 推定原因

- citation validation が、text upload 文書に対して実在しない source object key を参照している可能性がある。
- required facts 抽出が疑問詞・機能語レベルに分解され、回答に必要な意味単位ではなく単語欠落として扱われている可能性がある。
- decontextualization が assistant refusal 文や断片語を carried entities に含め、履歴依存質問の検索クエリを汚染している可能性がある。

### 根本原因候補

- RAG パイプライン内の後段 gate が、前段で十分根拠ありと判定した retrieved context を再評価する際、質問語や citation storage error を過剰に拒否条件へ変換している。
- 会話履歴処理で、ユーザー意図・前質問 topic・根拠 document topic と、assistant の拒否文・汎用文・断片語を分離する防御が不足している。

### 対策方針

- citation validation の参照キー生成と text upload metadata の整合を確認し、欠損キーが根拠なし refusal へ直結しないようにする。
- required facts 抽出または missing 判定で疑問詞・機能語を必須事実にしない。
- decontextualization で assistant refusal 文と断片語の混入を防ぎ、前ターン topic を使った standalone query を生成する。
- regression test と benchmark smoke で再発検知できるようにする。

## 実施計画

1. 添付 JSONL と benchmark evaluator / runner の期待判定を確認する。
2. RAG API の debug trace、citation validation、sufficient context gate、decontextualization 実装を特定する。
3. 最小再現テストを追加または既存テストを更新する。
4. API 実装を修正する。
5. benchmark report に failure reason が不足している場合は最小限で追加する。
6. 変更範囲に応じた API test / benchmark smoke / diff check を実行する。
7. 作業レポート、commit、push、PR、受け入れ条件コメント、セルフレビューコメントを完了する。

## ドキュメント保守計画

- API の外部 contract に変更がなければ durable docs は更新しない。
- benchmark の report 出力や debug trace の意味が変わる場合は、関連 docs を検索して必要最小限で更新する。
- 作業内容と未実施検証は `reports/working/` に記録する。

## 受け入れ条件

- [ ] `Who can request VPN access?` に対して、retrieved context に根拠がある場合は `Employees with manager approval can request VPN access.` 相当の回答を refusal せず返せる。
- [ ] `What about contractors?` が前ターン topic を引き継ぎ、contractors の VPN access approval を検索・回答できる。
- [ ] citation validation の `The specified key does not exist.` が smoke failure の直接原因にならない、または key 不整合が解消される。
- [ ] `sufficient_context_gate` が疑問詞・機能語を missing required fact として過剰 refusal しない。
- [ ] 関連する API test または benchmark smoke が pass する。
- [ ] 未実施検証がある場合は、PR 本文・PR コメント・作業レポートに理由を明記する。

## 検証計画

- `git diff --check`
- API 変更がある場合: `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- benchmark 変更または smoke 確認が可能な場合: repository task / npm script を確認した上で `task benchmark:sample` または該当 benchmark script
- 必要に応じて targeted test を追加し、失敗から pass への変化を確認する。

## PR レビュー観点

- RAG の根拠性を弱めず、十分根拠がないケースでは refusal を維持しているか。
- benchmark 期待文、QA sample 固有値、dataset 固有分岐を本番実装に入れていないか。
- citation と retrieved chunk の整合性を壊していないか。
- docs と実装の同期、未実施検証の明示ができているか。

## リスク

- LLM 依存の gate / decontextualization で再現性が低い場合、unit test は決定的な helper 層に寄せる必要がある。
- AWS/S3 実体を使う benchmark smoke はローカル環境や権限で実行できない可能性がある。

## 実施結果

- RAG API の英語 follow-up rewrite、required fact fallback、source object 欠損時の context 展開を修正した。
- ChatRAG VPN の 2 ターン回帰テストを追加し、`Who can request VPN access?` と `What about contractors?` が refusal にならず、期待文書を citation / retrieved に含むことを確認した。
- benchmark report / summary の失敗行に `debugSignals` を追加し、`response_type:refusal`、`expected_contains_miss`、`citation_validation_failed`、`sufficient_context_missing_fact` などを表示できるようにした。
- README に `debug signals` の説明を追記した。

## 検証結果

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`: pass（npm script の glob により API workspace 全 201 tests を実行）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: fail -> assertion 順序を修正後 pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: fail -> test artifact type を修正後 pass
- `git diff --check`: pass

## 受け入れ条件確認

- [x] `Who can request VPN access?` に対して、retrieved context に根拠がある場合は `Employees with manager approval can request VPN access.` 相当の回答を refusal せず返せる。根拠: `fixed workflow answers English ChatRAG VPN follow-up without refusal contamination`
- [x] `What about contractors?` が前ターン topic を引き継ぎ、contractors の VPN access approval を検索・回答できる。根拠: 同上
- [x] citation validation の `The specified key does not exist.` が smoke failure の直接原因にならない、または key 不整合が解消される。根拠: expand context / memory source chunk の source object 欠損を空展開として扱う実装
- [x] `sufficient_context_gate` が疑問詞・機能語を missing required fact として過剰 refusal しない。根拠: required fact fallback の英語 stop word 除外と回帰テスト
- [x] 関連する API test または benchmark smoke が pass する。根拠: API tests / benchmark tests pass
- [x] 未実施検証がある場合は、PR 本文・PR コメント・作業レポートに理由を明記する。根拠: 実 CodeBuild 再実行未実施を作業レポートに記載
