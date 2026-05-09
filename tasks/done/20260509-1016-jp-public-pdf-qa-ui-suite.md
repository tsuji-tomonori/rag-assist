# 日本語公開PDF QA benchmark のUI実行対応

## 背景

`dataset.jp-public-pdf-qa.jsonl` は追加済みだが、API の benchmark suite 一覧と CodeBuild runner の dataset 解決に登録されていないため、UI から選択して実行できない。

## 目的

UI の「性能テスト」画面から `jp-public-pdf-qa-v1` を選択し、非同期 benchmark run を起動できるようにする。

## スコープ

- API の benchmark suite 一覧へ `jp-public-pdf-qa-v1` を追加する。
- CodeBuild runner が `jp-public-pdf-qa-v1` の dataset を repo 内 JSONL から読み込めるようにする。
- 関連する API / Web / Infra / benchmark テストを更新する。
- PR 本文、受け入れ条件コメント、セルフレビューコメントを更新する。

## スコープ外

- 対象PDF・スキャン画像の自動ダウンロード、OCR、フル corpus seed。
- UI画面の大幅なレイアウト変更。
- 本番デプロイ、PR merge。

## 受け入れ条件

- [ ] `/benchmark-suites` の応答に `jp-public-pdf-qa-v1` が含まれる。
- [ ] UI の benchmark hook が `jp-public-pdf-qa-v1` を選択して `startBenchmarkRun` に渡せることをテストしている。
- [ ] CodeBuild runner の pre_build で `jp-public-pdf-qa-v1` の dataset が repo 内 `benchmark/dataset.jp-public-pdf-qa.jsonl` から `$DATASET` にコピーされる。
- [ ] 実PDF/OCR corpus seed は未対応であることを PR 本文・作業レポートに明記している。
- [ ] 変更範囲に見合う検証が pass している。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`

## 実施結果

- API の `benchmarkSuites` に `jp-public-pdf-qa-v1` を追加した。
- benchmark seed metadata の許可 suite に `jp-public-pdf-qa-v1` を追加した。
- CodeBuild runner の `pre_build` で `jp-public-pdf-qa-v1` のとき repo 内 `benchmark/dataset.jp-public-pdf-qa.jsonl` を `$DATASET` にコピーするようにした。
- Web hook test で UI 選択から `startBenchmarkRun` に `jp-public-pdf-qa-v1` が渡ることを確認した。
- Infra snapshot を更新した。

## 実行した検証

- `git diff --check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- useBenchmarkRuns`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass

## 未実施・制約

- 実PDF/OCR corpus seed の自動化は未対応。UIからrunは起動できるが、回答品質評価として成功させるには対象PDF・スキャン画像の取得、OCR、benchmark corpus seed の追加が必要。
- Web全体テストは未実施。変更は hook のsuite選択とAPI/infra suite定義に限定されるため、`useBenchmarkRuns` の targeted test を実行した。

## 状態

done
