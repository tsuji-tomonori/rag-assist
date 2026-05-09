# CodeBuild timeout 3h

保存先: `tasks/done/20260509-1124-codebuild-timeout-3h.md`

## 背景

2026-05-09 09:49 JST から 10:32 JST までの CodeBuild BUILD phase が `BUILD_TIMED_OUT` で失敗した。ユーザーは timeout を 3 時間へ変更することを求めている。

## 目的

benchmark runner 用 CodeBuild project の timeout を 3 時間にし、IaC、テスト、運用文書で同じ値を確認できる状態にする。

## スコープ

- `memorag-bedrock-mvp` の benchmark runner 用 CodeBuild timeout 設定。
- timeout 値に依存する infra test と運用文書。
- 実 CodeBuild の再実行や 3 時間完走確認はこのタスクでは行わない。

## 計画

1. CDK stack の benchmark CodeBuild timeout 定義を確認する。
2. timeout を 180 分へ変更する。
3. infra test と運用文書の値を更新する。
4. 差分に応じた最小十分な検証を実行する。
5. 作業レポート、commit、PR、PR コメントまで完了する。

## ドキュメントメンテナンス方針

CodeBuild timeout は運用者に見える制約のため、`memorag-bedrock-mvp/docs/OPERATIONS.md` を更新する。既存の `SQ-002` は timeout 延長時の記録条件をすでに持つため、要件ファイルの新規追加は不要と判断する。

## 受け入れ条件

- [x] AC1: benchmark runner 用 CodeBuild project の timeout が 180 分として定義されている。
- [x] AC2: infra test が CodeBuild `TimeoutInMinutes: 180` を検証する。
- [x] AC3: 運用文書が CodeBuild project timeout 3 時間とコスト影響を明記する。
- [x] AC4: 変更範囲に見合う検証を実行し、未実施の実環境確認を明記する。
- [x] AC5: PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `git diff --check`
- infra 変更に対する targeted test または Taskfile 経由の CDK/infra test
- 実 CodeBuild 再実行は長時間・外部環境依存のため未実施として記録する。

## PR レビュー観点

- CodeBuild timeout のみを 3 時間へ変更し、RAG や benchmark 評価ロジックを変更していないこと。
- Step Functions timeout が CodeBuild timeout より先に切れないこと。
- 長時間 run のコスト影響と未実施の実環境確認が文書・PR に残ること。

## リスク

- timeout 変更は実行可能時間とコスト上限を変えるが、BUILD が長くなる根本原因は解消しない。
- 実 CodeBuild での 3 時間動作確認は環境・時間・コストに依存するため、このローカル変更では静的検証までに留まる。

## 状態

done
