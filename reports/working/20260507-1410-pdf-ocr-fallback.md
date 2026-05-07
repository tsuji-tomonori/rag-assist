# 作業完了レポート

保存先: `reports/working/20260507-1410-pdf-ocr-fallback.md`

## 1. 受けた指示

- 主な依頼: CodeBuild の Allganize benchmark で `foodkaku5.pdf` の ingest が `Uploaded document did not contain extractable text` により失敗する問題を修正する。
- 追加指示: PDF は評価対象なので除外しない。
- 成果物: PDF OCR fallback 実装、infra 権限と設定、関連テスト、運用ドキュメント、task md、PR。
- 条件: dataset 固有の期待語句や PDF 除外で回避しない。実施していない検証を実施済みとして書かない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | PDF を Allganize benchmark の評価対象から除外しない | 高 | 対応 |
| R2 | embedded text が空の PDF でも fallback で抽出できる | 高 | 対応 |
| R3 | benchmark 期待語句、QA sample 固有値、dataset 固有分岐を回答ロジックへ入れない | 高 | 対応 |
| R4 | API/infra/benchmark の対象検証を実行する | 高 | 対応 |
| R5 | Worktree Task PR Flow に従い、task md と PR コメントまで進める | 高 | 進行中 |

## 3. 検討・判断したこと

- PDF を除外する案は、ユーザー指摘どおり評価対象を欠落させるため採用しなかった。
- CodeBuild の失敗経路は `/documents/uploads` で S3 に転送した PDF を `/documents/uploads/{uploadId}/ingest` する経路であるため、S3 object location を API 内部の OCR fallback に渡す設計にした。
- Amazon Textract は同期 `DetectDocumentText` と非同期 `StartDocumentTextDetection` / `GetDocumentTextDetection` を使い分け、S3 object location がある PDF では複数ページ PDF に向く非同期 OCR を使う。
- OCR fallback は `PDF_OCR_FALLBACK_ENABLED` で明示有効化し、CDK では ingest を行う API Lambda のみ有効化する。chat worker 系 Lambda には Textract 権限を付けない。
- 回答生成、retrieval、benchmark scoring には dataset 固有分岐を入れず、文書抽出パイプラインの汎用 fallback として実装した。

## 4. 実施した作業

- `@aws-sdk/client-textract` を API workspace に追加した。
- PDF embedded text 抽出が空の場合に Textract OCR fallback を呼ぶ処理を `text-extract.ts` に追加した。
- upload session ingest 時に S3 bucket/key を抽出器へ渡すようにした。
- API Lambda に Textract text detection 権限と OCR fallback 環境変数を追加した。
- Textract fallback の unit test、infra IAM/env assertion、CloudFormation snapshot を更新した。
- README と Operations に PDF OCR fallback の前提と環境変数を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/rag/text-extract.ts` | TypeScript | PDF OCR fallback 実装 | R1, R2, R3 |
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | upload session の S3 object location 引き渡し | R2 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | CDK | API Lambda の Textract 権限と env | R2 |
| `memorag-bedrock-mvp/apps/api/src/rag/text-processing.test.ts` | Test | embedded text 空 PDF の OCR fallback 回帰テスト | R2 |
| `memorag-bedrock-mvp/README.md`, `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | OCR fallback の運用前提 | R4 |
| `tasks/do/20260507-1402-fix-pdf-ocr-fallback.md` | Markdown | task 状態と受け入れ条件 | R5 |

## 6. 検証結果

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/rag/text-processing.test.ts`: pass。npm script の glob により API test 全体 158 件も実行された。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass。snapshot 更新用。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.7/5 | PDF 除外をやめ、抽出 fallback と infra まで対応した。実 AWS Textract で `foodkaku5.pdf` を再実行する確認は未実施。 |
| 制約遵守 | 5/5 | dataset 固有分岐、期待語句固定、PDF 除外を避けた。 |
| 成果物品質 | 4.5/5 | unit/infra/docs を更新した。Textract job timeout は運用で調整余地がある。 |
| 説明責任 | 4.8/5 | 判断理由、検証結果、残リスクを明記した。 |
| 検収容易性 | 4.7/5 | task md、テスト、docs、snapshot が揃っている。 |

**総合fit: 4.7/5（約94%）**

理由: 主要要件は満たしたが、実 AWS 環境で対象 PDF の OCR 完了時間と抽出結果を確認するところは PR 後の deploy/run に依存するため満点ではない。

## 8. 未対応・制約・リスク

- 未対応: 実 CodeBuild run の再実行は未実施。
- 制約: Textract OCR fallback は AWS 権限、リージョン、対象 PDF サイズ、処理時間、Textract quota に依存する。
- リスク: `PDF_OCR_FALLBACK_TIMEOUT_MS=45000` を超える PDF は ingest 失敗として残る。必要に応じて API timeout と非同期 ingest 設計を別途検討する。
- 後続: PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを投稿し、task md を `done` に移動する。
