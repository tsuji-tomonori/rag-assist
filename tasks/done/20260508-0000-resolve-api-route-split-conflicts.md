# API route split conflict resolution

## 背景

PR #181 の API route 分割 branch が main と競合しているため、最新 `origin/main` を取り込んで競合を解消する。

## 目的

PR #181 を main に対して merge 可能な状態へ戻す。

## スコープ

- `origin/main` の取り込み
- 競合ファイルの解消
- route 分割構成と main 側変更の両立
- 必要な検証、PR コメント、task 完了更新

## 非スコープ

- API 仕様変更
- permission 緩和
- unrelated refactor

## 受け入れ条件

- [ ] `origin/main` の変更が PR branch に取り込まれている。
- [ ] merge/rebase conflict が残っていない。
- [ ] API route 分割構成が維持され、main 側の変更が失われていない。
- [ ] 必要な API typecheck/test と `git diff --check` / pre-commit が pass する。
- [ ] PR #181 に競合解消後の受け入れ条件確認とセルフレビューを投稿する。
- [ ] task md を `tasks/done/` に移動し、同じ PR branch に push する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `git diff --check`
- `pre-commit run --files ...`

## 完了メモ

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/181
- merge commit: `4433460`
- 受け入れ条件確認コメント: 投稿済み
- セルフレビューコメント: 投稿済み

## 状態

done
