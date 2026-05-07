# 作業完了レポート

## 指示
- HEADで脆弱性の存否を確認し、存在する場合のみ最小修正で対処する。

## 実施内容
- `/documents/uploads` と `/documents/uploads/{uploadId}/ingest` の実装を確認し、サイズ上限未設定のまま ingest 時に全量読み込むことを再確認。
- `ObjectStore` に `getObjectSize` を追加し、S3 は `HeadObject`、local は `fs.stat` でサイズ取得可能にした。
- API config に `DOCUMENT_UPLOAD_MAX_BYTES` (既定20MiB) を追加。
- upload session 応答に `maxUploadBytes` を追加し、S3 presign に `Content-Length` を付与。
- local upload と ingest の双方でサイズ上限超過を 400 で拒否し、ingest側は超過オブジェクトを削除。
- API workspace テストを実行し全件成功。

## 成果物
- APIコード修正一式。
- 本レポート: `reports/working/20260507-0213-upload-size-limit-fix.md`

## 制約・リスク
- S3のpresigned PUTでは `Content-Length` 指定は厳密なレンジ制約ではないため、実効防御の主軸は ingest前の `HeadObject` チェック。
