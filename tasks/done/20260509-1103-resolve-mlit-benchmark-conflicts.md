# MLIT benchmark seed PR の競合解消

状態: done

## 背景

ユーザーから「競合解消して」と依頼された。PR branch `codex/mlit-pdf-benchmark-seed` はローカルでは clean だったが、`origin/main` が進んでおり、merge すると benchmark suite 周辺で競合した。

## 目的

`origin/main` の追加内容と MLIT benchmark seed 追加内容を両方保持し、PR #215 の競合を解消する。

## スコープ

- `origin/main` の merge
- benchmark suite 定義、seed corpus whitelist、API/Web テスト fixture の競合解消
- 対象検証
- PR 更新コメント

## 受け入れ条件

- [x] `origin/main` を PR branch に取り込み、競合マーカーが残っていない。
- [x] `architecture-drawing-qarag-v0.1` と `mlit-pdf-figure-table-rag-seed-v1` の両 suite が残っている。
- [x] benchmark seed corpus whitelist に両 suite が含まれている。
- [x] API/Web の対象テストと typecheck が pass している。
- [x] PR に競合解消結果とセルフレビューをコメントする。

## 検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts src/contract/api-contract.test.ts`: pass（168 tests）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- App.test.tsx`: pass（39 tests）
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `git diff --check`: pass

## 補足

API test 実行中に既存の chat run event stream test 由来の AccessDeniedException ログが出たが、テスト結果は pass している。
