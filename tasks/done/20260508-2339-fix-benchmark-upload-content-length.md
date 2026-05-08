# Benchmark upload Content-Length mismatch 修正

状態: done

## 背景

CodeBuild benchmark run `BenchmarkProject1593465D-pFhEYBpuOoZu:c39be5a0-c561-4031-9a65-9890850f1ec8` が、Allganize benchmark corpus の PDF upload session 転送時に `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` で失敗した。

## 目的

S3 presigned upload session で、実ファイルサイズと異なる `Content-Length` を runner に要求しないようにし、PDF benchmark corpus seed が Node.js 22 の `fetch` で送信前に落ちない状態にする。

## 範囲

- `memorag-bedrock-mvp` の S3 upload URL 生成処理
- 関連 API/benchmark テスト
- 作業レポート、commit、PR、PR コメント

## 計画

1. S3 upload URL 生成時の `ContentLength` / `Content-Length` 利用箇所を確認した。
2. `maxBytes` を固定 `Content-Length` として署名・返却しないよう修正した。
3. 上限検証が ingest 側で維持されることをテストと差分確認で確認した。
4. 変更範囲に見合う API/benchmark 検証を実行した。
5. 作業レポート、commit、push、PR 作成、受け入れ条件コメント、セルフレビューコメントを行った。

## ドキュメント保守計画

外部 API のレスポンス shape は維持し、`headers.Content-Length` を返さない挙動修正に留める。README や要件 docs の更新が必要な仕様変更に該当するかを実装後に確認する。

## 受け入れ条件

- [x] S3 presigned upload session の返却 headers に、最大サイズ由来の `Content-Length` が含まれない。
- [x] `maxUploadBytes` は upload session response に残り、クライアントへ上限値を伝え続ける。
- [x] ingest 時の object size 上限検証は維持される。
- [x] benchmark runner の PDF upload session 転送が `Content-Length` mismatch を誘発しない body/header 構成になる。
- [x] 変更範囲に見合うテストが pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## PR レビュー観点

- S3 presigned PUT の署名条件から実サイズと異なる固定 `Content-Length` を外せているか。
- upload size limit が消えていないか。
- Benchmark 固有値や dataset 固有分岐を実装へ追加していないか。
- 認可境界や RAG の根拠性を弱めていないか。

## リスク

- S3 presigned PUT でアップロード時点のサイズ制限が弱まり、ingest 時検証に寄る。
- 実 AWS CodeBuild 再実行は環境・権限に依存するため、PR 作成時点では未実施になる可能性がある。

## PR

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/199
- 受け入れ条件コメント: posted
- セルフレビューコメント: posted
