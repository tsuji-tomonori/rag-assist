# PR326 upload session benchmark seed 境界修正

- 状態: in_progress
- タスク種別: 修正
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/326

## 背景

再レビューで、legacy `POST /documents` の benchmark seed 境界は修正済みだが、upload session 経由の通常文書 ingest で benchmark seed metadata を混ぜられる経路が残っていると指摘された。

## 目的

`purpose=document` の upload session ingest では benchmark seed 予約 metadata を拒否し、benchmark seed corpus の作成・非同期 ingest は `benchmark:seed_corpus` 権限と `purpose=benchmarkSeed` に限定する。

## スコープ

- `authorizeUploadedDocumentIngest` 付近の権限境界修正
- upload session 同期 ingest と非同期 ingest run の回帰テスト追加
- benchmarkSeed upload session の許可ケース維持確認
- 必要最小限の検証、PR コメント、作業レポート

## なぜなぜ分析サマリ

- confirmed: `uploadPurposeForKey` は object key が `uploads/documents/...` の場合に `document` を返す。
- confirmed: `authorizeUploadedDocumentIngest` は `purpose === "document"` の場合、body metadata が benchmark seed 形か確認せず、`rag:doc:write:group` の有無だけで許可している。
- confirmed: `scopedMetadata` は document purpose の group scope と writable を確認するが、base metadata は保持する。
- inferred: legacy `POST /documents` の seed 判定修正が upload session の body metadata 予約 key 境界まで水平展開されていなかった。
- root cause: benchmark seed 判定が direct upload body と benchmarkSeed object purpose に偏り、document purpose の uploaded-object ingest における予約 metadata 混入拒否が auth 境界に存在しなかった。
- remediation: `purpose=document` で benchmark seed 形 metadata と seed 予約 metadata を拒否し、同期/非同期の route contract と authorization unit test で固定する。
- open question: seed 予約 key の完全な公開 contract は未文書化だが、既存 whitelist 定義を権限境界に再利用することで今回の混入経路は閉じられる。

## 実装計画

1. benchmark seed metadata 予約 key の検出 helper を追加する。
2. `authorizeUploadedDocumentIngest` で `purpose=document` の seed 形 metadata / 予約 key 混入を 403 にする。
3. contract test に document upload session の同期 ingest 拒否、document ingest run 拒否、benchmarkSeed 許可維持を追加する。
4. API の targeted test と typecheck を実行する。
5. 作業レポート、commit、push、PR コメントを行う。

## ドキュメント保守計画

内部の権限境界修正で API shape や利用手順は変えない。既存の OpenAPI 説明は「purpose と scope に応じた permission」を示しており、恒久 docs の更新は不要と判断する。判断理由は作業レポートに残す。

## 受け入れ条件

- `purpose=document` の upload session 同期 ingest に benchmark seed 形 metadata と valid group scope を渡すと 403 になり、文書が作成されない。
- `purpose=document` の `/document-ingest-runs` に benchmark seed 形 metadata と valid group scope を渡すと 403 になる。
- `purpose=benchmarkSeed` の upload session は `BENCHMARK_RUNNER` / `benchmark:seed_corpus` で benchmark seed metadata を ingest または ingest run 開始できる。
- `authorizeUploadedDocumentIngest` の unit test で document writer が benchmark seed metadata を拒否される。
- 変更範囲に見合う API contract test と typecheck が pass する。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `git diff --check`

## PR レビュー観点

- benchmark seed 予約 metadata が document purpose に混入しないこと
- `benchmark:seed_corpus` の許可ケースを壊していないこと
- 通常文書の group scope 必須・writable 確認を弱めていないこと

## リスク

- 既存の通常文書が偶然 benchmark seed 予約 key を使っていた場合は 403 になる。ただし予約 metadata は benchmark seed 隔離用であり、document purpose での利用は境界違反として扱う。
