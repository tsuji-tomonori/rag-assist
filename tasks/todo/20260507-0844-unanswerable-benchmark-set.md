# unanswerable / ambiguous benchmark 追加

保存先: `tasks/todo/20260507-0844-unanswerable-benchmark-set.md`

状態: todo

## 背景

今回の dataset は answerable 50 件、unanswerable 0 件、clarification 0 件である。Phase 1 で refusal を弱めると answer-only benchmark では改善する一方、本番では unsupported answer が増える可能性がある。

## 目的

本当に資料にない質問、矛盾する質問、主語が曖昧な質問、日付・金額・対象条件が複数ある質問、部分回答すべき質問を含む評価セットを追加し、refusal / clarification / partial answer の安全性を継続評価できるようにする。

## 対象範囲

- `memorag-bedrock-mvp/benchmark/*.jsonl`
- benchmark runner / summary / report
- docs / LOCAL_VERIFICATION
- CI または task コマンドの軽量評価設定

## 方針

- answerable-only dataset と mixed dataset を分ける。
- `expectedResponseType`, `answerable`, `unanswerableType`, `expectedClarification` を明示する。
- dataset 固有分岐を実装へ入れず、評価側で期待値を表現する。
- refusal precision / recall、clarification、partial answer の解釈を report に出す。

## 必要情報

- 先行 task: Phase 1 の gate 緩和後に baseline を取る。
- 既存 sample: `memorag-bedrock-mvp/benchmark/dataset.clarification.sample.jsonl`。

## 実行計画

1. 既存 benchmark dataset schema と evaluator を読む。
2. mixed dataset のカテゴリと最小ケース数を設計する。
3. JSONL dataset を追加し、期待値を明示する。
4. report / summary が unanswerable 行を正しく扱うことを test する。
5. docs に実行方法と metric 解釈を追記する。

## ドキュメントメンテナンス計画

- `LOCAL_VERIFICATION.md` に mixed benchmark の実行方法を追記する。
- `REQ_FUNCTIONAL_019.md` に refusal / clarification 指標の評価前提を追記する。
- README は benchmark セクションに反映が必要な場合だけ更新する。

## 受け入れ条件

- [ ] unanswerable / ambiguous / conflicting / partial answer の各カテゴリを含む dataset がある。
- [ ] summary / report が refusal precision / recall を `not_applicable` ではなく評価できる。
- [ ] 実装側に dataset 固有の分岐を追加していない。
- [ ] benchmark の軽量実行または evaluator test が pass する、または未実施理由を明記する。

## 検証計画

- `git diff --check`
- benchmark evaluator の unit test
- `task benchmark:sample` または mixed dataset の軽量実行

## PRレビュー観点

- dataset が本番リスクを代表しているか。
- answerable-only 指標と mixed 指標を混同していないか。
- expected values が曖昧でなく、検証可能か。
- benchmark 期待語句への過適合を誘発していないか。

## 未決事項・リスク

- 決定事項: Phase 1 PR では dataset 追加は todo 化に留め、実装 PR の評価結果と分けて扱う。
- リスク: mixed benchmark は LLM / local server 依存で実行時間が長くなる可能性があるため、CI 用の軽量 profile が必要になる。
