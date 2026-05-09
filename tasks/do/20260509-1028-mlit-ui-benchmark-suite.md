# MLIT 図表 RAG seed の UI 実行対応

状態: doing

## 背景

前作業で `mlit-pdf-figure-table-rag-seed-v1` の CSV/JSONL データ資産を追加したが、API の benchmark suite 定義に未登録のため UI の「テスト種別」からは選択できない。ユーザーから「対応して」と依頼された。

## 目的

MLIT 図表 RAG seed を UI から選択して CodeBuild benchmark run を起動できる suite として登録する。

## スコープ

- API の benchmark suite 一覧への MLIT suite 追加
- benchmark seed corpus upload/ingest の許可 suite 追加
- UI/API テスト fixture の更新
- README / PR / 作業レポートへの実行条件と制約の追記

## 作業計画

1. 既存の suite 定義、seed 許可、Web 表示、テストを確認する。
2. MLIT suite を agent benchmark として登録する。
3. 関連テストを更新する。
4. 変更範囲に見合う検証を実行する。
5. レポート、commit、push、PR コメントを更新する。

## ドキュメント保守計画

dataset README に UI 実行時の suite id、dataset S3 key、必要な corpus 準備を追記する。生成 docs は必要な検証コマンドで更新要否を判断する。

## 受け入れ条件

- [x] `GET /benchmark-suites` の返却対象に `mlit-pdf-figure-table-rag-seed-v1` が含まれる。
- [x] UI の benchmark suite select が API 返却により MLIT suite を選択可能になる。
- [x] benchmark seed corpus upload/ingest の許可 suite に MLIT suite が含まれる。
- [x] dataset README に UI 実行条件、dataset S3 key、corpus 準備制約を記載している。
- [x] 関連する API/Web/benchmark テストを更新し、変更範囲に見合う検証を実行している。
- [x] 作業完了レポートを `reports/working/` に作成している。
- [ ] PR 更新後、受け入れ条件確認コメントとセルフレビューコメントを日本語で記載している。

## 検証計画

- API service / contract / security 周辺の対象テスト
- Web benchmark 表示・hook 周辺の対象テスト
- benchmark workspace の typecheck または関連 package typecheck
- `git diff --check`

## PR レビュー観点

- UI 表示だけでなく API suite / seed upload 許可 / runner dataset key が揃っているか。
- API route の認可境界を弱めていないか。
- MLIT 固有の期待語句や dataset id 分岐を RAG 実装へ混入させていないか。
- 実行に必要な S3 dataset/corpus 準備が未実施なら、未実施として明記されているか。

## リスク

- UI から run 起動は可能になるが、実行環境の benchmark bucket に `datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl` と出典 PDF corpus が未配置の場合、CodeBuild 側で失敗する可能性がある。
