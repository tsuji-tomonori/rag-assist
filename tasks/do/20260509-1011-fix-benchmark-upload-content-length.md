# CodeBuild benchmark upload Content-Length mismatch 修正

状態: doing

## 背景

CodeBuild の `mmrag-docqa-v1` benchmark 実行で、PDF corpus の upload session 転送中に Node.js 22.22.0 / undici が `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` を投げ、benchmark runner が BUILD phase で失敗した。

## 目的

benchmark runner の upload session 転送で、実際の request body byte length と `Content-Length` header がずれないようにし、Node.js 22 の fetch 実装でも大きな PDF corpus を安全に転送できるようにする。

## Scope

- `memorag-bedrock-mvp/benchmark/corpus.ts`
- `memorag-bedrock-mvp/benchmark/corpus.test.ts`
- 障害レポート `reports/bugs/`
- 作業完了レポート `reports/working/`

## Plan

1. 失敗ログと該当コードを確認する。
2. 障害レポートとなぜなぜ分析を作成する。
3. upload session 転送の body/header 構築を修正する。
4. Content-Length 不整合を防ぐテストを追加する。
5. benchmark package の targeted test/typecheck と `git diff --check` を実行する。
6. 作業レポートを作成する。
7. commit/push/PR 作成と受け入れ条件コメントまで進める。

## Documentation maintenance plan

実装挙動は benchmark runner 内部の HTTP body/header 構築に限定される。公開 API、運用手順、ユーザー向け設定は変えないため、恒久 docs の更新は不要と判断する。障害内容と再発防止は `reports/bugs/` と `reports/working/` に残す。

## 受け入れ条件

- [ ] CodeBuild 失敗の障害レポートが `reports/bugs/` に保存され、なぜなぜ分析を含む。
- [ ] upload session 転送時に stale または誤った `Content-Length` header を API から引き継がない。
- [ ] upload session 転送 body は PDF file content と同じ byte length で送られる。
- [ ] 追加または更新したテストで header/body の関係を検証している。
- [ ] 関連する targeted test/typecheck と whitespace check が pass する。
- [ ] 作業完了レポートが `reports/working/` に保存される。

## Validation plan

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `git diff --check`

## PR review points

- Node.js 22 / undici が `Content-Length` と body size の不一致を厳格に検出する前提で修正しているか。
- upload session が返す署名用 header を壊さず、hop-by-hop/request body size header だけを除外しているか。
- benchmark dataset 固有の分岐や期待語句を実装へ入れていないか。

## Risks

- 実 CodeBuild / 実 S3 署名 URL の再実行は外部 AWS 環境を必要とするため、この作業内ではローカル unit test で再発防止を確認する。
