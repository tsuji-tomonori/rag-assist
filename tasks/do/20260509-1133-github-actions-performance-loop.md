# GitHub Actions 性能テスト実行ループ

状態: doing

## 背景

PR #221 で multi-turn / conversational RAG benchmark の P0/P1 が追加された。ユーザーから、新しく追加した性能テストを GitHub Actions から実行して性能改善ループを回すよう依頼された。

## 目的

GitHub Actions から新しい benchmark suite を実行できる状態にし、Actions 実行結果を確認して、必要な性能・実行性の改善を行う。

## スコープ

- `memorag-benchmark-run.yml` の手動実行入力が新 suite を選択できるか確認・修正する。
- GitHub Actions で新 suite を実行し、結果・artifact・ログを確認する。
- 実行失敗または性能上の明確な改善点があれば、範囲内で修正して再実行する。
- PR コメントと作業レポートに実施結果を残す。

## 作業計画

1. GitHub Actions workflow と benchmark suite 定義を確認する。
2. Actions から新 suite を選べない場合は workflow を修正する。
3. ローカルで変更範囲に見合う検証を実行する。
4. 変更を commit / push し、PR #221 を更新する。
5. GitHub Actions から benchmark を実行し、結果を確認する。
6. 結果に応じて修正・再実行のループを回す。
7. PR に受け入れ条件確認・セルフレビュー・性能テスト結果をコメントする。

## ドキュメント保守計画

本作業は CI workflow と benchmark 実行導線の変更が中心。README や仕様ドキュメントに手動 benchmark suite 一覧の同期記述がある場合は更新要否を確認する。該当がなければ PR 本文・コメント・作業レポートで理由を記録する。

## 受け入れ条件

- [ ] GitHub Actions の `Run MemoRAG Benchmark` から新 suite を選択できる。
- [ ] 少なくとも 1 つの新 suite を GitHub Actions から実行し、run URL / 結果 / artifact 有無を記録する。
- [ ] 実行結果から確認できる失敗または改善点に対して、修正または未対応理由を記録する。
- [ ] 変更範囲に見合うローカル検証を実行し、結果を記録する。
- [ ] PR #221 に日本語コメントで受け入れ条件確認とセルフレビューを残す。
- [ ] 作業完了レポートを `reports/working/` に作成する。

## 検証計画

- `git diff --check`
- benchmark workflow YAML の suite-id 選択肢と benchmark suite 定義の整合確認
- 必要に応じて `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`

## PR レビュー観点

- Actions から実行する suite ID が API 側の suite ID と一致しているか。
- 既存 suite の選択肢や既存実行導線を壊していないか。
- 実 benchmark 結果を未検証なのに pass と扱っていないか。

## リスク

- GitHub Actions の benchmark 実行は AWS 環境・secrets・environment approval に依存するため、リポジトリ権限や環境制約で blocked になる可能性がある。
