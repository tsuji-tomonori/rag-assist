# Issue #359 Phase 4g: benchmark artifact download 抽出

- 状態: done
- タスク種別: 修正
- Issue: #359
- stacked base: PR #414 / `codex/issue-359-benchmark-run-cancellation-extraction`

## 背景

Phase 4a の characterization 後、benchmark query は PR #407、cancellation は PR #414 で narrow-port service へ抽出された。一方、`MemoRagService.createBenchmarkArtifactDownloadUrl` は tenant lookup、artifact selection、download metadata、AWS S3 presign を facade 内で直接所有している。

## 目的

公開 method signature、tenant/RBAC、download URL semantics を変えずに、benchmark artifact download を narrow dependency の service と AWS adapter へ分離する。

## スコープ

- `BenchmarkArtifactDownloadService` の追加
- S3 presign command mapping の adapter 分離
- `MemoRagService.createBenchmarkArtifactDownloadUrl` の委譲
- source-backed contract guard と characterization test
- Phase 4 詳細設計と canonical generated API-code docs の同期

対象外:

- benchmark run create / reauthorize / revocation cleanup / execution start
- API route、認可 permission、永続化形式、Web UI の変更
- merge / deploy / release

## なぜなぜ分析

### 問題文

`MemoRagService.createBenchmarkArtifactDownloadUrl` が、facade の公開委譲責務を越えて `benchmarkRunStore`、configuration、AWS `S3Client` / `GetObjectCommand` / `getSignedUrl`、content-disposition の構築を直接所有している。Phase 4a の「同名 facade を維持し、domain service へ narrow port で段階分割する」期待から外れている。

### confirmed

- PR #407 は list/get/log text の read query のみを抽出した。
- PR #414 は cancellation の get/stop/update のみを抽出した。
- artifact download は facade 内で authoritative actor tenant を使って run を取得する。
- `logs` は既存 CodeBuild log URL を返し、S3 artifact は summary/results/report key を選択して presign する。
- S3 artifact では bucket 未設定を error とし、object key 不在を `undefined` とし、TTL を最低60秒へ正規化する。
- `createBenchmarkArtifactDownloadMetadata` は既存 test から top-level export として参照されている。

### inferred

- artifact download が benchmark lifecycle 実装と同じ facade に追加され続けた結果、AWS command mapping と domain decision の境界が形成されなかった。
- query/cancellation と同じ段階抽出を適用すれば、既存 contract を変えずに責務を閉じられる。

### conflict / open_question

- 実 AWS S3 に対する presigned URL の有効性は local unit test だけでは確認できない。AWS SDK command input と signer port の invocation を characterization し、real AWS は未実施として明記する。

### 根本原因

artifact download の orchestration と AWS SDK mapping を分離する明示的な service/adapter 境界がなく、facade が broad `Dependencies` と concrete AWS client を直接利用できる構造だった。

### 是正方針

- service は run `get`、tenant resolver、artifact signer、bucket/TTL の値だけを受け取る。
- AWS adapter は bucket/key/content-disposition/TTL を concrete SDK command へ変換する。
- facade は同一 signature で service へ委譲する。
- source guard と normal/missing/cross-tenant/logs/config/key/TTL/signer failure test で再発を検知する。

## 実施計画

1. 現行 download behavior と source dependency を characterization test で固定する。
2. narrow-port service と AWS signer adapter を追加する。
3. facade 委譲、既存 export、contract guard を同期する。
4. 詳細設計と canonical generated docs を更新する。
5. targeted/full validation、source audit、pre-commit を実行する。
6. commit/push、Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue 進捗を完遂する。

## ドキュメント保守計画

- `DES_DLD_012.md` に Phase 4g の責務、ports、非変更契約、残存境界を追記する。
- API source line/call graph が変わるため canonical API-code generator を実行する。
- public HTTP schema、README、OpenAPI は変更しないため、freshness check で非影響を確認する。

## 受け入れ条件

- [x] authoritative tenant lookup を使い、missing / cross-tenant run を列挙しない。
- [x] logs URL、summary/results/report S3 artifact、object key 不在、bucket 未設定、TTL 下限、signer failure の既存 behavior を維持する。
- [x] service source が narrow ports のみに依存し、AWS SDK command mapping が adapter に分離される。
- [x] `MemoRagService.createBenchmarkArtifactDownloadUrl` の method 名・引数・返却型と `createBenchmarkArtifactDownloadMetadata` export を維持する。
- [x] create / reauthorize / cleanup / execution start、route/RBAC、RAG trust、Web UI を変更しない。
- [x] targeted API test、API full test、`npm run ci`、docs freshness、source audit、`git diff --check`、pre-commit が成功する。
- [x] Draft stacked PR に `semver:patch` を設定し、日本語 AC / self-review、report/task done、final-head CI、Issue #359 進捗まで記録する。

## 完了結果

- 実装 commit: `41d2ebc153ca8e4325ce604630210bc5e8ba30f8`
- Draft stacked PR: #418（base: `codex/issue-359-benchmark-run-cancellation-extraction`）
- 受け入れ条件コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/418#issuecomment-5000112471`
- セルフレビューコメント: `https://github.com/tsuji-tomonori/rag-assist/pull/418#issuecomment-5000113698`
- implementation-head CI: run `29562856229` success
- lifecycle commit 後の final-head CI と Issue #359 進捗は、head を変えない外部コメントへ記録する。

## 検証計画

- targeted service / adapter / facade contract tests
- `npm run test -w @memorag-mvp/api`
- `npm run ci`
- `task docs:generate`、`task docs:check`
- release source audit
- `git diff --check`
- `pre-commit run --all-files`
- GitHub Actions final-head MemoRAG CI / semver check

## PR レビュー観点

- public API と optional behavior の後方互換性
- tenant non-enumeration と authoritative tenant resolver
- AWS SDK command input、content-disposition、TTL の一致
- docs/source guard/test の同期
- benchmark 固有期待語句や dataset 固有分岐がないこと

## リスク

- canonical API-code generation は source line/call graph 由来で多数ファイルを機械更新する。
- real AWS presign は credential/外部状態を伴うため local では未検証となる。
- stacked PR のため #407 → #414 → Phase 4g の順序が必要である。
