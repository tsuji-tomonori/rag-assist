# typed claim conflict のスコープ化

保存先: `tasks/todo/20260507-0844-typed-claim-conflict-scope.md`

状態: todo

## 背景

benchmark では `ans-005` / `ans-006` のように、同じ chunk 内の `月10日以上` と `翌月5営業日` が同一 fact の conflicting date と誤認されるケースがある。値の型だけで conflict を扱うと、支給対象条件、申請期限、金額など意味役割の異なる値を排他的な値として扱ってしまう。

## 目的

typed claim を semantic role / predicate / scope / condition で構造化し、同一 scope 内の排他的値だけを conflict として扱う。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/agent/state.ts`
- retrieval evaluator / typed claim extraction / conflict candidate 関連コード
- `memorag-bedrock-mvp/apps/api/src/agent/trace.ts`
- API tests
- RAG workflow / requirements docs

## 方針

- typed claim を `{ subject, predicate, value, condition, scope, semanticRole }` 相当で扱えるようにする。
- conflict は少なくとも `subject + predicate + scope + condition` が一致し、値が排他的な場合だけ立てる。
- valueType が `date` / `amount` で一致するだけでは conflict にしない。
- primary fact に触れない conflict は hard refusal の根拠にしない。
- benchmark expected phrase や dataset 固有 ID を使わない。

## 必要情報

- 先行 task: `tasks/do/20260507-0844-rag-answerability-phase1.md`。
- ユーザー提示例:
  - `月10日以上`: eligibility threshold
  - `翌月5営業日`: application deadline
  - `5,000円`: amount

## 実行計画

1. typed claim extraction と conflict candidate の現行 schema を読む。
2. semantic role / predicate / scope / condition の最小 schema を設計する。
3. deterministic な conflict 判定条件を更新する。
4. LLM judge 入力 / 出力と trace 表示を更新する。
5. 同一 chunk 内の異なる意味役割を conflict にしない回帰 test を追加する。
6. docs と benchmark 説明を更新する。

## ドキュメントメンテナンス計画

- `REQ_FUNCTIONAL_016.md` または関連 design doc に、conflict 判定が typed claim の意味役割と scope に基づくことを追記する。
- API response shape に公開 field を追加する場合は API docs / debug docs を更新する。
- README は user-visible workflow 説明に変更が必要な場合だけ更新する。

## 受け入れ条件

- [ ] typed claim が valueType だけでなく predicate / scope / condition を保持できる。
- [ ] 支給条件と申請期限のように意味役割が異なる値を conflict にしない。
- [ ] 同一 subject / predicate / scope / condition の排他的値は conflict として検出できる。
- [ ] primary fact に関係しない conflict が hard refusal を引き起こさない。
- [ ] API test と `git diff --check` が pass する、または未実施理由を明記する。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- --test-name-pattern "typed claim|conflict"`
- 必要に応じて `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`

## PRレビュー観点

- valueType だけの shallow conflict 判定を温存していないか。
- LLM judge に任せる前の deterministic scope が説明可能か。
- trace / benchmark で conflict 理由を追えるか。
- answerable dataset だけに過適合していないか。

## 未決事項・リスク

- 決定事項: predicate / scope / condition は optional から始め、既存 artifact の backward compatibility を保つ。
- リスク: claim extraction の粒度を広げすぎると LLM prompt / token cost が増えるため、最小 schema で開始する。
