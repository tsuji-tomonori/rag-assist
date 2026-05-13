# 利用量・コスト見積もり詳細設計

- ファイル: `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_010.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-07
- 状態: Draft

## 何を書く場所か

Bedrock、S3 Vectors、DynamoDB、Lambda などの利用量を集計し、service/component 別の概算料金を算出する設計を定義する。

## 対象

- Usage Meter
- Pricing Catalog
- Cost Estimator
- usage source
- cost estimate confidence
- admin cost view

## 関連要求

- `NFR-002`
- `NFR-009`
- `FR-027`

## 入出力

| 処理 | 入力 | 出力 |
|---|---|---|
| `collect_usage` | trace、document/vector manifest、DynamoDB item stats、Lambda metrics | usage summary |
| `load_pricing_catalog` | service、region、catalog version | pricing catalog entries |
| `estimate_cost` | usage summary、pricing catalog、period、component map | cost estimate |
| `get_cost_summary` | authorized user、period、filters | service/component 別 cost summary |

## 利用量ソース

| service | usage source | 主な単位 |
|---|---|---|
| Bedrock chat model | Debug Trace Store | input tokens、output tokens、model id、region |
| Bedrock embedding model | ingestion/search trace | embedding tokens、model id、region |
| S3 Vectors | vector manifest、query diagnostics | vector count、logical storage、query API、query data processed |
| DynamoDB | item size estimate、CloudWatch metrics | read request unit、write request unit、storage、PITR |
| Lambda | CloudWatch metrics | request count、duration、memory GB-second |
| object storage | manifest、object metadata | object count、storage bytes、request count |

## 処理手順

### 利用量集計

1. Usage Meter は対象期間と component map を受け取る。
2. Debug Trace Store から model id、token usage、RAG step、component を集計する。
3. document/vector manifest から vector count、storage bytes、indexVersion を集計する。
4. DynamoDB item stats または CloudWatch metrics から read/write/storage の概算値を集計する。
5. Lambda metrics から request count と `memoryGb * durationSeconds` を集計する。
6. usage source が実測か概算かを `confidence` に記録する。

### 料金カタログ

1. Pricing Catalog は service、region、unit、effective date、version を持つ。
2. 単価が未登録の service/component は 0 円扱いにしない。
3. pricing catalog の更新は audit 可能な version として扱う。
4. 公式料金とずれる可能性があるため、表示上は請求額ではなく概算と明記する。

### コスト見積もり

1. Cost Estimator は usage summary と pricing catalog を結合する。
2. unit が一致する項目だけ `quantity * unitPrice` で小計を算出する。
3. service 別、component 別、期間別の subtotal と total を作る。
4. 単価未登録、usage source 不足、概算 source を confidence と warning に反映する。
5. Admin Ledger または admin cost view は cost summary を permission に応じて表示する。

## 表示方針

- 表示名は「概算料金」または「見積もり」とし、AWS 請求額と断定しない。
- service、component、period、confidence、unpriced items を同時に表示する。
- 未算出項目を 0 円に見せず、`unpriced` または `unknown` として分ける。
- 個人別利用量を出す場合は permission と privacy 境界を別途確認する。

## エラー処理

| 事象 | 方針 |
|---|---|
| pricing catalog 未登録 | 対象 component を `unpriced` にし、合計の confidence を下げる。 |
| usage source 不足 | 概算または未算出として扱い、請求額として断定しない。 |
| unit 不一致 | 対象項目を計算せず、unit mismatch warning を出す。 |
| metrics 取得失敗 | 対象 service の estimate を partial とし、failure reason を残す。 |
| 権限なし | cost summary を返さず 403 とする。 |

## テスト観点

| 観点 | 期待 |
|---|---|
| Bedrock token cost | input / output / embedding token を単価単位ごとに分けて計算する。 |
| S3 Vectors cost | storage、PUT、query API、query data processed を混同しない。 |
| DynamoDB cost | read/write/storage/PITR を別項目として扱う。 |
| Lambda cost | request count と GB-second を分けて計算する。 |
| 未登録単価 | 0 円ではなく `unpriced` と warning を出す。 |
| 概算 confidence | estimated usage と measured usage を区別する。 |
| 権限 | cost auditor または管理者 permission なしで summary を取得できない。 |
