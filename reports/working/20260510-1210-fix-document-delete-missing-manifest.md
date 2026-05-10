# Fix document delete missing manifest

## 指示

- S3 bucket versioning が未設定で、欠損 manifest の履歴を S3 version から追えない。
- 障害レポートを作成し、なぜなぜ分析を行い、修正する。
- `/plan` 後の `go` により、実装・検証・PR まで進める。

## 要件整理

| 要件 | 対応 |
|---|---|
| 障害レポート作成 | `reports/bugs/20260510-1210-document-delete-missing-manifest-500.md` を追加 |
| なぜなぜ分析 | 障害レポートに 5 why と根本原因を記載 |
| 無関係な欠損 manifest による DELETE 500 防止 | `authorizeDocumentDelete()` を対象 manifest 読み取りに変更 |
| 文書一覧の欠損 race 緩和 | `listDocuments()` で missing object のみ skip |
| 対象欠損時の DELETE 404 | route の try/catch 範囲を認可処理まで拡張 |
| 認可境界維持 | benchmark seed manifest 判定を対象 manifest に対して継続 |
| 検証 | API test、API typecheck、`git diff --check` を実行 |

## 検討・判断

- CloudWatch log の削除対象は `4ec3...` だが、欠損 key は `55ac...` であり、削除対象と無関係な manifest 読み込みが失敗していた。
- 直接原因は `authorizeDocumentDelete()` が `listDocuments()` で全 manifest を読むこと。
- 認可で全 manifest に依存する必要はないため、対象 `documentId` の manifest だけを読む方針にした。
- `listDocuments()` は S3 list 直後の concurrent delete race に限定して、`NoSuchKey` / `ENOENT` 相当だけ skip する。JSON 破損や権限エラーは隠さない。
- API schema / OpenAPI shape は変わらないため、durable docs の更新は障害レポートに限定した。

## 実施作業

- `MemoRagService.getDocumentManifest()` を追加し、既存 private manifest loader を再利用した。
- `MemoRagService.listDocuments()` で missing manifest を skip し、警告ログを出すようにした。
- `authorizeDocumentDelete()` を `listDocuments()` 依存から対象 manifest 読み取りへ変更した。
- `DELETE /documents/{documentId}` route の 404 変換範囲に認可時の対象 manifest 読み取りを含めた。
- service / contract / security policy tests を追加・更新した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `reports/bugs/20260510-1210-document-delete-missing-manifest-500.md` | 障害レポート、なぜなぜ分析、再発防止策 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | target manifest accessor と missing manifest skip |
| `memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts` | benchmark seed delete 認可の対象限定 |
| `memorag-bedrock-mvp/apps/api/src/routes/document-routes.ts` | 認可中の対象欠損を 404 に変換 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.test.ts` | stale manifest skip と対象限定認可の回帰テスト |
| `memorag-bedrock-mvp/apps/api/src/contract/api-contract.test.ts` | missing target delete が 404 になる contract test |
| `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` | 認可静的ガードの更新 |

## 実行した検証

- `npm ci`: pass。専用 worktree に `node_modules` がなかったため実行。既存依存として `npm audit` が 3 vulnerabilities を報告。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: 初回 fail (`tsx` 未導入、後に依存導入)。2 回目 fail（同名関数重複）。修正後 pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。

## Fit 評価

総合fit: 4.7 / 5.0

理由: 障害レポート、なぜなぜ分析、恒久対応、回帰テスト、検証を実施した。S3 versioning / CloudTrail data event の有効化は本番インフラ・運用判断を伴うため、今回は障害レポートの推奨事項として記録した。

## 未対応・制約・リスク

- AWS credentials がローカルにないため、CloudTrail / S3 access log の実データ確認は未実施。
- S3 bucket versioning は今回のコード修正では有効化していない。コストと lifecycle policy を含めて別途判断が必要。
- `npm audit` の 3 vulnerabilities は既存依存の問題として未対応。
