# PR #201 競合解消

## 背景

PR #201 `codex/benchmark-codebuild-log-text-download` は CodeBuild ログ本文を API 経由で `.txt` ダウンロードできるようにする変更だが、`main` 更新後に GitHub 上で競合している。

## 目的

PR #201 を最新 `origin/main` に追従させ、競合を解消して merge 可能な状態へ戻す。

## スコープ

- PR #201 branch への `origin/main` merge
- 競合ファイルの解消
- OpenAPI generated docs / Infra snapshot など生成物の同期
- 必要な検証、作業レポート、commit、push、PR コメント

## 作業計画

1. PR branch 専用 worktree で作業する。
2. `origin/main` を merge し、競合箇所を確認する。
3. `main` 側の OpenAPI authorization metadata 化を維持しつつ、PR #201 の `GET /benchmark-runs/{runId}/logs` を残す。
4. generated docs と snapshot を再生成または更新する。
5. API/Web/Infra/docs の対象検証を実行する。
6. 作業レポート、commit、push、PR 受け入れ条件コメント、セルフレビューコメントを完了する。

## ドキュメント保守計画

- PR #201 の API/docs 変更は維持する。
- 競合解消で durable docs の内容変更が追加で必要か確認する。
- OpenAPI generated docs は現在の `main` の生成規則に合わせて更新する。

## 受け入れ条件

- AC-001: PR #201 branch が最新 `origin/main` を取り込み、Git conflict が解消されている。
- AC-002: `GET /benchmark-runs/{runId}/logs` の API route / service / web download / infra IAM / docs が維持されている。
- AC-003: ログ本文 API が `benchmark:download` の認可境界に残り、public route 化していない。
- AC-004: `access-control-policy.test.ts` は `main` 側の OpenAPI metadata 駆動方式を維持している。
- AC-005: generated OpenAPI docs と Infra snapshot が現在の実装と同期している。
- AC-006: 選定した API/Web/Infra/docs 検証が pass し、未実施検証は理由を記録している。
- AC-007: PR #201 に受け入れ条件確認コメントとセルフレビューコメントを日本語で追加している。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `task memorag:cdk:test`
- `task docs:openapi`
- `task docs:openapi:check`
- `git diff --check`

## 検証結果

- `npm ci`: pass。新規 worktree に検証用依存がなかったため実行。
- `task docs:openapi`: 初回は `tsx` 不在で fail。`npm ci` 後に再実行して pass。
- `task docs:openapi:check`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass。
- `task memorag:cdk:test`: pass。
- `git diff --check`: pass。

## 受け入れ条件確認メモ

- AC-001: `origin/main` を merge し、`git diff --name-only --diff-filter=U` で未解決 conflict なし。
- AC-002: `GET /benchmark-runs/{runId}/logs` の route / service / web download / infra IAM / docs を維持。
- AC-003: logs endpoint に `routeAuthorization({ mode: "required", permission: "benchmark:download" })` を追加し、静的 policy test pass。
- AC-004: `access-control-policy.test.ts` は `openApiRoutePolicies()` で OpenAPI metadata を読む `main` 側方式を維持。
- AC-005: `task docs:openapi` と Infra テストで generated OpenAPI docs / snapshot を同期。
- AC-006: 上記検証が pass。実 AWS CodeBuild run は今回も未実施。
- AC-007: PR コメントは push 後に実施予定。

## PR レビュー観点

- `benchmark:download` の認可境界を弱めていないか。
- `main` 側の OpenAPI authorization metadata と PR #201 の新規 endpoint が両立しているか。
- generated docs / snapshot が stale になっていないか。
- 実 AWS CodeBuild run の未実施確認を実施済み扱いしていないか。

## リスク

- `main` 側で OpenAPI generated docs が広範囲に変わっているため、手動解消ではなく再生成で同期する必要がある。
- 実 AWS CodeBuild run は環境依存のため、この競合解消ではローカル単体/契約/IAM/docs 検証が中心になる。

## 状態

doing
