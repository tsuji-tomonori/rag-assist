# PR159 競合解消と OCR 非同期化検討

状態: do

## 背景

PR #159 は MMRAG DocQA benchmark seed 中の Textract OCR timeout を `skipped_unextractable` として扱う修正を入れている。一方で `origin/main` には benchmark corpus scope 固定の更新が入り、`memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md` で競合した。

また PR #160 では通常文書取り込みが `POST /document-ingest-runs` と Step Functions + worker Lambda による非同期 run 化へ進んでいるが、PR #160 本文では benchmark seed runner は既存同期 ingest API のままと明記されている。

## 目的

- PR #159 の `origin/main` merge conflict を解消する。
- PR #160 を踏まえ、OCR timeout の根本対策として benchmark seed の非同期 ingest 化方針を検討し、後続 task として整理する。
- PR #159 の修正範囲では、既存の timeout skip 修正と `origin/main` の benchmark scope 固定を両立させる。

## スコープ

- `origin/main` を PR #159 branch に merge する。
- `LOCAL_VERIFICATION.md` の競合を解消する。
- PR #160 を参考に、benchmark seed / OCR 非同期化の後続計画 task を `tasks/todo/` に作成する。
- 変更範囲に対する最小十分な検証を実行する。
- PR #159 に更新コメントとセルフレビューコメントを追加する。

## 非スコープ

- この PR で benchmark seed runner を非同期 ingest API に移行すること。
- PR #160 の通常文書取り込み非同期化を PR #159 に取り込むこと。
- AWS CodeBuild の全量再実行。

## 受け入れ条件

- [ ] `origin/main` との merge conflict が解消されている。
- [ ] `LOCAL_VERIFICATION.md` に benchmark suite filter 強制と OCR timeout skip の説明が両方残っている。
- [ ] PR #160 を踏まえた benchmark seed OCR 非同期化の後続 task が作成されている。
- [ ] 変更範囲に対応する検証が実行され、結果が記録されている。
- [ ] PR #159 に更新コメントとセルフレビューコメントが投稿されている。

## 検証計画

- `git diff --check`
- `pre-commit run --files <changed markdown files>`
- benchmark targeted test/typecheck の必要性を差分から判断する。

## リスク

- merge commit に `origin/main` の既存変更が多数含まれるため、PR #159 固有の差分確認では conflict 解消箇所と追加 task/report を中心に見る必要がある。
- 非同期 OCR 化は API / worker / infra / benchmark runner の横断変更になるため、PR #159 に混ぜると scope が大きくなりすぎる。
