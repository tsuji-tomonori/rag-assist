# Issue #359 Phase 4f: BenchmarkRunCancellationService の narrow-port 抽出

- 状態: done
- タスク種別: 修正
- Issue: #359
- 対象 branch: `codex/issue-359-benchmark-run-cancellation-extraction`
- stacked base: `codex/issue-359-benchmark-run-query-extraction`（PR #407 final head `1c59125a`）

## 背景

Issue #359 Phase 4a / PR #390 は `MemoRagService` の 101 public method と 31 dependency key を characterization し、Phase 4b〜4e / PR #393、#397、#403、#407 は favorite、human question、provider catalog、benchmark run query を narrow-port service へ分離した。current stacked baseline では benchmark cancel が facade 内で tenant-scoped run lookup、Step Functions `StopExecution`、cancelled 状態の永続化を直接連結している。

## 着手前 overlap 監査と選定理由

- current stack は #390 → #393 → #397 → #403 → #407。本タスクは #407 final head を base とし、既抽出 domain を変更しない。
- open PR #406/#411 は benchmark metric/evidence と生成 schema、#412 と Issue #358 agent は security resolver、Issue #345 agent は Web E2E を扱い、benchmark cancellation 実装とは重複しない。
- #387 は conversation history/chat/RAG、#339 は usage/cost/admin、#76 は alias を変更するため対象外にする。
- `cancelBenchmarkRun` は 1 public method、tenant resolver、run store `get/update`、Step Functions stop、clock で閉じる。create/reauthorize/artifact/download/execution start を含めず、外部副作用を伴う最小 command unit とする。
- `memorag-service.ts` と source line 由来 generated API docs は stacked PR と機械的競合し得る。semantic overlap と区別し、base 順の canonical 再生成を PR に明記する。

## なぜなぜ分析（軽量 RCA）

### 問題文

current stacked baseline の `MemoRagService` は benchmark run cancellation の tenant lookup、Step Functions stop、副作用後の store update を直接保持し、専用 unit test がない。公開 facade API、tenant non-enumeration、stop/update の順序と failure behavior、route permission、auth/RAG 境界を変えてはならない。

### confirmed

- public method は `cancelBenchmarkRun(actor, runId)` 1 件で、Phase 4a compiler-resolved signature snapshot に固定されている。
- `authoritativeActorTenantId(actor)` を store partition に渡し、missing/cross-tenant run は `undefined` となる。
- `executionArn` がある run は `StopExecutionCommand` を exact ARN と cause `Cancelled from MemoRAG admin benchmark view` で送信した後に store を更新する。
- stop が失敗した場合は store update に進まず、error を caller へ伝播する。
- `executionArn` がない場合は stop を省略し、`status: cancelled` と current ISO time の `completedAt` を更新する。
- terminal status の early return はなく、既存実装は completed/failed/cancelled run も同じ cancelled update を行う。
- route の `benchmark:cancel` permission、tenantRun resource condition、404 non-enumeration は service 外で維持される。

### inferred

- command boundary と外部 side-effect port が明示されず、composition facade が AWS command と persistence ordering を所有したことが構造負債の原因である。
- create/reauthorize/artifact cleanup を同時に移すと current worker authorization、revocation reconciliation、複数 AWS side effect を含み、最小 rollback/review unit を超える。
- cancellation 専用 characterization 不足により、抽出時に stop-before-update、cause、failure propagation、terminal behavior が変わるリスクがある。

### open_question

- stop 成功後に store update が失敗した場合の compensation/reconciliation は現行仕様にない。本タスクでは挙動を変えず、後続の reliability unit として残す。
- benchmark create/reauthorize/artifact cleanup/download をどの command/security service に分けるかは後続 unit で決定する。

### root cause と対策対応

- 根本原因: benchmark cancellation の command policy と Step Functions adapter capability が narrow service/port として表現されず、facade が lookup・external side effect・durable update を直接連結している。
- 対策: `BenchmarkRunCancellationService` に store `get/update`、authoritative tenant resolver、execution stopper、clock だけを注入し、AWS command mapping は独立 adapter に置く。facade public method は同一 signature で委譲する。
- 効果指標: 101 public method/signature snapshot 不変、facade `benchmarkRunStore` direct read 9→7、direct dependency key は24を維持、`memorag-service.ts` は6,251行未満、facade の `StopExecutionCommand` import/readは0にする。

## Scope

### In scope

- `BenchmarkRunCancellationService` と narrow command port の追加
- Step Functions stop adapter と exact command mapping の分離
- benchmark cancel public method の委譲
- tenant lookup、missing/non-enumeration、stop-before-update、exact cause、stop/no-ARN/error/terminal/clock behavior の characterization test
- Phase 4a dependency guard と `DES_DLD_012.md` の同期
- canonical source-backed API docs の同期

### Out of scope

- benchmark create/reauthorize/artifact download/cleanup/execution start/query/log
- cancellation compensation/reconciliation、retry、idempotency contract の新設
- route、HTTP schema/status、permission、auth policy、RAG/chat/history/usage/admin/favorite/question/provider catalog
- real Step Functions/AWS、実 benchmark、manual UI、merge / deploy / release

## 実施計画

1. cancellation ordering/failure contract を domain/adapter test に固定する。
2. store/tenant/stopper/clock の narrow-port service と AWS adapter を追加する。
3. facade public signature を変えず service へ委譲する。
4. Phase 4a contract、targeted/full API、docs freshness、source audit、root CI で回帰を検証する。
5. report、commit、draft stacked PR、semver、AC/self-review、task done、final-head CI、Issue コメントまで完遂する。

## ドキュメント保守計画

- `DES_DLD_012.md` に Phase 4f cancellation command boundary、保持 contract、残余 compensation/mutation debt を追記する。
- HTTP/UI/運用/config は不変のため README、OpenAPI 本文、API example の手動更新は不要とし、freshness/docs check で確認する。
- source-backed API docs は canonical generator の正規差分だけを同一 PR で同期する。

## 受け入れ条件

- [x] AC1: `BenchmarkRunCancellationService` が whole `Dependencies` / AWS SDK / global config / authorization service ではなく、`BenchmarkRunStore.get/update`、authoritative tenant resolver、execution stopper、clock だけを受ける。
- [x] AC2: AWS adapter が execution ARN と exact cause を `StopExecutionCommand` に写し、service source は AWS/config を import しない。
- [x] AC3: `MemoRagService.cancelBenchmarkRun` の name/signature、route/consumer compile contract、PR #390 の101 public method snapshotが不変である。
- [x] AC4: authoritative tenant lookup、missing/cross-tenant non-enumeration、ARN有無、stop-before-update、stop失敗時未更新、terminal run、clock/update input を domain/adapter/既存 route test で維持する。
- [x] AC5: benchmark create/reauthorize/query/download/artifact cleanup/execution start、route permission/status、auth/RBAC、RAG/chat/history/usage/admin、既抽出 service に挙動変更がない。
- [x] AC6: facade `benchmarkRunStore` direct read が9→7、direct dependency keyは24、`memorag-service.ts`が6,251行未満、facade `StopExecutionCommand` importが0になり、contract guardが同期する。
- [x] AC7: targeted/full API、API typecheck/build、root `npm run ci`、OpenAPI/API-code docs freshness、source audit、`task docs:check`、`git diff --check`、pre-commit が成功する。
- [x] AC8: `DES_DLD_012.md`、task、作業レポートが実装・検証・generated docs競合・real AWS/benchmark/manual未実施・stop後update失敗の残余リスクと同期する。
- [x] AC9: 日本語 draft stacked PR、`semver:patch`、AC/self-review、task done lifecycle を完了する。final-head CI/Issue progress/clean upstream は task completion commit 後の post-completion check として確認する。

## 実施結果

- `BenchmarkRunCancellationService` に store `get/update`、authoritative tenant resolver、execution stopper、clock だけを注入し、`cancelBenchmarkRun` を委譲した。AWS `StopExecutionCommand` mapping は独立 adapter へ移した。
- public 101 method/signature snapshot は不変。tenant non-enumeration、exact ARN/cause、stop-before-update、ARNなし、stop failure、terminal status、clock/update input を新規7 tests と既存 tenant boundary test で維持した。
- facade `benchmarkRunStore` occurrence は9から7、direct dependency keyは24、`memorag-service.ts`は6,251行から6,247行、facade `StopExecutionCommand`は0になった。
- API full 833 tests、API typecheck/build、root CI、97 API / 582 docs freshness、`task docs:check`、source audit、pre-commitが成功した。
- canonical API-code 298 files は source location/call graph の機械更新。OpenAPI契約の手動変更はない。
- real Step Functions/AWS、実benchmark、manual UIは未実施。外部状態・credential・費用を伴うか本 command seam に非該当である。
- Draft stacked PR #414 を作成し、`semver:patch`、日本語AC、セルフレビューを記録した。実装 head `2a44c580` の GitHub Actions run #29560365472 は8分54秒で成功し、promotion gateはskipだった。

## 検証計画

- `node --import tsx apps/api/src/benchmark/benchmark-run-cancellation-service.test.ts`
- `node --import tsx apps/api/src/benchmark/benchmark-execution-stopper.test.ts`
- `node --import tsx apps/api/src/rag/memorag-service-contract.test.ts`
- `node --import tsx apps/api/src/routes/benchmark-tenant-boundary.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`
- `npm run build -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `npm run docs:api-code:check`
- `task docs:check`
- `npm run rag:release:source-audit`
- `npm run ci`
- `git diff --check`
- `pre-commit run`

## PR セルフレビュー観点

- public signature、tenant partition/non-enumeration、stop/update ordering、exact cause、error propagation、clock が不変か。
- subservice に whole `Dependencies`、AWS/config、authorization、unrelated mutation capability を渡していないか。
- terminal behaviorやmissing runを新しい成功/エラーへ変換していないか。
- open Draft/他 agent scope と semantic codeを重複させていないか。
- docsと実装、変更範囲に見合うtestが同期しているか。
- RAG根拠性・認可境界を弱めず、benchmark期待語句、QA sample固有値、dataset固有分岐を実装へ混入していないか。

## リスク

- source line/call graph変更で `docs/generated/api-code/` が広範に機械更新され、stacked PR と path conflict が発生し得る。semantic overlapと区別し、base順にgeneratorを再実行する。
- `benchmarkRunStore` はcreate/reauthorize/cleanupに残るため direct dependency key自体は減らない。本unitはdirect occurrence 2件とfacade行数、AWS Stop command ownershipの削減を完了指標にする。
- stop成功後のstore update失敗は既存同様にcompensationがない。本タスクで隠さず、後続 reliability debtとして記録する。
- real Step Functions/AWS、実benchmark、manual UIは外部状態・credential・費用を伴うか本変更に非該当のため未実施とし、fake ports、adapter command test、full CI、GitHub Actionsで回帰を検証する。
