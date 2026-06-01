# Cost summary pricing version 作業完了レポート

- 日時: 2026-06-01 10:37 JST
- 対象タスク: `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 受けた指示

- `.workspace/plan-060101.txt` の章別仕様 gap 実装を継続する。
- 完了条件を満たすまで完了扱いせず、実施した検証だけを記録する。

## 要件整理

- plan は cost export / cost audit に `pricingVersion` と `dataCompleteness` を含める方針を示している。
- 既存実装は cost item ごとの `pricingVersion` と `dataCompleteness` を持っていたが、`CostAuditSummary` top-level の pricing version がなかった。

## 検討・判断

- export payload は `costSummary` 全体を含むため、item を走査しなくても summary の pricing version を確認できる top-level field を追加するのが自然と判断した。
- 複数 version の UsageEvent が混在する場合は既存 `pricingVersionForEvents()` の `"mixed"` を使い、event がない場合は `defaultPricingVersion` を返す方針にした。

## 実施作業

- API `CostAuditSummary` 型と schema に `pricingVersion` を追加した。
- `getCostAuditSummary()` が当月 UsageEvent から top-level pricing version を返すようにした。
- Web 型と Cost panel 表示、API contract、Web fixture、OpenAPI generated docs を更新した。

## 成果物

- `apps/api/src/types.ts`
- `apps/api/src/schemas.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/contract/api-contract.test.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/components/panels/AdminCostPanel.tsx`
- `docs/generated/openapi.md`
- `docs/generated/openapi/get-admin-costs.md`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（48 件）
- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`（`apps/api` cwd）: pass（16 件）
- `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx src/App.test.tsx`: pass（61 件）
- `npm run docs:openapi`: pass
- `npm run docs:openapi:check`: pass
- `git diff --check`: pass

## 失敗後再実行

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/contract/api-contract.test.ts`: fail
- 理由: root cwd から contract test を実行したため、contract fixture path と child process の `tsx` 解決が `apps/api` cwd 前提に合わなかった。
- 対応: `apps/api` cwd で `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts` を再実行して pass。

## fit 評価

- cost summary / export payload に top-level `pricingVersion` が加わり、plan の export 監査要件への適合度が上がった。
- 実 AWS/S3 での export file 生成と signed URL ダウンロードは未検証のため、ローカル API/UI/OpenAPI contract による確認に留まる。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
- 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
