# Issue #359 Phase 4g 作業完了レポート

保存先: `reports/working/20260717-1617-issue-359-benchmark-artifact-download-extraction.md`

## 1. 受けた指示

- Issue #359 の PR #407 / #414 と重複しない次の bounded unit を選定し、実装・検証する。
- 専用 worktree、task、RCA、commit、Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue 進捗、clean/upstream まで完遂する。
- GitHub Apps を優先し、利用不可なら規則どおり `gh` fallback を使う。
- merge / deploy / release は行わない。

## 2. 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | #407 query / #414 cancellation と非重複の unit | artifact download に限定して対応 |
| R2 | narrow-port service / AWS adapter 抽出 | 対応 |
| R3 | public signature / export / tenant / download semantics 不変 | characterization と full CI で対応 |
| R4 | docs / generated source evidence 同期 | 対応 |
| R5 | PR lifecycle / final-head CI / Issue 進捗 | 実装 commit 前時点では継続中。後続更新で記録 |
| R6 | merge / deploy / release 禁止 | 遵守 |

## 3. 検討・判断

- query と cancellation は既に別 service に抽出済みのため、残る1 public method の artifact download を次の rollback/review 単位に選んだ。
- `logs` は保存済み CodeBuild URL を返す projection、summary/results/report は S3 presign という異なる経路だが、同一 public method の既存 artifact selection contract として1 service に閉じた。
- domain service へ `config` や AWS SDK client を渡さず、composition root で解決した bucket/TTL value と signer function だけを注入した。
- `createBenchmarkArtifactDownloadMetadata` は既存 top-level export 利用を壊さないよう facade module から re-export した。
- README、API example、OpenAPI、Web UI は public HTTP behavior 不変のため内容変更不要と判断し、freshness check で確認した。

## 4. 実施作業

- `BenchmarkArtifactDownloadService` を追加し、`BenchmarkRunStore.get`、authoritative tenant resolver、signer、bucket/TTL value の narrow ports に限定した。
- `benchmark-artifact-signer.ts` を追加し、S3 `GetObjectCommand` と presigner TTL mapping を concrete adapter へ分離した。
- `MemoRagService.createBenchmarkArtifactDownloadUrl` を同一 signature の委譲へ変更した。
- missing/cross-tenant、logs URL、summary/results/report、missing key/bucket、TTL floor、signer failure、AWS command input、metadata export の test を追加した。
- Phase 4a source contract の `benchmarkRunStore` direct occurrence を 7→6 に更新し、`DES_DLD_012.md` に Phase 4g 境界を追記した。
- canonical generator で 97 API / 582 API documents を同期した。

## 5. 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/benchmark/benchmark-artifact-download-service.ts` | narrow-port artifact download orchestration |
| `apps/api/src/benchmark/benchmark-artifact-signer.ts` | S3 command / presigner adapter |
| 対応する2 test | domain behavior と AWS mapping characterization |
| `apps/api/src/rag/memorag-service.ts` | 公開 signature 不変の facade 委譲 |
| `apps/api/src/rag/memorag-service-contract.test.ts` | direct dependency source guard |
| `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md` | Phase 4g 詳細設計 |
| `docs/generated/api-code/` | canonical source-backed API documents |
| task / 本レポート | lifecycle と検証証跡 |

## 6. 検証結果

成功:

- targeted service / adapter / public contract tests: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/api`: pass
- `npm run ci`: pass（権限委譲再実行。contract 1、API 841 assertions、Web 442、Infra 38、Benchmark 102、全 lint/typecheck/build）
- `task docs:api-code`: 97 API / 582 documents 生成
- `task docs:check`: pass（97 API / 582 documents freshness を含む）
- `npm run rag:release:source-audit`: pass、audit `sha256:1eddb65e81292a27213b6e1e6e1fcfde20298a8f6fce4a6ba8204743d0799fb0`、dataset 固有分岐 0、artifact mismatch 0
- `git diff --check`: pass

修正・再実行:

- 初回 `npm ci` は sandbox が `esbuild` binary 起動を `EPERM` で拒否した。resolved command を確認し、権限委譲した同じ `npm ci` で成功した。既存 vulnerability 8件（low 2 / moderate 1 / high 5）は lockfile 変更を伴わず、本 unit では変更していない。
- 初回 root CI は source test の unused import / regex lint 2件を検出したため修正した。
- 修正後の通常 sandbox root CI は `tsx` IPC / route listen が `EPERM` となった。権限委譲した同じ `npm run ci` で全 workspace success を確認した。
- `pre-commit run --all-files` は対象外の既存履歴レポート1件の末尾空白を修正して停止した。hook 変更を base へ戻し、今回の staged files に限定して再検証する。

## 7. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.5/5 | 実装・local validation 完了、GitHub lifecycle は後続更新中 |
| 制約遵守 | 5/5 | non-overlap、専用 worktree、no merge/deploy/release を維持 |
| 成果物品質 | 4.8/5 | narrow ports、behavior test、source guard、docs を同期 |
| 説明責任 | 5/5 | sandbox failure、未検証 AWS、generated churn を明記 |
| 検収容易性 | 4.8/5 | task/設計/test/report と検証コマンドを対応付けた |

**総合fit: 4.8 / 5.0（約96%）**

PR lifecycle と final-head CI を完了した後に最終 fit を確定する。

## 8. 未対応・制約・リスク

- real AWS S3 presigned URL、実 benchmark、manual UI は credential・費用・外部状態を伴うか Web 非変更のため未実施。AWS command/presigner port と local/GitHub CI を検証根拠とする。
- generated API docs は source line/call graph により多数ファイルが機械更新され、stacked base 順の merge/rebase 後に再生成が必要になり得る。
- benchmark create / reauthorize / revocation cleanup / execution start は意図的に facade に残し、次の独立 unit とする。
- PR URL、semver、comments、final-head CI、Issue comment、clean/upstream は lifecycle 完了後に本レポートへ追記する。

## 9. PR lifecycle 記録

- Draft PR: 作成前
- stacked base: PR #414 / `codex/issue-359-benchmark-run-cancellation-extraction`
- GitHub Apps: callable capability 未確認。利用不可なら `gh` fallback 理由を記録する。
- merge / deploy / release: 未実施
