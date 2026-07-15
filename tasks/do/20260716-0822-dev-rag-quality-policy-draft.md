# dev RAG 品質 policy draft の作成

- 状態: do
- タスク種別: ドキュメント更新

## 背景

`Deploy MemoRAG MVP` は承認済み `RagQualityPolicyProfile` と完全な observations を必須とするが、`dev` 環境用の承認済み policy artifact が存在しない。ユーザーは、まずこのリポジトリで policy 案を作成し、提示後に承認する方針を指定した。

## 目的

承認判断に必要な根拠、不確定点、全必須 signal/slice の閾値案を含む machine-readable draft を作成する。承認前の draft が deploy に使用されないことを保証する。

## 対象範囲

- `RagQualityPolicyProfile` schema version 2 に対応する dev policy draft
- 閾値、sample count、confidence、slice、response action の提案根拠
- confirmed / inferred / open_question の区別
- draft の構造・網羅性検証

## 対象外

- stakeholder 承認の代行
- `approvedBy` / `approvedAt` の確定
- active policy の S3 upload
- observations の作成・upload
- CDK deploy または workflow rerun

## 実施計画

1. 正規要件、benchmark profile、policy contract から根拠を抽出する。
2. 未承認であることを機械的に維持した draft generator と JSON を作成する。
3. 全必須 signal/slice、zero-tolerance、endpoint、recovery slice を検証する。
4. 閾値案の根拠と承認時の要確認事項を文書化する。
5. 対象検証、作業レポート、Draft PR、受け入れコメントを完了する。

## ドキュメント保守計画

- source inventory、確定事項、推定案、未確定事項、承認チェックリストは transient な承認案として `reports/working/` にまとめる。正規 docs validator が禁止する旧並行仕様階層は作成しない。
- 既存の正規 REQ/OPS は未承認状態を正しく記録しているため、承認前には状態を書き換えない。

## 受け入れ条件

- [ ] draft JSON が `RagQualityPolicyProfile` の構造を持つ。
- [ ] `RAG_REQUIRED_SIGNAL_IDS` と必須 case/endpoint/recovery slice に対応する gate が重複なく存在する。
- [ ] zero-tolerance signal はすべて `eq 0` とする。
- [ ] `approvedBy`、`approvedAt`、`thresholdApprovedBy`、`thresholdApprovedAt` が空で、promotion 判定が pass しない。
- [ ] 閾値案ごとに confirmed / inferred / open_question の根拠が確認できる。
- [ ] runtime/workload/price/evidence version の placeholder が承認・投入前に解決必須と明記される。
- [ ] S3 upload、GitHub variable 更新、deploy を実行しない。

## 検証計画

- draft generator の focused test
- `npm run rag:promotion:check` による未承認 fail-closed 確認
- `git diff --check`
- 変更 Markdown / JSON の構造確認

## PR レビュー観点

- 未承認案を合格済みとして扱っていないか。
- zero-tolerance の安全境界を弱めていないか。
- benchmark fixture や dataset 固有値を production runtime 分岐へ追加していないか。
- 閾値案と既存要件・benchmark profile の関係が追跡可能か。

## リスク

- latency、availability、cost は live workload / billing 未取得のため proposal に留まる。
- version placeholder を実環境値へ解決しない限り observations と一致しない。
- 承認後も representative workload で測定した observations が揃わなければ deploy は fail closed となる。
