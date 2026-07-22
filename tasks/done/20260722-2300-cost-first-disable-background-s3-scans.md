# コスト優先で定期 S3 全走査を停止する

- 状態: done
- タスク種別: 修正
- 着手: 2026-07-22 23:00 JST
- 完了: 2026-07-22 23:38 JST
- PR: #446
- リリース種別: `semver:major`

## 背景

AWS Cost Explorer で `ListBucket` が継続課金され、repository調査から次のscheduled workerがS3 `ListObjectsV2`を高頻度で実行することを確認した。

- `RagQualityMonitorFunction`: 5分ごとにsource sample / observation prefixを全列挙
- `RevocationCleanupFunction`: 1分ごとにcleanup tenant / repair / manifestを列挙
- `SecurityAuditReconciliationFunction`: 1分ごとにaudit intent / source-governance stateを列挙

`FR-066`、`FR-086`、`FR-093`はRAG guide等から2026-07-11に作成されたDraft/inferred requirementである。2026-07-22のowner判断により、現行MVPではこれらの常時controlより`SQ-015`のidle recurring cost最小化を優先した。

## なぜなぜ分析

### 問題

利用者操作がなくてもS3 LIST系コストが継続・増加した。

### 直接原因

- `S3ObjectStore.listKeys()`がpagination付き`ListObjectsV2`を実行する。
- 3 workerはpending件数や時間windowを判定する前にprefixを列挙する。
- pollingは空キューでも1分/5分間隔で起動する。

### 根本原因

continuous safety/quality/reconciliationをopt-inにせず、空キュー時にも有料prefix scanを行うarchitectureとしてMVP stackへ組み込み、cost ceilingをarchitecture/release gateの先行条件にしていなかった。

### 対策

- scheduled entrypointからS3 prefix listingを除去した。
- synchronous authoritative deny、durable audit intent、domain primitiveは維持した。
- `SQ-015`を最優先owner decisionへ更新し、idle application-originated S3 LIST 0件/日をtargetにした。
- EventBridge/Lambda/Alarm/SNS等の物理削除は `tasks/todo/20260722-physical-remove-unused-background-control-infra.md` へ分離した。

## 実施内容

### RAG quality monitor

- source sample / observation listing、benchmark list、aggregation、evaluation、alert、safe actionをscheduled handlerから除去。
- active policy direct GET 1件とnormal safety-state direct PUT 1件だけのcompatibility heartbeatへ縮退。
- handler factoryのstore interfaceを`getText` / `putText`だけに限定し、`listKeys`を受け取れない構造にした。
- 既存missing-data alarmを不必要に発火させないため、zero-failure heartbeat metricsは維持した。

### Revocation cleanup

- production scheduled handlerからdependency生成、tenant registry discovery、`reconcilePending()`を除去。
- scheduled invocationはzero resultを返す。
- explicit handlerとdeny-first cleanup domain primitiveは保持した。

### Security audit reconciliation

- production scheduled handlerからS3 outbox / authoritative resolver構築を除去。
- tenant / limit検証後にzero resultを返すcost-priority consumerを追加。
- synchronous mutation pathのdurable audit intentは保持した。

### Requirements / operations

- `FR-066`: deny-firstを維持し、physical cleanupを明示実行または将来の低コスト方式に限定。
- `FR-086`: durable intentを維持し、background finalizationを明示repairへ変更。
- `FR-093`: full production monitoring control loopをDeferredへ変更。
- `SQ-015`: priority S、idle recurring cost最優先、S3 LIST 0件/日を規定。
- `OPS_MONITORING_001`: current cost-first behavior、残余risk、再有効化gate、deploy後検証を更新。

## 受け入れ条件結果

- [x] scheduled RAG monitorは`listKeys()`、benchmark list、observation aggregationを呼ばず、direct GET/PUT heartbeatだけを実行する。
- [x] scheduled revocation cleanupはtenant discovery / `reconcilePending()`を呼ばずzero resultを返す。
- [x] scheduled security audit reconciliationはproduction outbox / resolverを構築せずzero resultを返す。
- [x] explicit domain handler / coordinatorは維持した。
- [x] `FR-066` / `FR-086` / `FR-093` / `SQ-015` / runbookへowner decisionと未充足保証を反映した。
- [x] main向けDraft PR #446を作成し、`semver:major`を設定した。
- [x] 日本語の受け入れ条件コメントとセルフレビューコメントを投稿した。
- [x] GitHub Actions final implementation headで全required checkが成功した。

## 検証結果

- MemoRAG CI run `29928662172`: success
  - web/api/infra lint: pass
  - infra/API/Web/benchmark typecheck: pass
  - OpenAPI/API code/docs structure/Web/infra inventory checks: pass
  - product runtime release audit: pass
  - infra/benchmark/API/Web tests: pass
  - API coverage: C0 90.65%、C1 80.47%（既存改善taskで追跡）
  - Web coverage: C0 90.87%、C1 85.77%
  - all builds、CDK synth、DynamoDB GSI guard: pass
- Validate Semver Label run `29928659998`: success
- 受け入れ条件コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/446#issuecomment-5047538277`
- セルフレビューコメント: `https://github.com/tsuji-tomonori/rag-assist/pull/446#issuecomment-5047543694`

## 未実施・残余リスク

- live AWS deploy、CloudFormation update、deploy後24時間のCost Explorer/CUR/S3 data event確認は未実施。
- revocation派生artifactは自動物理削除されない。
- audit finalization failureは自動収束しない。
- production RAG drift/quality/security alertとsafe actionは実行されない。
- EventBridge/Lambda/Logs/Alarm/SNSの小額costは残る。
- compatibility heartbeatは5分ごとにS3 GET 1件、PUT 1件とzero-failure metrics logを実行する。
- Cost Explorerの全`ListBucket`がこの3worker由来だったかは過去data event不足により確定していない。

## 成果物

- PR #446
- `reports/working/20260722-2330-cost-first-disable-background-s3-scans.md`
- `tasks/todo/20260722-physical-remove-unused-background-control-infra.md`
- cost-firstへ更新した`FR-066`、`FR-086`、`FR-093`、`SQ-015`、`OPS_MONITORING_001`
