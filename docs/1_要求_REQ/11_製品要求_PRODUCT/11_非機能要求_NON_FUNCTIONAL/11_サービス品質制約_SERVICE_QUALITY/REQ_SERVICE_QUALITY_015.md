# SQ-015 継続運用コスト最優先

- 要件ID: `SQ-015`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Approved Direction（上限値は継続測定）
- 優先度: S

## 要件

- SQ-015: システムは、現行 MVP の品質・安全・監査の追加機能より、利用者操作がない状態の AWS recurring cost 最小化を優先すること。
- pending workまたは新規dataが0件のbackground処理は、有料APIをpollingして空を確認してはならない。特にS3 prefix全件の周期的 `ListObjectsV2` を既定で禁止する。
- request、run、document 当たりのmodel・storage・workerコストだけでなく、idle時のLambda invocation、S3 request、CloudWatch Logs/metrics/alarm、SNS、KMS、Secrets Manager等の継続費用を管理対象に含める。
- advanced monitoring、physical cleanup、audit reconciliationは、明示的な利用価値・budget・上限・retention・owner承認がある場合だけopt-inで有効化する。

## 品質尺度

- measure: 日次/月次のidle recurring cost、operation別request count、request/run/document当たりmodel・embedding・storage・worker・egress cost。
- target: idle時のapplication-originated S3 LISTは0件/日。その他background operationはowner承認済みbudget内。
- fail point: 未承認のscheduled scan、件数に比例して増えるfull-prefix scan、利用者操作がないのに日次費用が増加する状態。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-015` |
| 説明 | idle recurring costと単位処理costの最優先ceiling |
| 根拠 | MVPを継続運用可能な予算内に保つ |
| 源泉 | RAGガイド §8.6、AWS Cost Explorer調査、owner decision 2026-07-22 |
| Actor / trigger | deploy、background schedule追加、benchmark、cost review、promotion |
| 種類 | サービス品質制約 / FinOps / architecture guard |
| 依存関係 | price profile、Cost Explorer/CUR、resource tags |
| 衝突 | continuous monitoring/cleanup/auditとidle zero-cost。現行MVPではcostを優先する |
| 受け入れ基準 | `AC-SQ015-001`, `AC-SQ015-002`, `AC-SQ015-003` |
| 優先度 | S |
| 安定性 | High |
| Confidence | owner_decision |
| 所有者 | Product / FinOps |
| 変更履歴 | 2026-07-11 初版、2026-07-22 recurring cost最優先へ変更 |

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

- Given: monitoring、cleanup、reconciliation等のoptional controlを再有効化する
- When: design/deploy reviewを行う
- Then: event/index/time-partitioned方式、bounded read/write、retention、月額見積、rollback、cost alarmを提示し、Product/FinOps ownerが明示承認する。空キュー確認のfull-prefix pollingは不合格とする

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 実請求で継続S3 request costが確認され、ownerが最優先と決定 |
| 十分性 | OK | idle、unit、service、operation、activation gateを含む |
| 理解容易性 | OK | 品質を犠牲にしない抽象論ではなく、現行MVPの優先順位を明示 |
| 一貫性 | Owner override | Draft/inferredのFR-066/086/093より本要件を優先 |
| 標準・契約適合 | OK | FinOps、pay-per-use、event-driven設計に適合 |
| 実現可能性 | OK | schedule停止、explicit operation、queue/indexで実現可能 |
| 検証可能性 | OK | Cost Explorer/CUR、CloudTrail data events、unit testsで確認 |
| ニーズ適合 | OK | 予算超過を防ぎMVPを存続可能にする |
| 実装適合 | Partial（improving） | 3 scheduled entrypointのS3 prefix listingを停止。物理EventBridge/Lambda/Alarm削除は後続IaC最小化対象 |

## トレース

- 後方: `FR-019`, AWS cost investigation 2026-07-22、owner decision。
- 前方: cost-first architecture test、background worker opt-in contract、monthly budget、resource removal follow-up。
