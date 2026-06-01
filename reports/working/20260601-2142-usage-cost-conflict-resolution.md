# Usage Cost Conflict Resolution Report

保存先: `reports/working/20260601-2142-usage-cost-conflict-resolution.md`

## 1. 受けた指示

- 主な依頼: `.workspace/plan-060101.txt` の UsageEvent / PricingCatalog / admin usage-cost 実装を PR #339 として維持し、`origin/main` との conflict を解消して PR workflow を継続する。
- 成果物: merge conflict 解消済み branch、検証結果、PR 更新コメント、作業レポート。
- 条件: 実施していない検証を実施済み扱いしない。GitHub Apps を優先し、PR コメントは日本語にする。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | UsageEvent を主データとする usage/cost 実装を main merge 後も維持する | 高 | 対応 |
| R2 | 新しい RAG runtime layout と import 境界に合わせる | 高 | 対応 |
| R3 | admin usage/cost/export の schema、OpenAPI、Web 表示を同期する | 高 | 対応 |
| R4 | API/Web/infra/docs の必要検証を実行し、失敗時は修正する | 高 | 対応 |
| R5 | 未実施の live AWS/CI 検証を未確認として記録する | 高 | 対応 |
| R6 | 章別仕様差分全体の残 task まで完了扱いしない | 高 | 対応 |

## 3. 検討・判断したこと

- `origin/main` 側で RAG runtime layout が変更されていたため、usage tracking helper は `apps/api/src/rag/_shared/usage/` に移し、既存 import 互換の shim を残した。
- admin export route は main 由来の route と PR 由来の route が重複していたため、`POST /admin/audit-log/export` は 1 つに整理した。
- provider usage が発生しない stateless chat でも request 数の監査が必要なため、missing confidence の `rag.chat_request` UsageEvent を記録する方針を採用した。
- `tasks/do/20260516-1625-full-spec-gap-implementation.md` は UsageEvent 以外の章別仕様差分も含むため、今回の PR 更新後も `done` へ移動しない。

## 4. 実施した作業

- `origin/main` を merge し、API / Web / generated docs / infra snapshot の競合を解消した。
- `UsageTrackingTextModel` と pricing catalog を新 RAG layout 配下に移動し、root shim を追加した。
- `MemoRagService` の usage event 記録を新 orchestration entrypoint と統合した。
- `/admin/usage`、`/admin/costs`、admin export 周辺の schema / Web hook / panel / tests / OpenAPI generated docs を同期した。
- OpenAPI と infra snapshot を再生成し、型チェックと test を再実行した。
- task 追記と本レポートを追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| PR #339 | Pull Request | UsageEvent ベースの利用量・コスト監査実装 | R1-R5 |
| `apps/api/src/rag/_shared/usage/` | TypeScript | pricing catalog と usage tracking model | R1-R2 |
| `apps/api/src/routes/admin-routes.ts` | TypeScript | usage/cost/export route 統合 | R1-R3 |
| `apps/web/src/features/admin/` | TypeScript/React | admin usage/cost 表示と export 操作 | R3 |
| `docs/generated/openapi*.md` | Markdown | API 生成ドキュメント | R3 |
| `tasks/do/20260516-1625-full-spec-gap-implementation.md` | Markdown | 進捗メモ 32 | R5-R6 |
| `reports/working/20260601-2142-usage-cost-conflict-resolution.md` | Markdown | 本作業レポート | R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.5/5 | PR #339 の usage/cost 実装維持と conflict 解消は対応。章別仕様差分全体は未完了として扱った。 |
| 制約遵守 | 5/5 | 未実施検証を明示し、task done 移動を避けた。 |
| 成果物品質 | 4.5/5 | API/Web/infra/docs のローカル検証は通過。live AWS smoke は未実施。 |
| 説明責任 | 5/5 | 判断、検証、未確認事項を task と report に記録した。 |
| 検収容易性 | 4.5/5 | PR、task、report、検証コマンドを追跡可能にした。 |

総合fit: 4.7 / 5.0（約94%）

理由: PR #339 の conflict 解消と usage/cost 実装のローカル検証は完了したが、実 AWS smoke と最新 push 後の GitHub Actions CI は未確認のため満点ではない。

## 7. 実行した検証

- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm test -w @memorag-mvp/api`: pass（377 件。sandbox の tsx IPC 制約により `require_escalated` で再実行）
- `npm run test -w @memorag-mvp/web`: pass（35 files / 283 件）
- `npm test -w @memorag-mvp/infra`: pass（24 件）
- `npm run docs:openapi`: pass
- `npm run docs:openapi:check`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
- 最新 push 後の GitHub Actions CI は未確認。
- `tasks/do/20260516-1625-full-spec-gap-implementation.md` は章別仕様差分全体の残作業を含むため、今回の UsageEvent PR 更新だけでは `done` に移動しない。
