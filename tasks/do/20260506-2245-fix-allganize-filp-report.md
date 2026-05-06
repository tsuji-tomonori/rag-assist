# Allganize JA corpus PDF 404 修正

## 背景

CodeBuild の `allganize-rag-evaluation-ja-v1` 実行で `prepare:allganize-ja` が失敗している。原因は `benchmark/allganize-ja.ts` が取得する財務省 FILP Report 2022 PDF の URL が HTTP 404 を返すこと。

## 目的

Allganize JA ベンチマーク用 corpus 準備を、現在取得可能な PDF 参照で再現可能に通す。

## スコープ

- `memorag-bedrock-mvp/benchmark/allganize-ja.ts` の Allganize 文書取得定義または取得処理
- 必要な最小限の検証・レポート
- 必要と判断した場合のみ、関連ドキュメント

## 計画

1. 失敗 URL と周辺の文書定義・ダウンロード処理を確認する。
2. 財務省 PDF の現行取得先を確認する。
3. URL 更新または fallback を実装し、失敗時ログを必要に応じて改善する。
4. 変更範囲に応じた検証を実行する。
5. 作業レポート、commit、PR、受け入れ条件確認コメント、セルフレビューコメントまで完了する。

## ドキュメント保守方針

URL 変更や fallback のみで利用者向け手順・API・運用手順が変わらない場合、恒久ドキュメントは更新しない。ベンチマーク corpus の取得仕様や運用が変わる場合は関連 README/docs を確認して最小更新する。

## 受け入れ条件

- `prepare:allganize-ja` が `FILP_Report2022.pdf` の 404 で失敗しない。
- 修正後の Allganize corpus 準備で対象 PDF が取得される。
- 取得先 URL 変更の根拠を確認している。
- 変更範囲に見合う検証を実行し、結果を PR 本文・コメント・作業レポートに記録している。
- 未実施の検証がある場合は、理由と残リスクを明記している。

## 検証計画

- `npm run prepare:allganize-ja -w @memorag-mvp/benchmark`
- `npm run typecheck -w @memorag-mvp/benchmark`
- `git diff --check`

## PR レビュー観点

- 外部 URL 変更に対して妥当な取得先を参照していること。
- Benchmark 以外の挙動、RAG の根拠性、認可境界に影響しないこと。
- 未実施の検証を実施済み扱いしていないこと。

## リスク

- 外部省庁サイトの PDF URL は今後も変更される可能性がある。
- full dataset のダウンロード検証はネットワーク状態に依存する。

## 状態

do
