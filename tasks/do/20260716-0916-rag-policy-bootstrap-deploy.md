# RAG quality policy 初回 bootstrap deploy

- 状態: do
- primary type: 修正
- 着手: 2026-07-16 09:16 JST

## 指示

承認済み dev 初期 policy `memorag-dev-rag-quality@2026-07-16.draft-1` を使い、PR を merge して実際の CDK deploy まで完了する。

## なぜなぜ分析

- confirmed: PR #360 merge 後の `Deploy MemoRAG MVP` run `29460724158` は policy と preparation artifact を upload したが、必須 observation が 112 件不足し、build/synth/deploy を保留した。
- confirmed: 初期 stack に policy の runtime/workload/price/index/prompt/pipeline/parser/chunker version context を反映しないと、同 version に一致する production observation を生成できない。
- confirmed: 現行 workflow は observation が完全でない限り CDK deploy を開始しない。
- inferred: 通常の promotion gate と初期 version 反映を同じ遷移だけで扱ったため、初期 observation を生成するための deploy と、その deploy に必要な observation が循環依存になった。
- root cause: 承認済み policy を初めて runtime へ反映する限定的な bootstrap 遷移が workflow に定義されていない。
- open_question: bootstrap 後に production source sample から全必須 observation が収束するまでの時間と、運用上 unavailable のまま残る signal は実 deploy 後に確認する。

## 対応方針

- `workflow_dispatch`、`dev`、明示 boolean、実行対象 merge SHA と policy profile/version の完全一致をすべて満たす場合だけ、初回 bootstrap deploy を許可する。
- 通常の `main` push と、authorization 不一致の手動実行は従来どおり observation 不足時に fail-closed とする。
- promotion gate は完全な evidence がある場合だけ実行し、bootstrap を通常 promotion pass と表現しない。
- workflow contract test と運用文書を同期する。

## 受け入れ条件

- [ ] 通常の `main` push は observation 不足時に build/synth/deploy を開始しない。
- [ ] bootstrap は `workflow_dispatch` の dev 実行に限定され、対象 SHA と `memorag-dev-rag-quality@2026-07-16.draft-1` の完全一致を要求する。
- [ ] bootstrap 時も承認済み policy と自動解決した S3 URI/version context を使い、架空 observation や合格値を生成しない。
- [ ] workflow contract test、lint、docs check、変更範囲に見合う build が成功する。
- [ ] PR の CI 成功後に merge し、bootstrap workflow の CDK deploy と deployment outputs artifact を確認する。
- [ ] PR に日本語の受け入れ条件確認とセルフレビューを記録する。
- [ ] 作業完了レポートを `reports/working/` に残す。
