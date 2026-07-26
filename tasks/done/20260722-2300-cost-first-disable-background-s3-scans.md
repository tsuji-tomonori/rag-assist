# コスト優先で定期 S3 全走査を停止する

- 状態: done
- タスク種別: 修正
- 着手: 2026-07-22 23:00 JST
- PR: #446
- リリース種別: `semver:major`

## 背景

AWS Cost Explorer で `ListBucket` が継続課金され、repository調査から次の scheduled worker が S3 `ListObjectsV2` を高頻度で実行することを確認した。

- `RagQualityMonitorFunction`: 5分ごとに source sample / observation prefix を全列挙
- `RevocationCleanupFunction`: 1分ごとに cleanup tenant / repair / manifest を列挙
- `SecurityAuditReconciliationFunction`: 1分ごとに audit intent / source-governance state を列挙

`FR-066`、`FR-086`、`FR-093` は RAG guide 等から作成された Draft / inferred requirement である。2026-07-22 の owner 判断により、現行 MVP ではこれらの常時 control より `SQ-015` の idle recurring cost 最小化を優先した。

## 根本原因

continuous safety / quality / reconciliation を opt-in にせず、空キューでも有料 prefix scan を行う polling architecture として MVP stack へ組み込み、cost ceiling を architecture / release gate の先行条件にしていなかった。

## 実施内容

### EventBridge

CloudFormation 上で次の3 ruleを `DISABLED` にした。

- `RagQualityMonitorSchedule`
- `RevocationCleanupSchedule`
- `SecurityAuditReconciliationSchedule`

これにより、定期 Lambda invocation、定期 S3 LIST、monitor compatibility heartbeat、定期 metrics log は実行されない。

### RAG runtime dependency

- API / worker environment を `RAG_MONITORING_REQUIRED=0` に変更した。
- monitoring が明示的に disabled の場合、`assertRagSafetyInterlock()` は safety-state object を読む前に return する。
- test / explicit caller が monitoring stateを検証する場合の既存contractは維持した。
- 旧または期限切れの `quality-control/runtime/safety-state.json` が残っていても cost-first production runtime を停止させない。

### Scheduled worker source

- RAG monitor entrypoint から source sample / observation listing、benchmark list、aggregation、evaluation、alert、safe action を除去した。
- revocation cleanup entrypoint から dependency 生成、tenant registry discovery、`reconcilePending()` を除去した。
- security audit reconciliation entrypoint から S3 outbox / resolver 構築を除去した。
- explicit domain handler、authoritative deny、durable audit intent は保持した。

### Requirements / operations

- `FR-066`: deny-first を維持し、physical cleanup を明示実行または将来の低コスト方式に限定。
- `FR-086`: durable intent を維持し、background finalization を明示 repair へ変更。
- `FR-093`: full production monitoring control loop を Deferred へ変更。
- `SQ-015`: priority S、idle recurring cost 最優先、application-originated S3 LIST 0件/日を規定。
- `OPS_MONITORING_001`: EventBridge停止、runtime optional化、残余 risk、再有効化 gate、deploy 後検証を更新。

## 受け入れ条件結果

- [x] 3つの EventBridge schedule が synthesized template で `DISABLED` になる。
- [x] API / worker が `RAG_MONITORING_REQUIRED=0` で deploy される。
- [x] monitoring disabled 時は stale safety-state object を読まない。
- [x] scheduled sourceから S3 prefix listing / reconciliation を除去した。
- [x] explicit domain primitive、authoritative deny、durable audit intent を維持した。
- [x] infra snapshot と generated infra inventory を更新した。
- [x] source-backed API docsをruntime変更へ再生成した。
- [x] infra tests、API / infra typecheck、API coverage tests、lint、generated docs / inventory checks、diff checkがpassした。
- [x] main 向け PR #446 と `semver:major` labelを作成した。

## 検証記録

- EventBridge stop application workflow run `29933343161`: success
  - infra tests / snapshot regeneration: pass
  - infra inventory regeneration: pass
  - API / infra typecheck: pass
  - repository lint: pass
  - generated inventory check / diff check: pass
  - generated EventBridge commit: `e6ef1b9f9cc3b0b42e2d7790d1d298d281e5b25d`
- API docs / test finalization workflow run `29934912541`: success
  - optional monitoring compatibility patch: pass
  - source-backed API docs regeneration / check: pass
  - API coverage tests: 825 tests、fail 0
  - API typecheck / diff check: pass
  - generated docs commit: `32d8c2d5153236368af7881b3f14f96dd1cc149f`
- required final-head CI は PR の check / final comment を正本とする。

## 未実施・残余リスク

- live AWS deploy、CloudFormation update、deploy 後24時間の Cost Explorer / CUR / S3 data event 確認は未実施。
- revocation 派生 artifact は自動物理削除されない。
- audit finalization failure は自動収束しない。
- production RAG drift / quality / security alert と safe action は実行されない。
- disabled rule、Lambda、IAM、Logs、Alarm、SNS resource 自体は残る。物理削除は `tasks/todo/20260722-physical-remove-unused-background-control-infra.md` で追跡する。
- Cost Explorer の全 `ListBucket` がこの3 worker 由来だったかは、過去 data event 不足により確定していない。

## 成果物

- PR #446
- `reports/working/20260722-2330-cost-first-disable-background-s3-scans.md`
- `tasks/todo/20260722-physical-remove-unused-background-control-infra.md`
- cost-firstへ更新した `FR-066`、`FR-086`、`FR-093`、`SQ-015`、`OPS_MONITORING_001`
