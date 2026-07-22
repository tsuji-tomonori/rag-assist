# SQ-015 継続運用コスト最優先

- 要件ID: `SQ-015`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Approved Direction（上限値は継続測定）
- 優先度: S

## 要件

- SQ-015: システムは、現行 MVP の品質・安全・監査の追加機能より、利用者操作がない状態の AWS recurring cost 最小化と、コスト削減変更を確実にdeployできることを優先すること。
- pending workまたは新規dataが0件のbackground処理は、有料APIをpollingして空を確認してはならない。特にS3 prefix全件の周期的 `ListObjectsV2` を既定で禁止する。
- deploy workflowも、automatic deployの前提として蓄積済みS3履歴を全件list/downloadしてはならない。必要なrelease contextはrepository artifact、bounded manifest、明示されたobject key、またはowner承認済みindexから取得する。
- request、run、document当たりのmodel・storage・workerコストだけでなく、idle時とdeploy時のLambda invocation、S3 request、CloudWatch Logs/metrics/alarm、SNS、KMS、Secrets Manager等の費用を管理対象に含める。
- advanced monitoring、physical cleanup、audit reconciliation、automatic RAG promotionは、明示的な利用価値・budget・上限・retention・owner承認がある場合だけopt-inで有効化する。

## 品質尺度

- measure: 日次/月次のidle recurring cost、deploy当たりS3 request、operation別request count、request/run/document当たりmodel・embedding・storage・worker・egress cost。
- target: idle時のapplication-originated S3 LISTは0件/日。cost-first deployのobservation履歴LIST/GETは0件。その他operationはowner承認済みbudget内。
- fail point: 未承認のscheduled scan、deploy前full-history scan、件数に比例して増えるfull-prefix scan、利用者操作がないのに日次費用が増加する状態、またはscan timeoutでcost-control deployが実行されない状態。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-015` |
| 説明 | idle recurring cost、deploy cost、単位処理costの最優先ceiling |
| 根拠 | MVPを継続運用可能な予算内に保ち、削減変更を実環境へ反映可能にする |
| 源泉 | RAGガイド §8.6、AWS Cost Explorer調査、deploy run `29936120192`、owner decision 2026-07-22/23 |
| Actor / trigger | deploy、background schedule追加、benchmark、cost review、promotion |
| 種類 | サービス品質制約 / FinOps / architecture guard |
| 依存関係 | price profile、Cost Explorer/CUR、resource tags、deployment context |
| 衝突 | continuous monitoring/cleanup/audit/promotionとidle・deploy時のbounded cost。現行MVPではcostを優先する |
| 受け入れ基準 | `AC-SQ015-001`, `AC-SQ015-002`, `AC-SQ015-003`, `AC-SQ015-004` |
| 優先度 | S |
| 安定性 | High |
| Confidence | owner_decision |
| 所有者 | Product / FinOps |
| 変更履歴 | 2026-07-11 初版、2026-07-22 recurring cost最優先、2026-07-23 deploy前full scan禁止を追加 |

## 受け入れ条件

### AC-SQ015-001 idle recurring cost

- Given: 利用者request、pending job、新規observation、repair対象がない
- When: 24時間stackを維持する
- Then: application background workerによるS3 LISTは0件であり、未承認のpolling requestを発生させない

### AC-SQ015-002 単位コスト

- Given: approved workload、region、price versionがある
- When: representative request/run/documentを評価する
- Then: component別と合計の単位コストを算出し、ownerが承認したceiling以下である

### AC-SQ015-003 optional control activation

- Given: monitoring、cleanup、reconciliation、automatic promotion等のoptional controlを再有効化する
- When: design/deploy reviewを行う
- Then: event/index/time-partitioned方式、bounded read/write、retention、月額見積、rollback、cost alarmを提示し、Product/FinOps ownerが明示承認する。空キューまたは履歴完全性確認のfull-prefix pollingは不合格とする

### AC-SQ015-004 cost-first deploy

- Given: `DEPLOYMENT_MODE=cost_priority`でmainまたはmanual deployを実行する
- When: deployment contextを準備する
- Then: S3 observation履歴をlist/downloadせず、repository policyだけからbounded contextを生成し、artifactを残してCDK build/synth/deployへ進む

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 実請求とdeploy失敗でfull-prefix scanの運用影響を確認 |
| 十分性 | OK | idle、deploy、unit、service、operation、activation gateを含む |
| 理解容易性 | OK | backgroundとdeploy双方のfull scan禁止を明示 |
| 一貫性 | Owner override | Draft/inferredのFR-066/075/086/093より本要件を優先 |
| 標準・契約適合 | OK | FinOps、pay-per-use、bounded/event-driven設計に適合 |
| 実現可能性 | OK | schedule停止、repository context、explicit operation、queue/indexで実現可能 |
| 検証可能性 | OK | workflow contract、Actions steps、Cost Explorer/CUR、CloudTrail data eventsで確認 |
| ニーズ適合 | OK | 予算超過を防ぎ、停止変更をdeploy可能にする |
| 実装適合 | Partial（improving） | scheduled S3 scan停止済み。deploy前observation scanを除去するPRで補完 |

## トレース

- 後方: `FR-019`, `FR-075`, AWS cost investigation 2026-07-22、deploy run `29936120192`、owner decision。
- 前方: cost-first deployment contract、background worker opt-in contract、monthly budget、resource removal follow-up。
