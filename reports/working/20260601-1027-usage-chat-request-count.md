# Usage chat request count 作業完了レポート

- 日時: 2026-06-01 10:27 JST
- 対象タスク: `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 受けた指示

- `.workspace/plan-060101.txt` の章別仕様 gap 実装を継続する。
- 完了条件を満たすまで完了扱いせず、実施した検証だけを記録する。

## 要件整理

- plan の `UsageSummaryResponse` 例は `chatRequestCount` を持つ。
- 現行の API / Web は `chatMessages` のみを返却・表示しており、仕様例との差分が残っていた。
- usage/cost の月次集計、breakdown、export UI に影響しない範囲で field を追加する。

## 検討・判断

- `chatRequestCount` は既存 `UsageEvent.chatMessages` を request 件数として扱い、既存の chat message counter と互換的に追加した。
- legacy admin ledger の空 usage には `chatRequestCount: 0` を追加し、既存ユーザーの月次集計では UsageEvent を優先する既存方針を維持した。
- Web の Usage table は request 件数表示に寄せ、fixture と contract test を schema 変更へ追従した。

## 実施作業

- `UserUsageSummary` 型、Zod schema、service response に `chatRequestCount` を追加した。
- API service test と contract test に `chatRequestCount` assertion を追加した。
- Web 型、Usage panel 表示、関連 test fixture を `chatRequestCount` に追従した。
- OpenAPI generated docs を再生成した。

## 成果物

- `apps/api/src/types.ts`
- `apps/api/src/schemas.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `apps/api/src/contract/api-contract.test.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx`
- `docs/generated/openapi.md`
- `docs/generated/openapi/get-admin-usage.md`

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（56 件）
- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`（`apps/api` cwd）: pass（16 件）
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx src/app/hooks/useAppShellState.test.ts src/App.test.tsx`: pass（65 件）
- `npm run docs:openapi`: pass
- `npm run docs:openapi:check`: pass
- `git diff --check`: pass

## fit 評価

- plan に明示されていた `chatRequestCount` field を API schema、service、Web 表示、OpenAPI に反映できた。
- 既存の月次 usage/cost 集計と export UI には追加 field のみの影響で、契約テストと関連 UI テストで確認済み。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
- 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
