# PDF OCR fallback で Allganize benchmark の PDF 取り込み失敗を解消

## 背景

CodeBuild の `allganize-rag-evaluation-ja-v1` benchmark で `foodkaku5.pdf` の ingest が失敗した。
API は upload session 経由で PDF を受け取った後、抽出本文が空のため `Uploaded document did not contain extractable text` を返している。

## 目的

PDF を評価対象から除外せず、embedded text が取れない PDF でも抽出 fallback により benchmark corpus として ingest できるようにする。

## スコープ

- `memorag-bedrock-mvp` の PDF テキスト抽出経路
- 必要な AWS/Textract 依存、設定、infra 権限
- 変更範囲に見合う API/benchmark テスト
- 必要な durable docs と作業レポート

## 作業計画

1. 既存の PDF 抽出、AWS client、infra permission、docs を調査する。
2. PDF embedded text が空または低品質な場合の OCR/Textract fallback を実装する。
3. dataset 固有の PDF 除外や QA 固有分岐を入れないことを確認する。
4. 対象テスト、typecheck、差分チェックを実行する。
5. 作業レポート、commit、push、PR、受け入れ条件コメント、セルフレビューコメントを完了する。

## ドキュメント保守計画

- 新しい環境変数、AWS 権限、運用上の前提が増える場合は README/docs/infra 関連文書を更新する。
- 仕様や運用に影響しない内部実装だけで済む場合は、作業レポートに「durable docs 更新不要」の理由を記録する。

## 受け入れ条件

- [ ] Allganize benchmark の PDF を除外しない。
- [ ] embedded text 抽出が空の PDF でも OCR/Textract fallback で extractable text または structured blocks を得られる。
- [ ] `expectedFiles` と元 PDF ファイル名の対応を維持する。
- [ ] benchmark 期待語句、QA sample 固有値、dataset 固有分岐を回答ロジックへ入れない。
- [ ] 変更範囲に見合う API/benchmark/infra テストと typecheck を実行し、未実施項目は理由を記録する。
- [ ] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- infra を変更する場合は `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra` と `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`
- `git diff --check`

## PR レビュー観点

- PDF を除外せず、汎用的な OCR fallback になっていること。
- Textract 権限が最小限で、deploy/運用上の影響が明記されていること。
- RAG の根拠性、認可境界、benchmark の再現性を弱めていないこと。

## リスク

- Textract fallback は AWS 環境での権限、リージョン、コスト、処理時間に影響する可能性がある。
- ローカル mock 環境では Textract を使わない fallback または明示的な未検証扱いが必要になる可能性がある。

## 状態

in_progress
