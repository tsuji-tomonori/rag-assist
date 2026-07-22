# コスト優先で定期 S3 全走査を停止する

- 状態: do
- タスク種別: 修正
- 着手: 2026-07-22 23:00 JST

## 背景

AWS Cost Explorer で `ListBucket` が継続課金されており、repository の実装調査から以下の scheduled worker が S3 `ListObjectsV2` を定期実行することを確認した。

- `RagQualityMonitorFunction`: 5分ごとに `quality-control/source-samples/` と `quality-control/observations/` を全列挙
- `RevocationCleanupFunction`: 1分ごとに cleanup tenant / repair / manifest を列挙
- `SecurityAuditReconciliationFunction`: 1分ごとに audit intent / source-governance state を列挙

owner 判断として、現時点ではこれらの自動 control loop より AWS コスト最小化を優先する。

## なぜなぜ分析要約

### 問題文

2026-07-16 の deploy 後、利用者操作がなくても S3 LIST 系コストが日次で継続・増加し、MVP のコスト優先方針から逸脱した。

### 確認済み事実

- 共通 `S3ObjectStore.listKeys()` は `ListObjectsV2Command` を pagination 付きで実行する。
- 3 worker は EventBridge により1分または5分間隔で起動される。
- worker は対象時間帯や pending 件数を判定する前に prefix 全体を列挙する経路を持つ。
- FR-066、FR-086、FR-093 は Draft / inferred の要求で、owner による現行コスト優先判断より上位の確定契約ではない。

### 推定原因

- 連続監視・reconciliation 要求を、その時点のオブジェクト量に比例する prefix scan と高頻度 schedule で直接実装した。
- 「安全・品質 control は常時有効」という設計前提が、MVP の利用量・予算に対する明示的な cost gate より優先された。

### 未確認事項

- Cost Explorer の全 `ListBucket` がこの3 workerだけに由来するかは、過去の S3 data event が無いため確定していない。
- Lambda invoke / CloudWatch Logs / S3 GET・PUT の厳密な削減額は deploy 後の請求で確認する必要がある。

### 根本原因

定期 background control loop を opt-in にせず、無条件・高頻度・全prefix scanとして production stackへ組み込み、コスト上限を release acceptance の先行条件にしていなかった。

### 全影響範囲への対策

- scheduled entrypoint から S3 LIST を除去し、cleanup / audit reconciliation は no-op にする。
- RAG monitor は signal aggregationを停止し、既存 API interlock を失効させないための direct GET/PUT heartbeat のみに縮退する。
- FR-066、FR-086、FR-093 と SQ-015、monitoring runbook に cost-first product decision と未充足要件を明記する。
- underlying deny-first / durable audit / monitor domain codeは削除せず、将来の明示 opt-in または設計変更に備えて保持する。

## 目的

scheduled worker から S3 prefix listing を排除し、利用者操作がない状態の `ListBucket` 継続課金を止める。MVP の現行 product priority を「コスト最優先」として正本文書へ反映する。

## スコープ

- `apps/api/src/rag-quality-monitor-worker.ts`
- `apps/api/src/revocation-cleanup-worker.ts`
- `apps/api/src/security-mutation-audit-reconciliation-worker.ts`
- 対象 worker tests
- `FR-066`, `FR-086`, `FR-093`, `SQ-015`
- `OPS_MONITORING_001`
- 作業レポート

Infra resource / EventBridge rule の物理削除は本PRでは行わない。snapshot / generated inventory を伴う大規模 IaC 差分より先に、課金の直接原因である S3 LIST 呼び出しを停止する。scheduled Lambda の最小 invocation cost と既存 alarm costは残余として明記する。

## 実装計画

1. RAG monitor scheduled handler を cost-priority heartbeat へ置換し、`ListObjectsV2` を呼ばず safety state を direct GET/PUT だけで normal に更新する。
2. revocation cleanup scheduled handler を空 registry / no-op service で実行し、S3 tenant / manifest discoveryを行わない。
3. security audit reconciliation scheduled handler を認可入力検証付き no-op reconcilerへ置換し、S3 intent / governance列挙を行わない。
4. worker testで scheduled entrypoint が list/reconcile処理を呼ばないことを固定する。
5. 正本 requirements / runbookに cost-first decision、失われる保証、再有効化条件を記録する。

## ドキュメント保守計画

- Draft requirement の状態と実装適合を現行判断へ更新する。
- SQ-015 に recurring background scan 禁止を明示する。
- monitoring runbook の既存自動 control loop 手順を legacy opt-in reference とし、現行 cost-priority behaviorを先頭に記載する。

## 受け入れ条件

- [ ] scheduled RAG monitor handler が `listKeys()`、benchmark list、observation aggregationを呼ばず、S3 direct GET/PUT の safety heartbeatだけを行う。
- [ ] scheduled revocation cleanup handler が tenant discovery / `reconcilePending()` を呼ばず、zero resultを返す。
- [ ] scheduled security audit reconciliation handler が production outbox / resolverを構築せず、認可済み tenantへzero resultを返す。
- [ ] explicit domain handler / coordinator testsは維持し、scheduled entrypoint停止とdomain primitive削除を混同しない。
- [ ] FR-066 / FR-086 / FR-093 の未充足範囲と SQ-015 の cost-first優先順位が正本文書に明記される。
- [ ] targeted tests、API typecheck、lint、docs check、diff checkの実施結果を正直に記録する。
- [ ] main向けPRを作成し、日本語の受け入れ条件コメントとセルフレビューコメントを投稿する。

## 検証計画

- targeted worker tests
- `npm run typecheck -w @memorag-mvp/api`
- `npm run lint`
- `task docs:check`
- `git diff --check`
- GitHub Actions final-head CI

ローカル checkout / dependency runtime がこの実行環境に無いため、GitHub Actions結果を主要な実行検証とする。未実施をpass扱いしない。

## PRレビュー観点

- scheduled entrypoint に `createDependencies()` 経由のprefix listが残っていないか
- safety state heartbeat が本番 RAG を意図せず停止しないか
- deny-first authorization 自体を弱めず、物理cleanupだけを停止しているか
- audit mutationのdurable intent生成自体を削除していないか
- requirement docsが「満たしている」と誤記していないか

## リスク

- revocation後の派生artifact物理cleanupが自動実行されない。
- audit finalization failureが自動収束せず、source governance等が `reconciliation_required` に残る可能性がある。
- production drift / quality / security monitoring、alert、safe actionは実行されない。
- EventBridge/Lambda/CloudWatch resourceは残るため、LIST以外の小額固定・invoke/logコストは残る。
