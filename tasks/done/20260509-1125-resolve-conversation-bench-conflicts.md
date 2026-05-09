# 会話 RAG ベンチマーク PR の競合解消

状態: done

## 背景

PR #218 (`codex/conversation-rag-bench`) が `origin/main` 更新後に競合したため、main の新規 benchmark / UI / docs 変更を取り込みつつ、会話 RAG ベンチマーク導線を維持する必要があった。

## 受け入れ条件

- [x] `origin/main` を PR branch に取り込み、unmerged file を残さない。
- [x] MTRAG / ChatRAG Bench suite と main 側の `jp-public-pdf-qa-v1`、`mlit-pdf-figure-table-rag-seed-v1`、`architecture-drawing-qarag-v0.1` suite を併存させる。
- [x] benchmark seed whitelist、benchmark package scripts、CodeBuild buildspec、infra test、snapshot、運用 docs の競合を解消する。
- [x] 解消後に API / benchmark / infra の typecheck / test と `git diff --check` を実行する。
- [x] 作業レポートを `reports/working/` に保存する。

## 実施内容

- `origin/main` を merge し、競合した 7 ファイルを解消した。
- suite 登録と seed whitelist は、会話 benchmark suite と main 側追加 suite をすべて残した。
- CodeBuild pre_build は conversation corpus の固定設定と、main 側の architecture / jp-public PDF dynamic prepare を併存させた。
- `conversation-run.ts` を使う build phase 条件を維持した。
- `memorag-mvp-stack.snapshot.json` は infra test の `UPDATE_SNAPSHOTS=1` で再生成した。

## 検証

- [x] `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- [x] `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- [x] `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- [x] `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`
- [x] `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`
- [x] `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- [x] `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api`
- [x] `git diff --check`

## 未対応・制約

- 実 API サーバーを起動した benchmark suite の実行は、今回の競合解消範囲外として未実施。
