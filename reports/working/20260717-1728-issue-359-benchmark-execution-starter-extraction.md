# Issue #359 Phase 4h 作業完了レポート

保存先: `reports/working/20260717-1728-issue-359-benchmark-execution-starter-extraction.md`

## 1. 受けた指示

- Issue #359 の PR #414 / #418 と重複しない次の最小 bounded extraction unit を選定し、実装・検証する。
- 専用 worktree、task/RCA、commit、Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue 進捗、clean/upstream まで完遂する。
- tenant/non-enumeration と実 AWS 未検証の正直さを維持する。
- GitHub Apps を優先し、利用不可なら規則どおり `gh` fallback を使う。
- merge / deploy / release は行わない。

## 2. 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | #414 cancellation / #418 artifact と非重複の最小 unit | benchmark execution start mapping に限定 |
| R2 | narrow port / AWS adapter 抽出 | 対応 |
| R3 | execution payload / tenant / error semantics 不変 | exact characterization と full CI で対応 |
| R4 | create/auth/cleanup、route/RBAC、RAG trust 非変更 | 対応 |
| R5 | docs / generated source evidence 同期 | 対応 |
| R6 | PR lifecycle / final-head CI / Issue 進捗 | PR / semver / initial comments / implementation-head CI は完了。final-head CI / Issue comment は lifecycle commit 後に外部証跡で確認 |
| R7 | merge / deploy / release 禁止 | 遵守 |

## 3. 検討・判断

- 残る create / reauthorize / revocation cleanup / execution start のうち、private `startBenchmarkExecution` は concrete Step Functions mapping だけを所有する1 method で、最小の rollback/review 単位と判断した。
- create orchestration や security compensation を同じ PR へ含めず、adapter port を `start(run, outputPrefix) -> executionArn` のみにした。
- adapter constructor は region、state machine ARN、bucket、target API URL、send client の個別値だけを受け、`Dependencies`、run store、actor/permission resolver、global config object を渡さない。
- tenant は actor-facing lookup を新設せず、authoritative actor から既に構築済みの `BenchmarkRun.tenantId` を execution name、storage key、payload に一貫して使う。
- README、API examples、OpenAPI、Web UI、運用設定は public HTTP / environment behavior 不変のため内容更新不要と判断し、freshness check で確認した。

## 4. 実施作業

- `BenchmarkExecutionStarter` port と `AwsBenchmarkExecutionStarter` を追加した。
- Step Functions execution name、tenant storage key、dataset/output S3 URI、worker input 全項目、response ARN validation を adapter へ移した。
- `MemoRagService` constructor で個別 config value を解決し、create path の同じ authorization boundary 間で starter を呼ぶようにした。
- exact command、missing ARN、client failure、unsafe/long run ID の name-only sanitize / 80文字上限を test へ追加した。
- facade source guard と Phase 4a direct dependency evidence の Phase 4h naming を同期した。
- `DES_DLD_012.md` に Phase 4h の port、保持 contract、残存 create/auth/cleanup、実 AWS gap を追記した。
- canonical generator で 97 API / 582 documents を同期した。

## 5. 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/benchmark/benchmark-execution-starter.ts` | narrow Step Functions start port / AWS adapter |
| `apps/api/src/benchmark/benchmark-execution-starter.test.ts` | exact command / tenant / error / sanitizer characterization |
| `apps/api/src/rag/memorag-service.ts` | benchmark start の facade composition / adapter 委譲 |
| `apps/api/src/rag/memorag-service-contract.test.ts` | Phase 4h source-backed boundary evidence |
| `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md` | Phase 4h 詳細設計 |
| `docs/generated/api-code/` | canonical source-backed API documents |
| task / 本レポート | RCA、受け入れ条件、検証、lifecycle 証跡 |

## 6. 検証結果

成功:

- targeted starter adapter / facade contract tests: pass
- targeted ESLint: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/api`: pass（権限委譲再実行、845 assertions）
- `npm run ci`: pass（contract 1、API 845、Web 442、Infra 38、Benchmark 102、全 lint/typecheck/build）
- `task docs:api-code`: 97 API / 582 documents 生成
- `task docs:check`: pass（97 API / 582 documents freshness を含む）
- `npm run rag:release:source-audit`: pass、audit `sha256:7d48321841bf35ee12ea18d86b799c6ebe4eb65525382a845df26498454535f5`、dataset 固有分岐 0、artifact mismatch 0
- `git diff --check`: pass

修正・再実行:

- 新 worktree の初回 typecheck / contract test は dependency 未導入で workspace contract を解決できず失敗した。通常 sandbox の `npm ci` で504 packages を導入し、同じ検証が成功した。既存 vulnerability 8件（low 2 / moderate 1 / high 5）は lockfile 非変更で本 unit の対象外。
- 通常 sandbox の API full suite は112 test filesが成功し、HTTP route系5 filesだけ `tsx` IPC socket の `listen EPERM` で失敗した。単独再現で同じ sandbox error を確認後、resolved command を権限委譲した `npm run test -w @memorag-mvp/api` で845/845 success を確認した。
- 初回 root CI は adapter 移管後の facade に残った unused `tenantStorageKey` import を検出した。import を削除し、targeted lint と root CI を再実行して全成功した。
- execution name sanitizer / 80文字境界の追加 test 後、targeted test、canonical generation、root CI、docs/source audit を再実行した。

## 7. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.9/5 | 実装・local validation・PR 初期 lifecycle 完了。final-head CI / Issue comment は lifecycle commit 後に確認 |
| 制約遵守 | 5/5 | non-overlap、専用 worktree、tenant維持、no merge/deploy/release |
| 成果物品質 | 4.8/5 | narrow adapter、exact mapping/error/boundary test、docs 同期 |
| 説明責任 | 5/5 | sandbox failure、AWS gap、generated churn、audit finding を明記 |
| 検収容易性 | 4.8/5 | task/設計/test/report と検証結果を対応付けた |

**総合fit: 4.9 / 5.0（約98%）**

final-head CI と Issue progress の外部証跡を確認した後に最終完了判定する。

## 8. 未対応・制約・リスク

- 実 AWS Step Functions start、実 benchmark、manual UI は credential・state machine・課金・外部状態を伴うか Web 非変更のため未実施。fake client の exact command mapping と local/GitHub CI を検証根拠とする。
- generated API docs は source line/call graph により290 filesが機械更新され、stacked base 順の merge/rebase 後に再生成が必要になり得る。
- benchmark create orchestration / reauthorize / revocation cleanup は意図的に facade に残し、次の独立 unit とする。
- facade の `@aws-sdk/client-sfn` import は chat / ingest execution start のため残る。benchmark-specific `StartExecutionCommand` mapping の分離は adapter source guard で検証する。
- final-head CI、Issue comment、clean/upstream は lifecycle commit 後に外部証跡へ記録する。

## 9. PR lifecycle 記録

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/421
- stacked base: PR #418 / `codex/issue-359-benchmark-artifact-download-extraction`
- head branch: `codex/issue-359-benchmark-execution-starter-extraction`
- implementation head: `904a4deb0fbc0f58c2e177a08606f675425d70d6`
- semver: `semver:patch`
- AC comment: https://github.com/tsuji-tomonori/rag-assist/pull/421#issuecomment-5000780424
- self-review comment: https://github.com/tsuji-tomonori/rag-assist/pull/421#issuecomment-5000781652
- implementation-head CI: SUCCESS（MemoRAG CI run `29566846901`、2026-07-17 17:42 JST 完了）
- final-head CI / Issue #359 progress: lifecycle commit push 後に外部証跡として確認・投稿する。先取りして成功とは記録しない。
- GitHub Apps: callable capability 未提供のため `gh` fallback を使用した。PR 本文にも制約を明記した。
- merge / deploy / release: 未実施
