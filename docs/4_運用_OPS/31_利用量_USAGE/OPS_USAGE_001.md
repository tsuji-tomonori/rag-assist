# Usage / Cost accounting rollout 運用

- ファイル: `docs/4_運用_OPS/31_利用量_USAGE/OPS_USAGE_001.md`
- 種別: `OPS_USAGE`
- 作成日: 2026-07-15
- 状態: Draft

## 目的

tenant-scoped usage event と versioned pricing を、欠落・二重計上・tenant 混在・誤価格を検出できる段階的 rollout で導入する。AWS Billing / Cost and Usage Report は請求の正本であり、この cost audit を請求確定値として扱わない。

## rollout mode

| mode | write | read / export | 用途 |
| --- | --- | --- | --- |
| `disabled` | 無効 | 非公開 | 緊急 rollback。既存 event は削除しない |
| `shadow` | 有効 | 非公開。API は `rolloutMode=shadow` と missing を返し export は `503` | live canary と reconciliation |
| `active` | 有効 | permission に応じて公開 | 全 gate 合格後だけ設定 |

CDK の初期値は `shadow` である。`USAGE_PRICING_CATALOG_JSON=[]` は price unavailable を意味し、0 USD の根拠にしない。

## migration / backfill

- PR #339 の固定 tenant、DynamoDB Scan、固定 wildcard price は移植しない。現行の旧 admin ledger usage summary は provider event identity、run、measurement source を持たず、正確な event へ backfill できないため移行入力にしない。
- 新 table は append-only event source として開始する。既存 summary は削除せず、比較資料としてのみ保持する。
- replay/backfill を追加する場合は authoritative tenant と stable source operation ID を idempotency key に含め、同じ migration を再実行して event 数・quantity が増えないテストを必須にする。

## shadow reconciliation gate

1. chat と document ingest の provider usage を含む代表 workload を isolated tenant で実行する。
2. DynamoDB GSI query が `Scan` を使わず、1,000 件超の全 cursor page、複数 tenant、半開区間を欠落なく返すことを確認する。
3. tenant 混在、同一 idempotency key の重複、event/quantity 欠落の許容値は `0` とする。
4. item cost の再計算差は 12 decimal USD 丸め後 `0`、catalog version/source/region/model/unit の不一致許容値も `0` とする。
5. AWS provider usage と event quantity、承認済み billing source と catalog、Cost and Usage Report と期間総額を照合する。請求総額の許容率と承認者は FinOps が明示するまで未確定であり、`active` の release blocker とする。
6. usage/cost export storage、redaction、期限、成功/失敗 audit を live 環境で確認する。

## cutover / rollback

- Platform、Security、FinOps が canary evidence、catalog version、請求差分許容率を承認した変更だけ `USAGE_ACCOUNTING_MODE=active` にする。
- cross-tenant event、重複、cursor 欠落、誤 catalog、unpriced の zero 表示、export 監査欠落が 1 件でもあれば cutover を停止する。
- active 後に blocker を検出した場合は `shadow`、write 自体が危険な場合は `disabled` へ戻す。table/event は削除せず、修復後に同じ idempotency key で replay する。
- rollback は application mode の切替であり、table 削除、履歴改変、価格 event の上書きを行わない。

## 未実施の live acceptance

この変更では実 AWS Bedrock usage、deployed DynamoDB GSI、S3 signed export、承認済み price catalog、CUR/請求照合を実施していない。これらと FinOps 承認済み請求差分許容率が揃うまで production `active` は blocked である。
