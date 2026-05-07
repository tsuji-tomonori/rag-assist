# Benchmark timeout extension

保存先: `tasks/done/20260507-0857-benchmark-timeout-extension.md`

## 状態

- done

## 背景

benchmark report / summary / raw results では、50 件中 answerable_accuracy 76.0%、citation_hit_rate 80.0%、expected_file_hit_rate 98.0%、retrieval_recall_at_20 94.0%、refusal_precision 0.0%、p50 latency 11.3 秒、p95 latency 20.6 秒だった。全 50 件が回答可能データで、拒否は誤拒否として扱われる。

ユーザーはまずタイムアウト時間の延長を求めている。背景分析では、ans-001 が 29 秒で HTTP 504 になっており、tail latency と 504 を抑える必要がある。

## 目的

benchmark / QA 実行で 29 秒前後の tail latency が HTTP 504 にならないよう、該当するタイムアウト設定を延長する。

## 対象範囲

- `memorag-bedrock-mvp` 配下の benchmark / API / local runner / proxy など、HTTP 504 または benchmark 実行タイムアウトに関係する設定
- 必要に応じたテスト、設定、ドキュメント、作業レポート

## 実行計画

1. タイムアウト値と 504 に関係する実装・設定を検索する。
2. 29 秒付近で失敗する箇所を特定し、最小限の設定変更で余裕を持った値に延長する。
3. 変更に対して必要なテスト・型チェック・差分チェックを選定して実行する。
4. README / docs / 運用手順の更新要否を確認し、必要なら更新する。
5. 作業レポート、commit、push、PR、受け入れ条件コメント、セルフレビューコメント、task done 化を行う。

## ドキュメントメンテナンス計画

- 環境変数や運用手順を変える場合は README / docs の該当箇所を更新する。
- 内部定数のみの変更で利用手順が変わらない場合は、durable docs は更新不要とし、理由を作業レポートに記載する。

## 受け入れ条件

- 29 秒前後の benchmark / QA HTTP 実行が既定タイムアウトで 504 にならないよう、該当タイムアウトが延長されている。
- 変更は timeout / benchmark 実行経路に限定し、RAG の回答判定ロジックや検索ロジックは変更しない。
- 変更範囲に対応する最小十分な検証が pass する。
- docs 更新要否が確認され、必要な場合は更新されている。
- 未実施検証がある場合は理由を明記し、実施済みとして扱わない。
- PR 作成後、日本語の受け入れ条件確認コメントとセルフレビューコメントを投稿する。

## 検証計画

- `git diff --check`
- 変更対象に応じた targeted test / typecheck
- benchmark runner や API timeout の unit test が存在する場合は該当テスト

## PRレビュー観点

- 504 回避のための timeout 延長が過度に広範囲な変更になっていないか。
- timeout 延長により失敗検知や retry の不具合を隠していないか。
- docs と実装の同期が取れているか。
- 実行した検証と未実施検証が明確か。

## リスク

- timeout 延長は latency 自体を改善しないため、背景分析にある answerability / conflict loop の改善は別タスクとして残る。
- 実 API の upstream / hosting platform timeout が別に存在する場合、ローカル設定だけでは 504 を完全に解消できない可能性がある。
- GitHub Apps / push / PR 操作が権限やネットワークで blocked になる可能性がある。
