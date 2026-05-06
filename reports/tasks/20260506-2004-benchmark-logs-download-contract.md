# 性能テスト CodeBuild ログ DL API 契約の追加

## 保存先

`reports/tasks/20260506-2004-benchmark-logs-download-contract.md`

## 背景

性能テストの失敗時は S3 成果物が生成されないため、従来の成果物 DL だけでは原因調査に必要な CodeBuild ログへ到達しにくかった。失敗時でもログは確認できる必要がある。

## 目的

性能テスト実行履歴から CodeBuild ログを DL 操作として扱えるようにし、既存の成果物 DL API と Web 型契約へ `logs` を追加する。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/app.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.test.ts`
- `memorag-bedrock-mvp/apps/api/src/schemas.ts`
- `memorag-bedrock-mvp/apps/api/src/types.ts`
- `memorag-bedrock-mvp/apps/web/src/features/benchmark/api/benchmarkApi.ts`
- `memorag-bedrock-mvp/apps/web/src/features/benchmark/types.ts`
- `memorag-bedrock-mvp/apps/web/src/api.test.ts`

## 方針

- `POST /benchmark-runs/{runId}/download` の `artifact` に `logs` を追加する。
- `logs` は S3 署名 URL ではなく、保存済みの `codeBuildLogUrl` を返す。
- `logs` の取得は既存の `benchmark:download` 権限境界内で扱う。
- `codeBuildLogUrl` は実行履歴レスポンスの任意フィールドとして API と Web の型へ追加する。
- `logs` の DL は実行ステータスに依存させず、ログ URL の存在で可否を決める。

## 必要情報

- `BenchmarkArtifact` の許容値
- `BenchmarkRunRecord.codeBuildLogUrl`
- `createBenchmarkArtifactDownloadUrl(runId, artifact)` の分岐
- 既存のアクセス制御ポリシー

## 実行計画

1. API schema と TypeScript 型に `logs` と `codeBuildLogUrl` を追加する。
2. service 層で `logs` の場合に `codeBuildLogUrl` を返す処理を追加する。
3. S3 バケット未設定でも `logs` が取得できることを API テストで確認する。
4. Web API クライアントの artifact 型を更新する。
5. アクセス制御ポリシーに意図しない公開範囲変更がないことを確認する。

## ドキュメントメンテナンス計画

- API 例に `artifact: "logs"` を追加する。
- 設計ドキュメントに成果物種別 `logs` と CodeBuild ログ URL 返却の扱いを追記する。
- 操作手順に、失敗履歴でも CodeBuild ログを確認できることを追記する。

## 受け入れ条件

| ID | 条件 |
|---|---|
| AC-API-001 | `artifact` に `logs` を指定できる。 |
| AC-API-002 | `logs` 指定時は保存済みの `codeBuildLogUrl` が返る。 |
| AC-API-003 | `logs` 指定時は benchmark S3 bucket 未設定でも失敗しない。 |
| AC-API-004 | `codeBuildLogUrl` が API schema と Web 型に追加されている。 |
| AC-API-005 | DL API の認可境界が既存の `benchmark:download` から拡大していない。 |
| AC-API-006 | API 例と API 設計ドキュメントが更新されている。 |

## 受け入れ条件チェック

| ID | 判定 | 根拠 |
|---|---|---|
| AC-API-001 | PASS | PR #129 の `schemas.ts` と `benchmarkApi.ts` で `logs` を artifact 型に追加済み。 |
| AC-API-002 | PASS | PR #129 の `memorag-service.ts` で `logs` の場合に `codeBuildLogUrl` を返す分岐を追加済み。 |
| AC-API-003 | PASS | PR #129 の `memorag-service.test.ts` で bucket 未設定でも logs URL を返すケースを追加済み。 |
| AC-API-004 | PASS | PR #129 の API/Web 型に `codeBuildLogUrl` を追加済み。 |
| AC-API-005 | PASS | PR #129 では新規 public route を追加せず、既存 DL route の artifact 種別だけを拡張。`security/access-control-policy.test.ts` を実行済み。 |
| AC-API-006 | PASS | PR #129 で `docs/API_EXAMPLES.md` と `docs/3_設計_DES/41_API_API/DES_API_001.md` を更新済み。 |

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- memorag-service.test.ts security/access-control-policy.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- --run api.test.ts shared/utils/downloads.test.ts`

## PRレビュー観点

- `logs` が S3 成果物と同じ前提で処理され、bucket 未設定時に失敗しないか。
- ログ URL が存在しない履歴で、API と UI が明確な失敗または非活性表示になるか。
- `benchmark:download` 以外の権限でログ URL が取得できる経路が増えていないか。

## 未決事項・リスク

- 実 AWS で生成される `CODEBUILD_BUILD_URL` の形式差異は環境依存のため、PR #129 ではコード上のフォールバックとテストで担保している。
