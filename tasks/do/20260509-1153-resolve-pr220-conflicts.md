# PR #220 競合解消と timeout 値確認

状態: do

## 背景

PR #220 `codex/codebuild-timeout-3h` は GitHub 上で `DIRTY` になっており、`main` への merge conflict 解消が必要。
ユーザーから、3時間へ延長したい意図に対して snapshot では `480` から `180` へ減っているように見えるため、適切か確認して必要なら修正するよう依頼された。

## 目的

- PR #220 の競合を解消し、`main` へ merge 可能な状態へ戻す。
- CodeBuild timeout が 3時間として表現されているか、snapshot/test/doc の値を含めて確認する。

## スコープ

- 対象: PR #220 の head branch、infra CodeBuild timeout、関連 test/snapshot/doc、PR コメント、作業レポート。
- 対象外: 実 AWS CodeBuild の長時間実行、PR merge、production deploy。

## 作業計画

1. PR head 用 worktree で `origin/main` を取り込む。
2. conflict 箇所を確認し、PR #220 の意図と main 側の更新を両立させる。
3. `480 -> 180` の意味を確認し、3時間 timeout として正しいかを判断する。
4. 変更範囲に見合う検証を実行する。
5. commit / push 後、PR へ受け入れ条件確認とセルフレビューを日本語で投稿する。

## ドキュメント保守方針

infra timeout の実値または運用上の説明が変わる場合は `memorag-bedrock-mvp/docs/OPERATIONS.md` を更新する。
値の解釈確認のみで文書が既に正しい場合は、作業レポートと PR コメントに判断根拠を記録する。

## 受け入れ条件

- AC1: PR #220 の merge conflict が解消され、branch が `origin/main` を取り込んだ状態で push されている。
- AC2: benchmark runner 用 CodeBuild project の timeout が 3時間を表す `180` 分として、実装・test・snapshot・doc で整合している。
- AC3: `480 -> 180` は 8時間から3時間への変更であり、3時間化の意図に対して減少が正しいか、PR コメントと作業レポートで説明されている。
- AC4: 変更範囲に見合う検証を実行し、未実施の検証があれば理由を明記している。
- AC5: PR #220 に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿している。

## 検証計画

- `git diff --check`
- infra の targeted test/typecheck。具体コマンドは conflict 解消後の変更範囲と Taskfile/package script を確認して選ぶ。
- 必要に応じて snapshot 生成を伴う infra test を実行する。

## PR review 観点

- snapshot の `TimeoutInMinutes` が 3時間を分単位で表す `180` になっているか。
- main 側の benchmark / infra 変更を消していないか。
- docs と実装の timeout 記述が同期しているか。
- RAG の根拠性、認可境界、benchmark dataset 固有分岐を弱めていないか。

## リスク

- 実 AWS CodeBuild の長時間実行は課金と外部環境を伴うため、今回の標準検証では実施しない。
- snapshot conflict は広範囲に見えやすいため、最終差分で timeout 以外の意図しない churn を確認する。
