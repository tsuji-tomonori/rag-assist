# retrieval scope と final evidence 出力整合

保存先: `tasks/todo/20260507-0844-retrieval-scope-final-evidence.md`

状態: todo

## 背景

benchmark report では Corpus Seed が `handbook.md` 2 chunks であるにもかかわらず、raw retrieved に別資料が混ざっている。回答 citation は rerank 後に正しい資料へ戻っているが、retrieval metric は raw retrieved を見るため `ans-020` / `ans-050` の miss が発生している。

## 目的

検索前に tenant / workspace / corpus / benchmark run / ACL scope を強制し、評価用出力では raw retrieval と final evidence を分離して metric と citation の整合を取る。

## 対象範囲

- retrieval query builder / vector store adapter
- benchmark runner / API response parsing
- debug trace / diagnostics 出力
- benchmark summary / report docs
- security / access-control tests

## 方針

- 検索前に `workspace_id / tenant_id / corpus_id / benchmark_run_id / ACL` filter を適用する。
- benchmark runner では seed した corpus 以外を検索対象にしない。
- API の raw retrieval と reranked / final evidence を区別する。
- metric の対象が raw か final evidence かを明示し、必要なら final evidence metric を追加する。
- ACL / debug trace の機微情報を通常ユーザーへ露出しない。

## 必要情報

- 先行 task: Phase 1 の誤拒否抑制後に着手する。
- 関連指標: `expected_file_hit_rate`, `retrieval_recall_at_20`, `citation_hit_rate`。
- 代表行: `ans-020`, `ans-050`。

## 実行計画

1. benchmark corpus seed と retrieval query の scope 連携を読む。
2. retrieval filter が不足している箇所を特定する。
3. raw retrieved / rerankedRetrieved / finalEvidence の data contract を整理する。
4. benchmark metric の入力を明示し、必要なら追加 metric を実装する。
5. ACL / tenant scope の回帰 test を追加する。
6. docs と PR 本文で metric の解釈を更新する。

## ドキュメントメンテナンス計画

- `REQ_FUNCTIONAL_019.md` の benchmark metric 説明を更新する。
- retrieval / benchmark design doc に raw retrieval と final evidence の違いを追記する。
- Security / access-control に関わる field を公開する場合は API docs と policy test を更新する。

## 受け入れ条件

- [ ] benchmark retrieval が seed corpus scope を検索前に適用する。
- [ ] tenant / workspace / ACL 境界を弱めない。
- [ ] raw retrieval と final evidence の出力が区別できる。
- [ ] metric がどちらを評価しているか docs / report から読める。
- [ ] 関連 benchmark / API tests と `git diff --check` が pass する、または未実施理由を明記する。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `task benchmark:sample` または benchmark 対象の軽量 suite
- access-control policy に影響する場合は該当 test を追加実行する。

## PRレビュー観点

- retrieval scope が API / benchmark / local mock / AWS runtime で一貫しているか。
- metric 解釈が citation と矛盾しないか。
- ACL metadata や raw chunk text の露出が増えていないか。
- latency への影響が説明されているか。

## 未決事項・リスク

- 決定事項: benchmark での scope 強制は精度改善だけでなく security boundary として扱う。
- リスク: 既存 artifact と response schema の互換性が必要なため、field 追加は optional にする。
