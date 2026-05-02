# 作業完了レポート

保存先: `reports/working/20260502-1125-cost-design-update.md`

## 1. 受けた指示

- 主な依頼: 設計書で料金を算出する箇所を確認し、必要な更新を行う。
- 成果物: MemoRAG MVP の設計ドキュメント更新。
- 形式・条件: `memorag-bedrock-mvp/docs` の既存 SWEBOK-lite 構成に合わせる。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 料金算出箇所を確認する | 高 | 対応 |
| R2 | 設計書を更新する | 高 | 対応 |
| R3 | 固定単価ではなく将来更新可能な料金算出設計にする | 高 | 対応 |
| R4 | 既存の app/web 実装への影響を確認する | 中 | CI で確認 |

## 3. 検討・判断したこと

- 現行実装の `debug.steps[].tokenCount` は trace/UI 表示用の概算であり、AWS 請求額の算出根拠として断定しない方針にした。
- AWS の料金は service、region、model、tier、単価単位で変わるため、設計書に固定単価を埋め込まず、`PricingCatalogEntry` で公式料金表 URL と確認日を保持する形にした。
- 料金算出対象は Bedrock token、S3 Vectors、DynamoDB on-demand、Lambda、S3 object storage に分け、単価単位を混同しない設計にした。
- 将来 schema 変更時に区別できるよう、追加した料金関連 item に `schemaVersion` を持たせた。

## 4. 実施した作業

- 高レベル設計に `Cost Estimator` コンポーネントと主要フローを追加した。
- データ設計に `UsageMeter`、`PricingCatalogEntry`、`CostEstimate` と料金算出モデルを追加した。
- 詳細設計に `estimate_cost` の入出力、処理手順、エラー処理、テスト観点を追加した。
- API 設計に、現行 MVP は料金算出 API を未提供とし、`/chat` の debug token は請求精度の根拠ではない旨を追記した。
- AWS 公式料金表を確認し、参照元 URL を設計書へ明記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md` | Markdown | Cost Estimator と料金算出フロー | R2 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md` | Markdown | 料金算出手順、例外、テスト観点 | R2 |
| `memorag-bedrock-mvp/docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md` | Markdown | 料金算出データモデル、算出式、参照元 | R1, R2, R3 |
| `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md` | Markdown | API との関係と現行 MVP の範囲 | R2 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | 料金算出箇所を確認し、設計書の該当層を更新した |
| 制約遵守 | 5 | docs 構成とレポート作成ルールに従った |
| 成果物品質 | 4 | 実装前提の概算設計として整理したが、実際の料金 API 実装は未着手 |
| 説明責任 | 5 | 請求額と概算値の違い、単価参照元、未提供 API を明記した |
| 検収容易性 | 5 | 変更ファイルと検証結果を明示した |

総合fit: 4.8 / 5.0（約96%）

理由: 設計書更新としては主要要件を満たした。料金算出 API や実測 usage 収集の実装は今回の依頼範囲外のため未対応。

## 7. 検証

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run ci`

## 8. 未対応・制約・リスク

- 料金算出 API、UsageMeter 永続化、CostEstimate 表示は実装していない。
- AWS 料金単価は変動するため、実装時は `effectiveDate` と `sourceUrl` を伴う単価表更新が必要。
- 正確な請求確認は AWS Billing / Cost Explorer / Cost and Usage Report を正とする。
