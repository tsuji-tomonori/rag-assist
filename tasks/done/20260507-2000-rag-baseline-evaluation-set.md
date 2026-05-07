# RAG baseline evaluation set の固定

保存先: `tasks/done/20260507-2000-rag-baseline-evaluation-set.md`

## 状態

- done

## 背景

neoAI Chat 的な文書理解強化を取り入れる前に、rag-assist の現状品質を固定測定する必要がある。現状の `memorag-bedrock-mvp` は benchmark runner、search benchmark、debug trace、summary / report 出力の導線を持つが、文書構造化改善の効果を判定するには、失敗原因を検索失敗、抽出失敗、chunk 失敗、生成失敗、拒否失敗へ分解できる golden dataset が必要である。

## 目的

`answerable / unanswerable / ambiguous / table / multi-doc / ACL` を含む baseline evaluation set を作成し、以降の ingestion v2、Assistant Profile、高度検索導入の品質判定基準にする。

## 対象範囲

- `memorag-bedrock-mvp/benchmark/`
- benchmark dataset / suite config / evaluator profile
- benchmark summary / report schema
- debug trace の失敗分類
- `memorag-bedrock-mvp/docs/` の評価・運用関連 docs

## 方針

- 100 から 300 問程度の golden dataset を段階的に整備する。
- 分類は単純事実、表 QA、複数箇所統合、曖昧質問、回答不能、権限外を必須にする。
- 判定項目は `retrievalRecall@k`、`MRR@k`、`citation hit rate`、`citation support pass rate`、`refusal precision/recall`、`no-access leak`、`p95 latency` を最低限とする。
- benchmark expected phrases、QA sample 固有値、dataset 固有分岐を実装へ入れない。
- 既存の `tasks/todo/20260506-1203-benchmark-evaluator-profiles.md` と重複する evaluator profile 整備は、そちらを依存 task として扱う。

## 必要情報

- 既存 benchmark runner と report 出力。
- 既存 task: `tasks/todo/20260506-1203-benchmark-evaluator-profiles.md`
- 既存 task: `tasks/todo/20260506-2049-mmrag-docqa-production-dataset.md`
- ユーザー前提: neoAI Chat 側は前回調査の公開情報ベースであり、外部 Web 再確認は未実施。

## 実行計画

1. 現行 benchmark dataset、suite、report schema、debug trace を棚卸しする。
2. golden dataset の row schema に分類、期待根拠、期待 citation、ACL 条件、失敗分類ラベルを追加できるか確認する。
3. 6 分類を満たす seed dataset を作成する。
4. benchmark report に失敗分類を残す。
5. 現行 rag-assist で baseline run を実行し、summary / report を保存する。
6. baseline を PR または release artifact として参照できる形にする。
7. 評価関連 docs と local verification / operations を更新する。

## ドキュメントメンテナンス計画

- 要求仕様: 評価品質に関係する `FR-*`、`SQ-*`、`NFR-*`、`TC-*` の更新要否を確認する。
- architecture / design: Benchmark Runner、Debug Trace、RAG workflow、ACL guard の評価出力に影響する場合は該当 DES / ADR を更新する。
- README / local verification: baseline dataset の作成、実行、結果解釈、再生成手順を追記する。
- operations: benchmark artifact の保存場所、baseline 更新条件、regression 判定を追記する。
- PR 本文: 実行した benchmark、未実施の実環境検証、baseline artifact の場所を明記する。

## 受け入れ条件

- golden dataset が 6 分類を含む。
- 各 row が answerable / unanswerable / ambiguous / table / multi-doc / ACL の判定に必要な metadata を持つ。
- benchmark report で `retrievalRecall@k`、`MRR@k`、`citation hit rate`、`citation support pass rate`、`refusal precision/recall`、`no-access leak`、`p95 latency` を確認できる。
- 失敗原因を検索失敗、抽出失敗、chunk 失敗、生成失敗、拒否失敗のいずれかへ分類できる。
- `no-access leak = 0` を gate として扱える。
- benchmark dataset 固有の語句や分岐が RAG 実装へ入っていない。
- baseline run の summary / report が保存され、将来 PR から参照できる。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- benchmark dataset または runner 変更時: `task benchmark:sample`
- benchmark report schema 変更時: 関連 API / benchmark tests
- `git diff --check`

## PRレビュー観点

- `blocking`: ACL 外文書の存在を示唆する出力が評価上許容されていないこと。
- `blocking`: dataset 固有分岐、expected phrase 固有チューニング、QA sample row 固有値が実装へ混入していないこと。
- `should fix`: baseline artifact と evaluator profile version が PR 本文に残っていること。
- `should fix`: 未実施 benchmark を実施済みとして記載していないこと。
- `question`: golden dataset の社内文書サンプルが本番文書の分布を代表しているか。

## 未決事項・リスク

- 決定事項: Phase 0 は実装改善より前に行い、以降の改善効果判定の基準にする。
- 決定事項: `no-access leak = 0` は品質指標ではなく安全 gate として扱う。
- 実装時確認: dataset の具体的な文書と ground truth は、利用可能な社内文書サンプルまたは検証用 corpus に依存する。
- リスク: golden dataset が小さすぎると ingestion 改善や reranker 導入の効果を誤判定する。

## 完了メモ

- PR: `https://github.com/tsuji-tomonori/rag-assist/pull/161`
- 受け入れ条件確認コメント: PR #161 に投稿済み。
- セルフレビューコメント: PR #161 に投稿済み。
- 実装 commit: `2e74ec1`
- 検証: `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`、`npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`、`npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/benchmark`、`git diff --check`、`git diff --cached --check` が pass。
- 未完了検証: 実 API の `task benchmark:rag-baseline:sample` はローカル API 起動制約により未完了。PR 本文とコメントに明記済み。
- merge 解消後の追加確認: `origin/main` の final evidence 評価変更を取り込み、`noAccessLeakCount` は citation / finalEvidence / retrieved に出た forbidden evidence の一意件数として扱うよう調整した。
