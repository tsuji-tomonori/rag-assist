# CodeBuild ログ本文 txt ダウンロード

## 背景

性能テストは管理 API から CodeBuild runner を起動でき、履歴には CodeBuild log URL が保存されている。一方で、画面のログ DL は AWS Console URL への導線であり、API 経由でログ本文を `.txt` として取得する契約が不足している。

## 目的

性能テスト run の CodeBuild ログ本文を API 経由で取得できるようにし、Web 画面の DL ボタンから `.txt` ファイルとして保存できるようにする。

## スコープ

- API: benchmark run 用ログ本文 download endpoint / service / schema / tests
- Infra: API Lambda が対象 CodeBuild logs を読むための最小 IAM 権限
- Web: CodeBuild ログ DL ボタンで txt Blob を保存する処理
- Docs: README、OpenAPI、必要な運用・要求 docs の同期
- Tests: API/Web/Infra/docs の対象検証

## 作業計画

1. 既存 benchmark route、store、CodeBuild buildspec、UI download helper を確認する。
2. CodeBuild log group / stream を run に保存し、既存 run 互換の fallback を設計する。
3. `GET /benchmark-runs/{runId}/logs` を追加し、`benchmark:download` で保護する。
4. Web の CodeBuild ログ DL を endpoint fetch + Blob download へ変更する。
5. docs / OpenAPI / tests / IAM assertion を更新する。
6. 検証、作業レポート、commit、push、PR、受け入れ条件コメント、セルフレビューコメントを完了する。

## ドキュメント保守計画

- API endpoint 追加のため OpenAPI generated docs を更新する。
- `memorag-bedrock-mvp/README.md` の性能テスト説明を更新する。
- 既存の要求/運用 docs にログ本文 download の明示が必要か確認し、必要なら追記する。

## 受け入れ条件

- AC-001: Codex/API から既存の `POST /benchmark-runs` で性能テストを起動できる契約を壊さない。
- AC-002: `GET /benchmark-runs/{runId}/logs` が CodeBuild ログ本文を `text/plain; charset=utf-8` で返す。
- AC-003: ログ本文 API は `benchmark:download` 権限で保護され、新規 public route にならない。
- AC-004: ログ group / stream が保存済みの run では CloudWatch Logs から本文を取得できる。
- AC-005: ログ group / stream が未保存でも `codeBuildBuildId` から取得可能な場合は fallback できる。
- AC-006: ログが存在しない run は 404 などの失敗として扱い、成功 artifact と誤認させない。
- AC-007: Web の CodeBuild ログ DL ボタンが API から本文を取得し、`benchmark-logs-<runId>.txt` として保存する。
- AC-008: 失敗 run でも CodeBuild log stream がある場合はログ DL ボタンを有効にする。
- AC-009: API Lambda の IAM は benchmark CodeBuild logs / builds 取得に必要な最小権限に限定する。
- AC-010: README / OpenAPI / 関連 docs が実装と同期している。
- AC-011: API/Web/Infra/docs の対象テストを実行し、未実施がある場合は理由を明記する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present`
- `task memorag:cdk:test`
- `task docs:openapi`
- `task docs:openapi:check`
- `git diff --check`

## 検証結果

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: 初回 snapshot / assertion 更新後 pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `task memorag:cdk:test`: pass
- `task docs:openapi`: pass
- `task docs:openapi:check`: pass
- `git diff --check`: pass

## 受け入れ条件確認メモ

- AC-001: 既存 `POST /benchmark-runs` の route / schema を維持。API contract test pass。
- AC-002: `GET /benchmark-runs/{runId}/logs` を追加し `text/plain; charset=utf-8` で返却。
- AC-003: route-level `benchmark:download` と auth middleware 静的 test を更新して pass。
- AC-004: `codeBuildLogGroupName` / `codeBuildLogStreamName` を使う service test を追加して pass。
- AC-005: `CodeBuildLogReader` が `codeBuildBuildId` fallback で `BatchGetBuilds` から log metadata を解決。
- AC-006: run または logs 未存在時は 404 相当として扱う route を追加。
- AC-007: Web download helper が logs の場合に Blob `.txt` 保存。
- AC-008: UI は log stream / build ID / URL のいずれかがあればログ DL を有効化。
- AC-009: API Lambda に `logs:GetLogEvents` と `codebuild:BatchGetBuilds` を対象 resource 限定で追加し、Infra assertion pass。
- AC-010: README / OpenAPI / 要求 docs / 運用 docs を更新。
- AC-011: 上記検証を実行。実 AWS CodeBuild run は未実施。

## PR レビュー観点

- `benchmark:download` の認可境界を広げていないか。
- CloudWatch Logs / CodeBuild の IAM scope が過剰でないか。
- ログ本文に機微情報が含まれ得るため、通常利用者へ露出しないこと。
- UI が署名 URL 前提の処理で認証付き text API を誤って扱っていないか。
- 実 AWS CodeBuild での確認有無を実施済みとして書いていないか。

## リスク

- 実 AWS の既存 run は log group / stream 未保存の場合があり、fallback の可否は CodeBuild API の build metadata に依存する。
- CloudWatch Logs の量が大きい場合、API Gateway/Lambda response size 上限に達する可能性があるため、取得上限を設ける必要がある。
- 実 AWS CodeBuild 実行は環境・認証に依存するため、ローカル検証では単体/契約/IAM assertion が中心になる可能性がある。

## 状態

in_progress
