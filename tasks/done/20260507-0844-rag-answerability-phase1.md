# RAG 回答可能性 gate Phase 1

保存先: `tasks/done/20260507-0844-rag-answerability-phase1.md`

状態: done

## 背景

benchmark report / summary / raw results では、50 件すべてが回答可能データであるにもかかわらず拒否行が 10 件あり、`answerable_accuracy` は 76.0%、`refusal_precision` は 0.0% だった。検索系の `expected_file_hit_rate` は 98.0%、`retrieval_recall_at_20` は 94.0% と高く、主因は検索不足ではなく、`answerability_gate` と `sufficient_context_gate`、および conflict 解消後の制御が過剰に保守的であることと判断する。

## 目的

Phase 1 として、primary fact が取得済み evidence で支持されている場合の hard refusal を抑制する。個別 QA ルールではなく、`PARTIAL` 判定、secondary fact 不足、LLM judge の `NO_CONFLICT` を扱う汎用的な gate 制御にする。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/agent/state.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/sufficient-context-gate.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/*retrieval*` または conflict judge 関連コード
- `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts`
- 関連する requirements / design docs

## 方針

- `requiredFacts` に fact の必要度を示す `necessity: primary | secondary | inferred` を後方互換な optional field として導入する。
- 既存 planner が必要度を出さない場合は、最小限の互換 fallback として先頭または既存の直接質問由来 fact を `primary` 扱いにする。
- `sufficient_context_gate=PARTIAL` でも、primary fact が supported で、conflict が primary fact に触れていない場合は回答へ進める。
- LLM judge が高信頼 `NO_CONFLICT` を返し、conflicting fact id が解除済みまたは primary に触れていない場合は追加検索 / refusal へ進めない。
- secondary / inferred fact の missing だけで `finalize_refusal` にしない。
- benchmark expected phrase、QA row id、dataset 固有分岐、handbook 固有語句を実装へ入れない。

## 必要情報

- ユーザー提示の分析対象: benchmark report / summary / raw results。
- 代表失敗行: `ans-003`, `ans-004`, `ans-005`, `ans-006`, `ans-010`, `ans-015`, `ans-018`, `ans-025`, `ans-043`, `ans-001`。
- 既存関連 docs: `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/04_回答検証・ガードレール/01_回答前ガード/REQ_FUNCTIONAL_014.md`。
- `ans-001` の 504 は本 task では tail latency の直接修正ではなく、不要な conflict loop / refusal gate 呼び出し削減の範囲で扱う。

## 実行計画

1. `answerability_gate`、`sufficient_context_gate`、retrieval conflict evaluation、graph routing の現状を読む。
2. `RequiredFact` に optional `necessity` を追加し、trace / debug が壊れないようにする。
3. primary fact 判定 helper を追加し、missing / conflicting が primary に触れているかを判定する。
4. `sufficient_context_gate=PARTIAL` の扱いを、primary supported なら answer へ進める制御に変更する。
5. LLM judge の高信頼 `NO_CONFLICT` を conflict downgrade に反映する。
6. 既存 API / graph test を更新し、Phase 1 の回帰ケースを追加する。
7. 関連 docs を必要最小限で更新する。
8. targeted validation を実行し、失敗があれば修正して再実行する。

## ドキュメントメンテナンス計画

- `REQ_FUNCTIONAL_014.md` は、`PARTIAL` が常に拒否ではなく、primary fact が支持される場合は根拠範囲内で回答できることを追記する。
- README / API examples / OpenAPI は、公開 API shape を変更しない場合は更新不要とし、PR 本文と作業レポートに理由を記載する。
- Debug trace の field を追加する場合は、design doc または debug 関連 docs の更新要否を確認する。

## 受け入れ条件

- [x] `RequiredFact` が `necessity: primary | secondary | inferred` を後方互換に保持できる。
- [x] `sufficient_context_gate=PARTIAL` かつ primary fact supported の場合、secondary / inferred missing だけでは `finalize_refusal` にならない。
- [x] 高信頼 `LLM judge == NO_CONFLICT` が conflict downgrade と回答継続に反映される。
- [x] primary fact に触れる unresolved conflict または primary fact missing の場合は、既存どおり refusal / 追加検索に倒せる。
- [x] benchmark 固有の expected phrase、row id、dataset 固有分岐を追加していない。
- [x] 対象 API test と `git diff --check` が pass する、または未実施理由を明記する。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- --test-name-pattern "sufficient context|conflict|fixed workflow"` または同等の targeted API test
- 必要に応じて `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- benchmark 全量は外部依存と時間が大きい場合、PR 本文に未実施理由と推奨コマンドを明記する。

## PRレビュー観点

- RAG の根拠性を弱めず、primary fact の span / chunk support がある場合だけ hard refusal を緩和しているか。
- unanswerable / ambiguous への refusal 経路を削除していないか。
- `NO_CONFLICT` の confidence threshold が既存 runtime policy と整合しているか。
- Debug trace が拒否理由と回答継続理由を追跡できるか。
- 変更範囲に見合う API test があるか。

## 未決事項・リスク

- 決定事項: Phase 1 では exact span extraction の本格導入は行わず、既存 `requiredFacts` と sufficient context judgement の supported / missing を使って refusal を抑制する。
- リスク: refusal を弱めるため、unanswerable dataset で unsupported answer が増える可能性がある。後続 task で unanswerable / ambiguous 評価セットを追加する。
- 実装時確認: 現行 planner が fact ごとに質問直接由来かどうかを持っていない場合、primary fallback の粒度をテスト可能な範囲に限定する。

## 完了メモ

- PR: <https://github.com/tsuji-tomonori/rag-assist/pull/142>
- 受け入れ条件確認コメント: PR #142 に投稿済み。
- セルフレビューコメント: PR #142 に投稿済み。
- 検証: `npm ci`、`npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`、`npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`、`git diff --check` が pass。
- 未実施: benchmark 全量再実行は外部 API / runner 環境依存のため未実施。
