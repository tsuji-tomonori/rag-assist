# 作業レポート: コスト優先で定期 S3 全走査を停止

保存先: `reports/working/20260722-2330-cost-first-disable-background-s3-scans.md`

## 1. 受けた指示

- `ListBucket`を発生させるbackground applicationの必要性と要求起源を確認する。
- これらは基本的に不要と判断し、AWSコストを最優先として削除・停止するpull requestを作成する。

## 2. 要求起源とowner判断

| 機能 | 元要求 | 元の意図 | 2026-07-22判断 |
| --- | --- | --- | --- |
| RAG quality monitor | `FR-093`、`SQ-005`–`SQ-015` | production signal集約、drift検知、alert、safe action | Draft/inferredのadvanced control。常時実行を延期 |
| revocation cleanup | `FR-066` | authoritative deny後の派生artifact物理cleanupと収束 | deny-firstは維持。periodic physical cleanupは停止 |
| security audit reconciliation | `FR-086` | durable audit intentのbackground finalization/repair | intent生成は維持。periodic enumeration/finalizationは停止 |
| cost ceiling | `SQ-015` | request/run/document単位コスト | owner decisionによりidle recurring cost最優先へ昇格 |

元要求は2026-07-11にRAG guideとrequirements baselineから作成されたDraft/inferred requirementであり、運用開始済みの不可変更契約ではない。実請求を受けたownerの明示判断を正本へ反映した。

## 3. なぜなぜ分析

### 問題

利用者操作が無い状態でもS3 `ListBucket`課金が継続し、7月16日以降に日次費用が増加した。

### 直接原因

- `S3ObjectStore.listKeys()`がpagination付き`ListObjectsV2`を実行する。
- 3つのEventBridge workerが1分または5分間隔で、対象件数を知る前にS3 prefixを列挙する。
- RAG monitorは時間windowをS3 keyで限定せず、全keyを取得してからfilterする。

### 根本原因

continuous safety/quality/reconciliationをopt-inにせず、空キューでも有料prefix scanを行うpolling architectureとしてMVP stackへ常時組み込んだ。cost ceilingが実装前のarchitecture gateになっていなかった。

### 対策

- scheduled production entrypointをS3 listing不能な実装へ変更した。
- synchronous deny、durable audit intent、domain primitiveは保持した。
- `SQ-015`を最優先owner decisionへ更新し、idle時S3 LIST 0件をacceptance targetにした。
- physical EventBridge/Lambda/Alarm/SNS removalはgenerated inventory/snapshot/deployを伴うfollow-upへ分離した。

## 4. 実装

### RAG quality monitor

- source sample / observation listing、benchmark list、aggregation、evaluation、alert、safe actionをscheduled handlerから除去。
- active policyのdirect GETと`runtime/safety-state.json`のdirect PUTだけを行うcompatibility heartbeatへ縮退。
- factoryのstore型を`getText`/`putText`だけに限定し、`listKeys`を受け取れないcontractとした。
- full observation/alert/action metricsは生成せず、既存missing-data alarmを正常に保つzero-failure heartbeat metricsだけを維持した。

### Revocation cleanup

- production `handler()`からdependency生成、tenant registry discovery、`reconcilePending()`を除去。
- scheduled invocationはzero resultを返す。
- explicit `createRevocationCleanupHandler()`とdomain primitiveは保持。

### Security audit reconciliation

- production `handler()`からS3 outbox/resolver構築を除去。
- tenant/limit検証後にzero resultを返すcost-priority consumerを追加。
- explicit reconciler factoryとdomain testsは保持。

### Requirements / operations

- `FR-066`: deny-firstを維持し、periodic physical cleanupをexplicit/low-cost方式へ変更。
- `FR-086`: durable intentを維持し、periodic reconciliationをexplicit repairへ変更。
- `FR-093`: full production control loopをDeferredへ変更。
- `SQ-015`: idle recurring cost最優先、S3 LIST 0件/日を規定。
- `OPS_MONITORING_001`: current behavior、残余cost、再有効化gate、deploy後検証を更新。

## 5. 変更しない範囲

- authoritative authorization/deny decision
- durable security mutation audit intent
- cleanup/reconciliation/monitor domain sourceとlocal tests
- EventBridge rule、Lambda function、CloudWatch alarm/log group、SNS topicのCloudFormation resource
- API/Web UI、public API schema、data schema

## 6. 残余リスク

- cleanup対象artifactは自動物理削除されない。
- audit finalization failureは自動収束しない。
- production drift/quality/security alertとsafe actionは実行されない。
- compatibility heartbeatはnormal stateを供給するため、自動quarantine / limited / refuse / rollbackは行わない。
- EventBridge/Lambda/Logs/Alarm/SNS resourceは残るが、disabled rule由来の定期invocation/log costは停止する。
- EventBridge schedulesをdisabledにし、compatibility heartbeat、S3 GET/PUT、metrics logを定期実行しない。
- Cost Explorerの全`ListBucket`がこの3worker由来だったかは過去data event不足により確定していない。

## 7. 検証

### Repository-static確認

- scheduled RAG handlerのdependency surfaceは`getText`/`putText`のみ。
- scheduled revocation handlerはdependencyを生成しない。
- scheduled audit handlerはoutbox/resolverを生成しない。
- requirementsとrunbookへowner decision・deferred保証・cost targetを反映。
- physical resource削除を `tasks/todo/20260722-physical-remove-unused-background-control-infra.md` で追跡。

### GitHub Actions

初回CI run `29927804158` はAPI lintでtype-only import違反を検出した。他のtypecheck、docs、tests、build、CDK synthはpassしていた。2ファイルのimportを`import type`へ修正した。

final implementation headの結果:

- MemoRAG CI run `29928662172`: success
  - web/api/infra lint: pass
  - infra/API/Web/benchmark typecheck: pass
  - OpenAPI、source-backed API docs、canonical docs、Web/infra inventory: pass
  - product runtime release audit: pass
  - infra/benchmark/API/Web tests: pass
  - API coverage: C0 90.65%、C1 80.47%（既存taskで追跡）
  - Web coverage: C0 90.87%、C1 85.77%
  - infra/API/Web/benchmark build: pass
  - CDK synth / cdk-nag、DynamoDB GSI guard: pass
- Validate Semver Label run `29928659998`: success

PR lifecycle:

- Draft PR: `https://github.com/tsuji-tomonori/rag-assist/pull/446`
- `semver:major` label: 設定済み
- 受け入れ条件コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/446#issuecomment-5047538277`
- セルフレビューコメント: `https://github.com/tsuji-tomonori/rag-assist/pull/446#issuecomment-5047543694`
- task: `tasks/done/20260722-2300-cost-first-disable-background-s3-scans.md`

### 未実施

- local checkout上の手動command実行。この環境ではrepository runtimeをmaterializeしておらず、GitHub Actionsを実行証跡とした。
- live CDK deploy / CloudFormation update。
- deploy後24時間のS3 LIST / Cost Explorer / CUR / data event確認。
- actual API health / chat / search / ingest smoke。

未実施項目をpass扱いしない。

## 8. Fit評価

| 評価軸 | 評価 | 理由 |
| --- | ---: | --- |
| 指示網羅性 | 4.7/5 | 要求起源、RCA、scheduled LIST停止、PR/label/comments/CIまで実施。physical resource削除はfollow-up |
| コスト適合 | 4.5/5 | 主要prefix LISTを停止。Lambda invocation、heartbeat GET/PUT、alarm等は残る |
| 安全境界 | 4/5 | deny-first/intentionは維持するが、background convergence/monitoringを意図的に延期 |
| 説明責任 | 5/5 | 失われる保証、残余cost、未検証、再有効化gateを明記 |
| 検収容易性 | 4.7/5 | unit contract、full CI、deploy後Cost Explorerで検証可能 |

**総合fit: 4.6/5**

repository-local acceptanceは成立した。live AWSへの反映と実請求低下はmerge/deploy後の運用検証として残る。
