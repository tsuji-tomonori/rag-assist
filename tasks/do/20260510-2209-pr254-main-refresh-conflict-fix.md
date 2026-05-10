# PR254 最新main再取り込みの競合解消

状態: do

## 背景

PR #254 の競合解消と CI 成功後、GitHub の mergeable 判定が `CONFLICTING / DIRTY` を返した。`git fetch origin` で `origin/main` が PR #256 merge commit `e2c3ce6` まで進んでいることを確認した。

## 目的

PR #254 を最新 `origin/main` に対しても conflict なく merge 可能な状態へ戻す。

## タスク種別

修正

## 受け入れ条件

- [ ] 最新 `origin/main` を PR #254 branch に取り込む。
- [ ] merge conflict が発生した場合は解消する。
- [ ] `git diff --check` が pass する。
- [ ] 必要な web 検証を再実行し、pass または未実施理由を記録する。
- [ ] PR #254 に対応結果とセルフレビューをコメントする。

## 検証計画

- `git diff --check`
- conflict 範囲に応じた web test / typecheck / inventory check

## リスク

- `origin/main` の最新変更が document list pagination を含むため、DocumentWorkspace 周辺で再度競合する可能性がある。
