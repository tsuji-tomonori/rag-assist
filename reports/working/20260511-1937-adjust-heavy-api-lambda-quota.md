# Heavy API Lambda quota 調整 作業レポート

保存先: `reports/working/20260511-1937-adjust-heavy-api-lambda-quota.md`

## 1. 受けた指示

- 主な依頼: PR #260 で `MemorySize` は quota があるため 3008 にし、timeout が30分になっていたら15分にする。
- 成果物: PR branch の追加 commit、infra test / snapshot / docs 更新、PR コメント、作業レポート。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | Heavy API Lambda の MemorySize を 3008MB にする | 高 | 対応 |
| R2 | 30分 timeout があれば15分にする | 高 | 該当なしを確認 |
| R3 | assertion / snapshot / docs を設定値に同期する | 高 | 対応 |
| R4 | 変更範囲に見合う検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- 対象の `4096` は `HeavyApiFunction` の `memorySize`、infra assertion、CloudFormation snapshot、`docs/OPERATIONS.md` の説明に存在した。
- 検索で残った `4096` は `DocumentIngestRunWorkerFunction` の `EphemeralStorage.Size` であり、MemorySize ではないため変更対象外とした。
- `Duration.minutes(30)`、Lambda `Timeout: 1800`、API Gateway `1800000` 相当は見つからなかったため、timeout 変更は不要と判断した。

## 4. 実施した作業

- `HeavyApiFunction` の `memorySize` を 4096 から 3008 に変更した。
- infra assertion の期待値を 3008 に変更した。
- CloudFormation snapshot を更新した。
- `docs/OPERATIONS.md` の Heavy API Lambda memory 表記を 3008MB に更新した。
- 30分 timeout 相当の設定がないことを確認した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | `HeavyApiFunction` memory を 3008MB に変更 | R1 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` | TypeScript test | assertion を 3008MB に変更 | R3 |
| `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json` | JSON | snapshot を 3008MB に更新 | R3 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | 運用 docs の memory 表記を 3008MB に更新 | R3 |

## 6. 検証

- pass: `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp run lint`
- pass: `git diff --check`
- pass: `rg -n "MemorySize\\\": 4096|memorySize: 4096|Duration\\.minutes\\(30\\)|Timeout: 1800|TimeoutSeconds\\\\?\\\":1800|1800000" memorag-bedrock-mvp/infra/lib memorag-bedrock-mvp/infra/test memorag-bedrock-mvp/docs/OPERATIONS.md` が空

## 7. fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: MemorySize は 3008MB に揃え、30分 timeout が存在しないことを確認した。実環境での性能・quota 確認と production smoke は未実施のため満点ではない。

## 8. 未対応・制約・リスク

- production deploy / smoke は未実施。
- 4096MB から 3008MB に下げるため、重い同期 API の性能余裕は減る可能性がある。
