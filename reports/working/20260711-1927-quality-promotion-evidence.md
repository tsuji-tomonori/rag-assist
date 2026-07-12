# 作業完了レポート

保存先: `reports/working/20260711-1927-quality-promotion-evidence.md`

## 1. 受けた指示

- FR-075 と SQ-007〜SQ-015 の release-quality evidence / gate の未実装を閉じる。
- optional aggregate 値をコピーするだけでなく、versioned case artifact と workload / price evidence から実測値を導出する。
- `rag:promotion:check` を CI と deploy に接続し、公開・deploy を承認済み policy / observations 無しで通さない。
- dataset 固有分岐と artifact manifest 不整合の release audit を deterministic な production artifact にする。
- stakeholder 未承認 threshold を作らない。

## 2. 要件整理と対応

| 要件 | 対応 |
| --- | --- |
| case-level 品質導出 | false-denial、faithfulness / unsupported claim、citation precision / completeness、false answer / refusal、task completion / outcome、no-access、p50/p95/p99 を canonical case artifact から再計算 |
| workload / reliability | 承認・version 付き workload evidence の timestamp から eligibility p50/p95/p99/max、MTTR、recovery p95 / loss-free rate、backlog p99 を計算 |
| unit cost | approved price catalog と `usageComplete=true` の model / embedding / storage / worker / egress usage から component / total の chat/search/ingest 単位費用を計算 |
| missing evidence | unversioned summary、unapproved/mismatched workload/price、incomplete usage、欠落 rate は値を生成せず production observation を unavailable にする |
| release audit | `rag-release-audit-v1` CLI で product runtime の dataset expected-field / identity branch と summary / prepare / seed / case manifest を検査し、digest と finding を保存 |
| production 接続 | CodeBuild post-build → `release-audit.json` S3 upload → DynamoDB run metrics → scheduled production observation producer へ接続 |
| promotion / deploy | CI は明示 dispatch の candidate だけ gate を実行し、deploy は build / synth / deploy 前に S3 policy / observations と gate pass を必須化 |
| provenance | source version dimension 欠損、release-audit provenance 不在を `signal_unavailable` として fail closed |

## 3. 主な成果物

- `benchmark/release-audit.ts` / `benchmark/release-audit.test.ts`
- `benchmark/promotion-gate.ts` / `benchmark/promotion-gate.test.ts`
- `benchmark/promotion-workflow.test.ts`
- `infra/scripts/update-benchmark-run-metrics.mjs`
- `packages/contract/src/schemas/benchmark.ts`
- `packages/contract/src/rag-quality-control.ts`
- `apps/api/src/rag/quality-control/production-rag-observation-producer.ts`
- `.github/workflows/memorag-ci.yml`
- `.github/workflows/memorag-deploy.yml`
- `docs/spec/benchmark-artifact-contract.md`
- `docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md`

## 4. 実行した検証

- `npm run typecheck -w @memorag-mvp/contract`: pass
- `npm run typecheck -w @memorag-mvp/benchmark`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/infra`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `node --import tsx --test src/*.test.ts`（contract）: pass、3 files
- `node --import tsx --test artifact-contract.test.ts promotion-gate.test.ts promotion-workflow.test.ts release-audit.test.ts`: pass、4 files
- `node --import tsx --test src/rag/production-rag-monitor.test.ts src/rag/production-rag-observation-producer.test.ts`: pass、2 files
- `node --import tsx --test test/memorag-mvp-stack.test.ts test/update-benchmark-run-metrics.test.ts`: pass、2 files。stack 内 15 tests、metrics 内 10 tests を確認
- 対象 TypeScript / JavaScript の `eslint --max-warnings=0`: pass
- GitHub Actions 2 files の YAML parse: pass
- 実 repository source に対する release taint scan: `datasetSpecificBranchCount=0`
- `git diff --check`: pass

## 5. 未実施・制約・リスク

- `npm test -w @memorag-mvp/benchmark` は sandbox が `tsx` IPC socket の `listen` を `EPERM` で拒否した。代替の `node --import tsx --test` では 21 files 中 18 files が pass し、残る `jp-public-pdf-qa.test.ts`、`run.test.ts`、`search-run.test.ts` は全失敗が `127.0.0.1` listener の `EPERM` だった。権限委譲による再実行はユーザー確認が必要なため、この subtask では行っていない。
- stakeholder threshold、workload observation、price rate は作成していない。deploy は GitHub Environment の `RAG_QUALITY_POLICY_S3_URI` と `RAG_QUALITY_OBSERVATIONS_S3_URI` が設定され、artifact 自体が承認・完全であるまで意図的に fail closed になる。
- 現行 chat/search runner は token/storage/worker/egress usage を常に出すわけではない。case artifact に `usageComplete=true` の実測 usage が無い単位費用は unavailable のままになる。
- eligibility / MTTR / backlog は versioned workload evidence が投入された場合だけ測定される。未投入 run を SLO 合格として扱わない。

## 6. 指示への fit 評価

**総合fit: 4.8 / 5.0（約96%）**

要求された deterministic evidence、production 接続、CI/deploy fail-closed gate、未承認値を補わない方針は実装・直接試験した。満点でない理由は、listener を使う benchmark 全体試験が sandbox 制約で未完了であり、実運用の workload / price artifact と stakeholder threshold は本タスクで作成できないためである。
