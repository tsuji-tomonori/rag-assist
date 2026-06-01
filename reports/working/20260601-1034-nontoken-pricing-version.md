# Non-token pricing version 作業完了レポート

- 日時: 2026-06-01 10:34 JST
- 対象タスク: `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 受けた指示

- `.workspace/plan-060101.txt` の章別仕様 gap 実装を継続する。
- 完了条件を満たすまで完了扱いせず、実施した検証だけを記録する。

## 要件整理

- plan は UsageEvent と export / cost audit に `pricingVersion` を含め、監査可能にする方針を示している。
- TextModel 経由の token event には `pricingVersion` が入るが、`recordUsageEvent()` で作る benchmark / debug / async_agent などの非 token event には `pricingVersion` が入っていなかった。

## 検討・判断

- 非 token event は `usageConfidence=missing` として cost には混ぜないが、監査上はどの pricing catalog 前提で記録されたかを残す価値がある。
- 既存 default catalog と同じ `defaultPricingVersion` を保存し、TextModel 経由 event と最低限のメタデータを揃えた。

## 実施作業

- `recordUsageEvent()` が作る missing usage event に `pricingVersion: defaultPricingVersion` を追加した。
- async agent と benchmark の UsageEvent test に `pricingVersion` assertion を追加した。

## 成果物

- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/rag/pricing-catalog.test.ts`: pass（54 件）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## fit 評価

- 非 token UsageEvent にも pricingVersion を残し、export / cost audit の監査性を上げた。
- 実 AWS 環境での DynamoDB 永続化と export signed URL は未検証のため、ローカル service test による確認に留まる。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
- 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
