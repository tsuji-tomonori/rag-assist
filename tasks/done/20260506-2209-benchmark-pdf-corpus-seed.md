# Benchmark PDF corpus seed

## 保存先

`tasks/done/20260506-2209-benchmark-pdf-corpus-seed.md`

## 状態

done

## 背景

Allganize dataset の `documents.csv` は source PDF の URL を持つ。質問だけを JSONL に変換しても、RAG 検索対象の資料が seed されなければ benchmark として実行できない。

## 目的

Allganize dataset が参照する PDF を benchmark corpus として download し、既存 `/documents` seed 経路で `application/pdf` として upload できるようにする。

## 対象範囲

- `memorag-bedrock-mvp/benchmark/allganize-ja.ts`
- `memorag-bedrock-mvp/benchmark/corpus.ts`
- `memorag-bedrock-mvp/benchmark/corpus.test.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`

## 方針

- `documents.csv` から JSONL row が要求する `expectedFiles` だけを既定で download する。
- `ALLGANIZE_RAG_DOWNLOAD_ALL_DOCUMENTS=1` で全 PDF download も可能にする。
- corpus seed は `.md` / `.txt` の text upload と、`.pdf` の `contentBase64` upload を mime type で切り替える。
- 既存の benchmark seed metadata、ACL、docType、source の隔離方針を維持する。

## 必要情報

- Allganize `documents.csv`
- `/documents` upload schema: `text` または `contentBase64`
- PDF extraction は API 側の既存 upload extraction に委譲する。
- PR: #134

## 実行計画

1. `documents.csv` を取得し、必要な `file_name` の PDF URL を抽出する。
2. PDF を `ALLGANIZE_RAG_CORPUS_DIR` に download する。
3. `benchmark/corpus.ts` の supported extension に `.pdf` を追加する。
4. `.pdf` は `contentBase64` と `application/pdf` で upload する。
5. PDF seed unit test と local smoke で upload 経路を確認する。

## ドキュメントメンテナンス計画

- `README.md` と `docs/LOCAL_VERIFICATION.md` に PDF corpus download と実行 task を記載する。
- `docs/OPERATIONS.md` に Hugging Face / PDF 配布元への outbound HTTPS 依存を記載する。
- API docs は既存 `/documents` upload contract の範囲内であり、公開 schema 変更はないため更新不要。

## 受け入れ条件

| ID | 条件 |
|---|---|
| AC-PDF-001 | `documents.csv` から必要 PDF を download できる。 |
| AC-PDF-002 | 既定では dataset row が参照する PDF だけを download する。 |
| AC-PDF-003 | `.pdf` corpus は `contentBase64` と `application/pdf` で upload される。 |
| AC-PDF-004 | seed 文書は benchmark metadata と `BENCHMARK_RUNNER` ACL で隔離される。 |
| AC-PDF-005 | mock local API に対する 1件 benchmark smoke で PDF corpus が seed される。 |

## 受け入れ条件チェック

| ID | 判定 | 根拠 |
|---|---|---|
| AC-PDF-001 | PASS | `downloadAllganizeDocuments` が `documents.csv` の `url` から PDF を保存する。 |
| AC-PDF-002 | PASS | `requiredFiles` により JSONL row の `expectedFiles` に含まれる file のみ既定 download する。 |
| AC-PDF-003 | PASS | `seedBenchmarkCorpus uploads PDF files as base64 content` test が pass。 |
| AC-PDF-004 | PASS | `corpus.ts` の既存 metadata / ACL / docType 設定を PDF upload でも共有している。 |
| AC-PDF-005 | PASS | local API smoke で `Benchmark corpus uploaded: 01.pdf (8 chunks)` を確認済み。 |

## 検証計画

- `npm run test -w @memorag-mvp/benchmark`
- `ALLGANIZE_RAG_LIMIT=1 ./node_modules/.bin/tsx benchmark/allganize-ja.ts`
- mock local API + `DATASET=.local-data/allganize-rag-evaluation-ja/dataset.jsonl ... npm run start -w @memorag-mvp/benchmark`

## PRレビュー観点

- PDF upload が既存 text corpus seed を壊していないか。
- benchmark seed ACL が通常利用者の文書一覧や通常 RAG 検索へ混入しないか。
- 外部 URL download 失敗時の運用リスクが docs / PR に明記されているか。

## 未決事項・リスク

- 決定事項: 既定では必要 PDF だけを download し、全 download は opt-in にする。
- リスク: PDF 配布元 URL の変更やネットワーク制限で dataset 準備が失敗する。
