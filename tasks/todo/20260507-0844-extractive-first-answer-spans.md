# extractive-first answer span 生成

保存先: `tasks/todo/20260507-0844-extractive-first-answer-spans.md`

状態: todo

## 背景

`ans-028` と `ans-033` は意味的には近い回答だが、source wording と期待語句がずれて `answer_missing_expected_text` になっている。個別文字列置換ではなく、evidence span の文言を保持する生成へ寄せる必要がある。

## 目的

answer span を evidence sentence から抽出し、回答生成で source wording を優先する extractive-first pipeline を導入する。

## 対象範囲

- answer generation prompt / node
- context assembler / selected chunks
- answerability / support verifier の data contract
- `usedChunkIds` / `usedSpans` 出力
- API / web debug trace tests
- RAG design docs

## 方針

- evidence sentence から primary fact の answer span を保持する。
- 回答文では source wording をできる限り残し、言い換えを最小化する。
- `usedChunkIds` に加えて optional `usedSpans` を返せる設計にする。
- exact expected phrase に過適合せず、忠実性と citation grounding の改善として実装する。

## 必要情報

- 先行 task: `tasks/do/20260507-0844-rag-answerability-phase1.md`。
- 代表行:
  - `ans-028`: `年に1回` ではなく source の `年1回`
  - `ans-033`: `対象家族` を保持

## 実行計画

1. answer generation と support verifier の現行 prompt / schema を読む。
2. evidence sentence / answer span の候補抽出 helper を設計する。
3. LLM prompt に source wording 保持を明示し、deterministic fallback を用意する。
4. `usedSpans` を optional field として trace / response に追加するか判断する。
5. source wording を保持する unit / integration test を追加する。
6. docs と API contract の更新要否を確認する。

## ドキュメントメンテナンス計画

- API response に `usedSpans` を追加する場合は API docs / debug docs / web types を更新する。
- `REQ_FUNCTIONAL_014` または RAG design doc に span-level grounding の説明を追記する。
- README は公開挙動の説明に影響する場合だけ更新する。

## 受け入れ条件

- [ ] primary fact の answer span を evidence sentence から保持できる。
- [ ] 回答生成が source wording を優先する。
- [ ] `usedChunkIds` と citation grounding が壊れない。
- [ ] optional `usedSpans` を追加する場合、API / web / docs の互換性を保つ。
- [ ] 関連 tests と `git diff --check` が pass する、または未実施理由を明記する。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- --test-name-pattern "answer|span|support"`
- web type に影響する場合は `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`

## PRレビュー観点

- expected phrase の hard-code ではなく evidence wording 保持になっているか。
- 引用 chunk と answer span の対応が追えるか。
- unsupported sentence を増やしていないか。
- API field 追加が backward-compatible か。

## 未決事項・リスク

- 決定事項: Phase 1 とは別 PR に分け、回答文体の変更による benchmark 差分を独立して評価する。
- リスク: source wording を残しすぎると回答が硬くなるため、忠実性を優先しつつ最小限の整文に留める。
