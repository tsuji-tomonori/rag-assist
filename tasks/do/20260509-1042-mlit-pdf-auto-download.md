# MLIT 図表 RAG seed PDF 自動 DL 対応

状態: doing

## 背景

MLIT 図表 RAG seed は UI から起動可能になったが、出典 PDF corpus は自動取得されない。ユーザーから「自動 DL まで入れ」と依頼された。

## 目的

`source_docs.csv` を基に、MLIT seed の dataset JSONL と出典 PDF corpus をローカル実行用ディレクトリへ準備できる prepare script を追加する。

## スコープ

- `source_docs.csv` から PDF URL と source_doc_id を読み取る prepare script
- PDF の自動 download、既存ファイル skip、force download
- dataset JSONL の出力先コピー
- package script 追加
- 単体テストと README 更新
- 作業レポート、PR 更新、受け入れ条件確認、セルフレビュー

## 作業計画

1. 既存 Allganize / MMRAG prepare script のパターンを確認する。
2. MLIT 専用 prepare script を追加する。
3. package script と README を更新する。
4. fetch mock を使った単体テストを追加する。
5. 変更範囲に見合う検証を実行する。

## ドキュメント保守計画

dataset README に `npm run prepare:mlit-pdf-figure-table-rag` の使い方、出力先、環境変数、実 benchmark bucket へは別途 upload が必要な点を記載する。

## 受け入れ条件

- [x] `source_docs.csv` から 3 PDF を自動 DL できる prepare script がある。
- [x] 既存 PDF は skip でき、force 指定で再 DL できる。
- [x] non-PDF response を検出して失敗できる。
- [x] dataset JSONL を指定出力先へコピーできる。
- [x] npm script から prepare script を実行できる。
- [x] README に実行方法と出力先、実環境 upload 制約を記載している。
- [x] 単体テストと typecheck を実行している。
- [ ] PR 更新後、受け入れ条件確認コメントとセルフレビューコメントを日本語で記載している。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- mlit-pdf-figure-table-rag.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `git diff --check`

## PR レビュー観点

- 実 URL download は script 実行時だけで、テストでは mock fetch を使っているか。
- download した PDF 名が dataset の `expectedFiles` と合うか。
- 実 benchmark bucket への upload を実施済みと誤記していないか。

## リスク

- 国交省 URL が将来変更・削除された場合、prepare script の download が失敗する可能性がある。
- prepare script はローカルファイル生成までであり、S3 benchmark bucket への upload は別工程である。
