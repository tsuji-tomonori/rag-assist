# DELETE /documents が無関係な欠損 manifest で 500 になる

## 概要

2026-05-10 01:49:51 UTC、`DELETE /documents/4ec3eb09-a00e-4f80-af55-0c2854ca0add` が 500 を返した。
CloudWatch Logs では `NoSuchKey` が記録され、欠損 key は削除対象 document ではない `manifests/55ac50f5-752f-4abd-b122-9c7fb1dfc131.json` だった。

対象 bucket は `memoragmvpstack-documentsbucket9ec9deb9-hswy0rwuzmaw`。
ユーザー確認により、`s3://memoragmvpstack-documentsbucket9ec9deb9-hswy0rwuzmaw/manifests/` に `55ac50f5-752f-4abd-b122-9c7fb1dfc131` から始まる object は現存しない。
また、bucket versioning は未設定のため、S3 object version から削除履歴を追跡できない。

## 影響

- 文書削除操作が 500 になり、UI / API 利用者には `"Internal server error"` と表示される。
- 欠損した manifest が削除対象と無関係でも、削除認可処理が全 manifest を読むため削除処理全体が失敗する。
- 同じ欠損 race が `listDocuments()` に発生した場合、文書一覧系 API も 500 になる可能性がある。

## 検知経路

- ブラウザ console の API 500 / 502 調査中、CloudWatch Logs の `Unhandled API error` として検知。
- 該当ログ:

```text
method: 'DELETE',
path: '/documents/4ec3eb09-a00e-4f80-af55-0c2854ca0add',
error: NoSuchKey
Key: 'manifests/55ac50f5-752f-4abd-b122-9c7fb1dfc131.json'
```

## 直接原因

`authorizeDocumentDelete()` が benchmark seed 権限での削除可否判定に `service.listDocuments(user)` を使っていた。
`listDocuments()` は `manifests/` 配下の全 JSON key を列挙し、`Promise.all` で全 manifest を読む。
このため、削除対象ではない `manifests/55ac...json` の読み込みが `NoSuchKey` になると、認可処理が例外で中断し、route の 404 変換にも入らず 500 になった。

## なぜなぜ分析

1. なぜ `DELETE /documents/4ec3...` が 500 になったか。
   - 認可処理中の `NoSuchKey` が未処理のまま route の上位エラーハンドラへ伝播したため。

2. なぜ削除対象ではない `55ac...` manifest を読んだか。
   - benchmark seed 削除の認可判定が対象 document だけでなく、`listDocuments(user)` で全 manifest を読み、その中から対象 document を探す実装だったため。

3. なぜ 1 件の欠損 manifest で全体が失敗したか。
   - `listDocuments()` が全 manifest の `getText()` を `Promise.all` で実行し、`NoSuchKey` / `ENOENT` 相当を skip しなかったため。

4. なぜ欠損 manifest の履歴を S3 側で追跡できないか。
   - 対象 bucket の versioning が未設定で、削除前 version や delete marker が存在しないため。

5. なぜ運用上の原因特定が難しいか。
   - CloudWatch の Lambda log だけでは S3 object の削除主体・時刻を特定できない。S3 data events または server access log が必要だが、少なくとも versioning からの復元・履歴確認はできない状態だったため。

## 根本原因

- 削除認可が対象 document に閉じておらず、全 manifest の可用性に依存していた。
- `listDocuments()` が concurrent delete / stale list に対する限定的な欠損耐性を持っていなかった。
- S3 bucket versioning 未設定により、object 欠損時の復旧性・監査性が不足していた。

## 恒久対応

- `authorizeDocumentDelete()` は `listDocuments()` を使わず、対象 `documentId` の manifest だけを読む。
- route は対象 manifest 欠損を 404 に変換する。
- `listDocuments()` は `NoSuchKey` / `ENOENT` 相当のみ skip し、他の JSON parse error や権限エラーは隠さない。
- 回帰テストで、無関係な欠損 manifest が delete / list を 500 にしないことを確認する。

## 運用上の追加推奨

- `DocumentsBucket` の versioning 有効化を検討する。
- CloudTrail S3 data events または S3 server access logs で `manifests/` prefix の `DeleteObject` / `GetObject` / `ListObjectsV2` を追跡できるようにする。
- 既存 bucket に versioning を有効化する場合はコスト、ライフサイクル、削除運用への影響を確認する。

## 制約

- 本レポート作成時点では AWS credentials がローカルにないため、CloudTrail / S3 access log の実データ確認は未実施。
- versioning 未設定のため、`55ac...` manifest の過去 version は確認できない。
