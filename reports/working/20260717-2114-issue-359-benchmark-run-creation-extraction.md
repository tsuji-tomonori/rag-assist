# Issue #359 Phase 4k benchmark run create orchestration 抽出 作業レポート

## 受けた指示

PR #428 final head `b95d8abc` を起点に、Issue #359 の残存 Phase 4 create orchestration を owner 判断なしで安全に分離できる最小 bounded unit として実装・検証し、専用 worktree、task、Draft stacked PR、受け入れ条件／セルフレビュー／CI／Issue 進捗まで完遂する。4 authorization boundaries、fail-closed compensation、tenant boundary、production no-mock を維持し、merge/deploy/release は行わない。

## 要件整理と判断

- 残存責務は suite/input validation、authoritative run construction、queued create、`start` / `protected_read` / `external_side_effect` / `durable_commit`、Step Functions start、execution ARN commit、failure compensation である。
- run factory だけでは side-effect state machine が facade に残るため、`createBenchmarkRun` 全体を1つの rollback unit として `BenchmarkRunCreationService` へ抽出した。
- service は store `create/update`、authoritative tenant/security resolver、suite/server defaults、shared normalizers、boundary authorizer、starter、clock/id の narrow ports だけを受ける。caller supplied tenant/owner/path や production mock fallback は追加しない。
- characterization 中、既存 success update の `return` が await されず、Promise rejection が catch を迂回して queued state を残す局所欠陥を確認した。owner policy 変更ではなく既存 compensation contract の欠落なので、`return await` で catch に接続し regression test を追加した。
- external start 後に Step Functions stop を新設することは新しい外部副作用と運用 ownership 判断を要するため対象外とした。failed durable state と worker current reauthorization は維持するが、actual AWS停止保証は主張しない。

## 実施作業

- `BenchmarkRunCreationService`、input/defaults/ports を追加し、validation-before-side-effect、authoritative tenant partition、queued-first、4-boundary fixed order、permission/non-permission compensation を実装した。
- production-quality unit test 10件で narrow dependency、canonical run、disabled path、search tuning、4境界全 denial、create/start/commit/compensation failure を固定した。
- `MemoRagService.createBenchmarkRun` を delegate に置換し、既存 starter、config defaults、authoritative/security/current-authorization ports を constructor composition した。
- facade contract の direct `benchmarkRunStore` read を3→0へ更新し、starter source guard を新 ownership に同期した。
- `DES_DLD_012.md` に Phase 4k の ports、順序、commit compensation repair、未実施 actual AWS gap、Phase 4 bounded completion を記録した。
- canonical API-code docs 97 API / 582文書を再生成した。facade 行位置と call graph のため generated 配下290ファイルが機械更新された。
- task md に RCA、受け入れ条件、検証計画、残余 risk を記録した。

## 成果物

- `apps/api/src/benchmark/benchmark-run-creation-service.ts`
- `apps/api/src/benchmark/benchmark-run-creation-service.test.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service-contract.test.ts`
- `apps/api/src/benchmark/benchmark-execution-starter.test.ts`
- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`
- `docs/generated/api-code/`
- `tasks/do/20260717-2041-issue-359-benchmark-run-creation-extraction.md`

## 検証結果

- targeted 5 test files: pass（5/5 files）
- targeted ESLint: pass
- API typecheck: pass
- API full test: pass（871/871）
- root `npm run ci`: pass
  - API 871、Web 442、Infra 38、Benchmark 102 tests
  - workspace lint/typecheck/build pass
- `task docs:api-code`: pass（97 APIs / 582 documents）
- `task docs:check`: 初回は task md 内の旧 docs path 文字列を validator が拒否。文言を canonical-safe に修正して再実行し pass
- `npm run rag:release:source-audit`: pass（dataset-specific branch 0、artifact manifest mismatch 0）
- `git diff --check`: pass

- staged `pre-commit run`: pass
- Draft stacked PR #431（base PR #428 branch）、`semver:patch`、日本語 AC/self-review: recorded
- GitHub Actions implementation-head `e55e406b`: pass（9m09s）

task done lifecycle commit を final head として push 後、GitHub Actions を再実行し、結果を PR/Issue comment に記録する。未実施の final-head CI は成功扱いにしていない。

## 指示への fit 評価

- 4境界は `create → start → protected_read → external_side_effect → starter → durable_commit → executionArn update` の順を直接 test し、各 denial 後の後続処理停止を確認した。
- authoritative tenant/user/security refs と tenant-partitioned artifact key を維持し、route/RBAC/non-enumeration/public contract を変更していない。
- permission denial は非開示 failed outcome、non-permission failure は failed 永続化後の original error rethrow、compensation failure は reject として false success を防止した。
- mock値は test fixture に限定し、production fallback を追加していない。
- RAG expected phrase、QA sample固有値、dataset固有分岐は production source に追加していない。
- merge/deploy/release は行っていない。

## 未対応・制約・リスク

- actual Step Functions / IAM / DynamoDB / S3 と manual UI は未実施。local/GitHub CI を actual AWS 成功の代替とは扱わない。
- external start 後の durable denial/error に Step Functions stop は追加していない。追加には owner/運用 policy 判断が必要である。
- stacked baseline には repository-wide docs structure file が存在しないため、既存 canonical DES を更新した。
- `npm ci` は成功したが、既存 audit summary は 8 vulnerabilities（low 2 / moderate 1 / high 5）。本変更による dependency/lockfile 差分はない。
- Vite build は既存の 500 kB chunk warning を出すが成功した。
- GitHub Apps の callable connector が利用できないため repository rule に従い `gh` fallback を使用し、PR本文に制約を明記した。
- Issue #359 全体の巨大 facade debt、他 domain、actual AWS operational evidence は本 Phase 4k 完了の範囲外であり、Issue を close しない。
