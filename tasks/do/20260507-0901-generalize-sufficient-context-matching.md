# sufficient context の fact 判定汎化

保存先: `tasks/do/20260507-0901-generalize-sufficient-context-matching.md`

状態: do

## 背景

PR #142 の Phase 1 実装で、`sufficient-context-gate.ts` に `factTypeTerms` という fact type ごとの日本語語彙リストが入った。これは benchmark 固有分岐ではないものの、語彙パターンに依存しており、primary fact 単位の汎用制御という目的と合わない。

## 目的

fact type 語彙リストによる pattern matching を削除し、fact id、fact description、retrieval evaluator の構造化 status を使った汎用的な判定へ寄せる。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/agent/nodes/sufficient-context-gate.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts`
- 必要に応じて作業レポート、PR コメント

## 方針

- `factTypeTerms` を削除する。
- primary missing / conflict 判定は、`retrievalEvaluation.*FactIds` と judgement の fact id / description 参照に限定する。
- `PARTIAL` の回答継続条件は、語彙 cue ではなく primary fact が構造的に supported と判断できることに置く。
- 日本語の固定語彙、expected phrase、row id、dataset 固有分岐を追加しない。

## 必要情報

- ユーザー指摘: `factTypeTerms` の pattern matching をやめ、汎化する。
- 既存 PR: <https://github.com/tsuji-tomonori/rag-assist/pull/142>

## 実行計画

1. `sufficient-context-gate.ts` の `factTypeTerms` と直接依存を削除する。
2. `primaryFactSupportedByEvidence` / `judgementMentionsFact` のような構造化 helper へ置き換える。
3. 既存テストを更新し、語彙 fallback がなくても primary supported / primary missing を判定できることを確認する。
4. API test、typecheck、diff check を実行する。
5. PR に更新後セルフレビューコメントを追加する。

## ドキュメントメンテナンス計画

- 公開 API や durable docs の挙動説明は Phase 1 のまま変わらないため、README / requirements docs の追加更新は不要と判断する。
- 作業レポートと PR コメントに、pattern matching 削除の意図と検証を記録する。

## 受け入れ条件

- [ ] `factTypeTerms` と fact type 別固定語彙 fallback が削除されている。
- [ ] `PARTIAL` 継続判定が primary fact の構造化 support に基づく。
- [ ] primary fact missing / conflict の拒否経路が維持されている。
- [ ] benchmark expected phrase、row id、dataset 固有分岐を追加していない。
- [ ] 対象検証が pass する、または未実施理由を明記する。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- --test-name-pattern "sufficient context|retrieval evaluator LLM judge|fixed workflow continues"`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`

## PRレビュー観点

- 語彙リストによる特殊扱いが残っていないか。
- primary fact supported / missing / conflicting の判定が trace と retrieval evaluator の構造化結果で追えるか。
- RAG の根拠性や refusal 安全性を弱めすぎていないか。

## 未決事項・リスク

- 決定事項: この task では `hasDirectAnswerCue` も `PARTIAL` 継続条件から外し、後段 citation / support verifier に確認させる。
- リスク: LLM judge が fact id / description を返さない場合の判定は retrieval evaluator の fact id status に強く依存する。
