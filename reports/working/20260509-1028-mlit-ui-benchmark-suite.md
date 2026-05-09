# 作業完了レポート

保存先: `reports/working/20260509-1028-mlit-ui-benchmark-suite.md`

## 1. 受けた指示

- 主な依頼: 前回追加した MLIT PDF 図表 RAG seed を UI から実行できるよう対応する。
- 成果物: API suite 登録、seed corpus 許可、UI/API テスト更新、README 追記、PR 更新。
- 条件: 実施していない検証を実施済み扱いしない。PR 更新時は受け入れ条件確認とセルフレビューを日本語で記載する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | UI の benchmark suite 選択肢に MLIT seed を出す | 高 | 対応 |
| R2 | CodeBuild benchmark run が MLIT dataset key で作成される | 高 | 対応 |
| R3 | benchmark seed corpus upload/ingest の許可 suite に含める | 高 | 対応 |
| R4 | 実行条件と未準備時の制約を README に記載する | 高 | 対応 |
| R5 | 関連 API/Web テストを更新し検証する | 高 | 対応 |

## 3. 検討・判断したこと

- UI は `/benchmark-suites` の返却値を select option として描画するため、UI 固定値ではなく API suite 定義に MLIT suite を追加した。
- `datasetS3Key` は `datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl` とした。実行環境ではこの key に JSONL を配置する必要がある。
- benchmark seed corpus の metadata whitelist に MLIT suite を追加し、`benchmark:seed_corpus` 権限経由の isolated corpus upload/ingest でも使えるようにした。
- API / Web / auth route の形は変更していない。認可境界は suite whitelist の対象追加に限定した。

## 4. 実施した作業

- `memorag-service.ts` の `benchmarkSuites` に `mlit-pdf-figure-table-rag-seed-v1` を追加した。
- `routes/benchmark-seed.ts` の許可 suite に MLIT suite を追加した。
- API service test で suite 一覧と create run の `datasetS3Key` を確認する assertion を追加した。
- API contract test で `/benchmark-suites` の MLIT suite 返却と seed upload whitelist を確認するよう更新した。
- Web App test で性能テスト画面から MLIT suite を選択し、POST payload に反映されることを確認するよう更新した。
- dataset README に UI 実行時の suite id、dataset S3 key、corpus 準備条件を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/rag/memorag-service.ts` | TypeScript | MLIT benchmark suite 登録 | UI 実行対象化 |
| `apps/api/src/routes/benchmark-seed.ts` | TypeScript | MLIT suite を seed corpus 許可対象へ追加 | corpus 準備対応 |
| `apps/api/src/*test.ts` | Test | suite 返却、run 作成、seed upload whitelist の検証 | API 検証 |
| `apps/web/src/App.test.tsx` | Test | UI で MLIT suite を選択して起動する検証 | UI 検証 |
| `benchmark/datasets/mlit-pdf-figure-table-rag-seed-v1/README.md` | Markdown | UI 実行条件と制約 | 文書化 |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | UI から選択して run 起動できる suite 登録まで対応した。 |
| 制約遵守 | 5 | worktree/task/report/検証/PR コメントの流れに従った。 |
| 成果物品質 | 4 | UI 起動導線は整えたが、実 benchmark bucket への dataset/corpus 配置は未実施。 |
| 説明責任 | 5 | 未配置時の実行失敗リスクを README と PR コメントに記録する。 |
| 検収容易性 | 5 | API/Web テストで suite 返却と UI 起動 payload を確認可能にした。 |

総合fit: 4.8 / 5.0（約96%）

理由: UI 実行に必要なアプリ側登録は完了した。実環境の S3 dataset/corpus 配置は環境操作を伴うため今回の範囲外。

## 7. 実行した検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts src/contract/api-contract.test.ts`: pass（168 tests）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- App.test.tsx`: pass（39 tests）
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `git diff --check`: pass

補足:
- 初回検証は `tsx` / `vitest` / `tsc` が未導入で失敗した。`npm ci` 実行後に上記検証を再実行して pass を確認した。
- `npm ci` では npm audit に 3 vulnerabilities（1 moderate、2 high）が表示されたが、今回の変更で依存関係は変更していない。

## 8. 未対応・制約・リスク

- benchmark bucket への `datasets/agent/mlit-pdf-figure-table-rag-seed-v1.jsonl` 配置は未実施。
- 出典 PDF を `benchmarkSuiteId=mlit-pdf-figure-table-rag-seed-v1` の benchmark seed corpus として投入する作業は未実施。
- 上記が未準備の環境では、UI から run 起動はできても CodeBuild benchmark が dataset/corpus 不足で失敗する可能性がある。
