# Search benchmark performance improvement

保存先: `tasks/done/20260506-2048-search-benchmark-performance.md`

## 状態

- done

## 背景

`.workspace/bench_20260506T113300Z_e19441d7` の search benchmark は HTTP 成功かつ p50 約294ms / p95 約305msだが、positive case で `lexicalCount=0`、`semanticCount=0`、`fusedCount=0` となり、recall 系 metric がすべて 0 になっている。

対象 benchmark の主問題は latency ではなく、benchmark 前提データ、filter、ACL、alias、search runner の整合不足により検索候補が生成されていない点と判断する。

## 目的

検索 benchmark の dataset と runner / seed 前提を整え、positive case で期待 document / file が検索候補に入り、ACL negative case で漏えいがない状態にする。

## 対象範囲

- `memorag-bedrock-mvp/benchmark/search-run.ts`
- `memorag-bedrock-mvp/benchmark/datasets/search.sample.jsonl`
- 必要に応じて `memorag-bedrock-mvp/benchmark/corpus/`
- 関連 tests / docs / reports

## 実行計画

1. `search-run.ts` と通常 QA benchmark runner の seed 差分を確認する。
2. search benchmark の seed corpus、dataset filters、expected document / chunk、ACL、alias の不整合を修正する。
3. alias case が `aliasVersion=none` のままにならないよう、benchmark 前提に approved alias または metadata alias を持たせる。
4. positive 2 件で candidate が返ることをテストする。
5. ACL negative case で no access leak が 0 のまま維持されることをテストする。
6. search benchmark を再実行し、baseline より recall が改善したことを確認する。
7. docs 更新要否を確認し、必要に応じて更新する。
8. post-task report、commit、push、PR、受け入れ条件コメント、task done 化を行う。

## ドキュメントメンテナンス計画

- 通常 API contract を変更しない場合、OpenAPI / API examples は更新不要とする。
- benchmark runner の使い方や seed 前提が変わる場合は、該当 README / docs / report に反映する。
- docs 更新不要の場合も、理由を PR 本文または作業レポートに記載する。

## 受け入れ条件

- `search-expense-001` と `search-alias-001` で検索候補が 1 件以上返る。
- positive 2 件の `recallAt20` または evaluator profile の `recallAtK` が 0 から改善する。
- `search-acl-negative-001` の `noAccessLeakCount` が 0 のまま維持される。
- alias case で検索に必要な alias が benchmark 前提として管理され、原因調査できる diagnostics が残る。
- 変更範囲に対応する API / benchmark tests が pass する。
- search benchmark rerun の結果を report または PR 本文に残す。
- 未実施検証がある場合は理由を明記し、実施済みとして扱わない。
- PR 作成後、日本語の受け入れ条件確認コメントとセルフレビューコメントを投稿する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/search/hybrid-search.test.ts`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`
- `task benchmark:sample`
- search benchmark rerun
- `git diff --check`

## PRレビュー観点

- benchmark 改善が dataset だけの過剰適合になっていないか。
- ACL negative case の漏えい防止を弱めていないか。
- alias / ACL metadata / internal project code を通常利用者へ露出していないか。
- docs と実装の同期が取れているか。
- 実行した検証と未実施検証が明確か。

## リスク

- 外部 API / remote benchmark 環境の seed 状態まではローカルだけで完全に保証できない。
- local benchmark の再現には local API server が必要になる可能性がある。
- GitHub Apps / push / PR 操作が権限やネットワークで blocked になる可能性がある。
