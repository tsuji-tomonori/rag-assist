# 章別仕様差分の全量実装

保存先: `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 状態

- do

## タスク種別

- 機能追加

## 背景

`.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md` は `docs/spec/2026-chapter-spec.md` に正本化済みであり、Phase A〜J の実装で多くの基盤は追加済みである。一方、残 scope-out と open question が複数残っているため、PM 指示として全量対応し、実装・検証・PR 作成・確認・merge まで進める。

## 目的

章別仕様の残差分を、既存の認可境界、RAG 根拠性、No Mock Product UI、OpenAPI/docs gate、debug redaction を弱めずに実装する。

## 対象範囲

- OCR/table/figure confidence と RAG eligibility の接続
- ParsedDocument preview API/UI
- ChatToolInvocation の実行・承認・永続監査
- Async agent writeback approval / provider settings / benchmark runner
- REST/oRPC/OpenAPI lifecycle hardening
- debug replay / permission revoked guard / public endpoint edge policy
- admin group / audit/cost export / quality ops
- task, docs, reports, OpenAPI/generated docs, tests

## 含まない範囲

- 本番 deploy / release / bootstrap
- 実 AWS 環境での full benchmark / full reindex / external provider credential rotation 実行
- ユーザー確認なしの破壊的削除、force push、PR close

## 実行計画

1. 現行実装と schema/store/route/UI の責務を確認する。
2. API schema と store foundation を先に拡張する。
3. Web UI は実データ由来の empty/loading/error/permission state を整備し、架空値を出さない。
4. benchmark/debug/OpenAPI/admin の残差分を小さい API/UI 単位で追加する。
5. access-control policy、OpenAPI docs、contract tests、Web tests を同期する。
6. targeted checks から実行し、失敗は修正して再実行する。
7. 作業レポート、commit、push、PR 作成、受け入れ条件コメント、セルフレビュー、PR checks 確認、merge まで行う。

## ドキュメントメンテナンス計画

- `docs/spec/gap-phase-*.md` に実装結果と残 scope を追記する。
- API route/schema 変更時は OpenAPI generated docs を正規コマンドで更新する。
- 運用手順や安全制約が変わる場合は関連 docs を更新する。
- 更新不要な docs は PR 本文と作業レポートで理由を記録する。

## 受け入れ条件

- [ ] OCR/table/figure confidence が通常 RAG evidence selection または quality restriction で参照される。
- [ ] ParsedDocument preview は権限を満たす管理者/文書管理者だけが確認でき、未解析文書は正直な empty state になる。
- [ ] ChatToolInvocation は permission / approval / audit / redaction 境界を持ち、disabled tool は実行可能に見えない。
- [ ] Async agent artifact writeback は full permission と明示承認なしに実行されない。
- [ ] Provider settings は secret value を返さず、未設定 provider は mock 実行しない。
- [ ] Async agent benchmark runner は provider 未設定や artifact redaction を評価できる。
- [ ] API lifecycle / OpenAPI drift gate は代表範囲から拡張され、generated docs は runtime OpenAPI 由来で同期される。
- [ ] Debug replay / permission revoked / public endpoint edge policy の安全境界が実装または docs に明記される。
- [ ] Admin group / quality action / audit-cost export は実データ由来で、固定件数や demo fallback を表示しない。
- [ ] 新規/変更 route は `apps/api/src/security/access-control-policy.test.ts` と OpenAPI docs に反映される。
- [ ] 作業レポート、PR 受け入れ条件コメント、セルフレビューコメントが残っている。

## 検証計画

- `git diff --check`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run test -w @memorag-mvp/api -- <targeted tests>`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run test -w @memorag-mvp/web -- <targeted tests>`
- `npm run typecheck -w @memorag-mvp/benchmark`
- `npm test -w @memorag-mvp/benchmark`
- `npm run docs:openapi:check`
- 必要に応じて `task verify`。ただし実行前に Taskfile の解決内容を確認済みとする。

## PRレビュー観点

- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を本番実装へ入れていないこと。
- No Mock Product UI に反し、未実装値・架空値を表示していないこと。
- Debug / audit / export / provider log で secret や権限外情報を漏らしていないこと。
- OpenAPI / contract / docs / Web 型が同期していること。

## リスク

- 範囲が大きいため、実装中に分割 PR が必要な場合は blocked / partially complete として報告する。
- external provider、実 AWS、WAF/CDN など実環境依存の検証はローカルで完結しない可能性がある。

## 進捗メモ 2026-06-01

- `.workspace/plan-060101.txt` の admin usage/cost 指摘に対し、`UsageEvent` 型、ObjectStore-backed `UsageEventStore`、`UsageTrackingTextModel` を追加した。
- `TextModel.generate()` の互換性を維持しつつ、Bedrock provider usage を callback で取得し、provider usage がない場合は tokenizer/mock estimate、計測不能時は missing として保存する経路を追加した。
- `/admin/usage` は `users` に加えて token totals と `dataCompleteness` を返す contract に更新した。
- `/admin/costs` は chat message 件数ではなく usage event token と `pricingVersion` を使う summary に更新し、missing usage を cost に混ぜない表示にした。
- Web admin usage/cost panel は `0` と「未計測または利用なし」「推定」「一部未計測」を区別する表示へ更新した。
- 既存途中変更で壊れていた `quality.ts` の shared re-export を実体へ戻し、low confidence extraction warning を通常 RAG quality gate の拒否理由に含めた。
- 検証:
  - `npm ci`: pass
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `npm test -w @memorag-mvp/api -- src/rag/usage-tracking-text-model.test.ts src/rag/quality.test.ts`: pass（script 展開により API test 252 件実行）
  - `npm test -w @memorag-mvp/web -- src/features/admin/components/AdminWorkspace.test.tsx src/features/admin/hooks/useAdminData.test.ts src/shared/utils/format.test.ts`: pass
  - `npm test -w @memorag-mvp/web -- src/App.test.tsx`: pass
  - `npm run docs:openapi:check`: fail -> `npm run docs:openapi` 後 pass
  - `git diff --check`: pass
- 未完了:
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
  - DynamoDB 専用 UsageEventStore と embedding usage 計測は未実装。
  - 実 Bedrock provider usage は型上 callback で受け取る実装までで、実 AWS 呼び出しでは未検証。

## 進捗メモ 2026-06-01 追記

- `InMemoryUsageEventStore` と `DynamoDbUsageEventStore` を追加し、`USE_LOCAL_USAGE_EVENT_STORE` / `USAGE_EVENTS_TABLE_NAME` で local ObjectStore と production DynamoDB を切り替える構成にした。
- `UsageTrackingTextModel.embed()` も usage event を保存するようにし、chat/search 経路の embedding token を `feature: "embedding"` として記録できるようにした。
- `/admin/costs` の Bedrock item を chat completion tokens と embedding tokens に分け、embedding cost を usage event 側の `estimatedCostUsd` から集計するようにした。
- `/admin/usage` の `chatMessages` は旧 ledger だけでなく、non-embedding usage event の unique orchestration/session 数からも補完し、チャット後も 0 のままに見える問題を抑止した。
- CDK に `UsageEventsTable` を追加し、API/worker Lambda へ `USAGE_EVENTS_TABLE_NAME` と DynamoDB 権限を渡した。
- `@memorag-mvp/contract` の infra env 型を usage event table env に同期した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `npm test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts src/adapters/usage-event-store.test.ts src/rag/usage-tracking-text-model.test.ts`: pass（script 展開により API test 256 件実行）
  - `npm run typecheck -w @memorag-mvp/infra`: fail（`ApiRuntimeEnv` 型不足）-> contract env 型更新後 pass
  - `UPDATE_SNAPSHOTS=1 npm test -w @memorag-mvp/infra`: pass（snapshot 更新）
  - `npm test -w @memorag-mvp/infra`: pass
  - `npm run typecheck -w @memorag-mvp/contract`: pass
  - `npm run docs:openapi:check`: pass
  - `git diff --check`: pass
- 未完了:
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
  - benchmark / async_agent / debug の usage event 化は未実装。
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。

## 進捗メモ 2026-06-01 追記 2

- chat / async chat run の debug trace 生成時に `feature: "debug"` の UsageEvent を記録し、debug 実行が「未計測」として admin dataCompleteness に残るようにした。
- async agent run の blocked / completed / failed 時に `feature: "async_agent"` の UsageEvent を記録し、provider 側の token usage が未取得でも利用事実を監査できるようにした。
- benchmark run 作成時に `feature: "benchmark"` の UsageEvent を記録し、queued 実行を usage event の一次データへ接続した。
- CostAudit の chat completion tokens と `/admin/usage` の `llmCallCount` / `chatMessages` 補完は LLM/RAG event のみを対象にし、benchmark / debug / async_agent の missing event が LLM token cost や LLM call count に混ざらないようにした。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（46 件）
  - `npm test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts src/rag/usage-tracking-text-model.test.ts src/adapters/usage-event-store.test.ts`: pass（script 展開により API test 256 件実行）
  - `git diff --check`: pass
- 未完了:
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。

## 進捗メモ 2026-06-01 追記 3

- `PricingCatalog` / `ModelPricing` を追加し、`UsageTrackingTextModel` の価格定数直書きを `UsageEvent.pricingVersion` に基づく `calculateUsageEventCost()` へ移した。
- `/admin/usage` と `/admin/costs` の UsageEvent 集計は保存済み `estimatedCostUsd` だけに依存せず、pricingVersion ごとの価格表で再計算するようにした。
- CostAudit の Bedrock item は対象 UsageEvent が複数 pricingVersion の場合に `pricingVersion: "mixed"` を返し、単一 version ならその version を返す。
- UT-COST-001/002/003 相当として、v1/v2 価格表、missing usage の cost 除外、embedding price の単体テストを追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/rag/pricing-catalog.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts apps/api/src/rag/memorag-service.test.ts`: pass（54 件）
  - `npm test -w @memorag-mvp/api -- src/rag/pricing-catalog.test.ts src/rag/usage-tracking-text-model.test.ts src/rag/memorag-service.test.ts src/adapters/usage-event-store.test.ts`: pass（script 展開により API test 260 件実行）
  - `git diff --check`: pass
- 未完了:
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。

## 進捗メモ 2026-06-01 追記 4

- `.workspace/plan-060101.txt` の UT-ADMIN-USAGE-001/002/003 と UT-UI-USAGE-001/002/003 を棚卸しし、未固定だった空 usage contract と UI 表示 contract を補強した。
- `/admin/usage` は UsageEvent や legacy 利用実績がないユーザーのゼロ行を返さず、利用実績がない場合も `users: []`、token totals 0、`dataCompleteness` 0 を返すようにした。
- `api-contract.test.ts` に、UsageEvent 未作成の fresh server で `/admin/usage` が `users: []` と completeness 0 を返す contract test を追加した。既存の permission test により `usage:read:all_users` なしの 403 も継続確認した。
- Admin usage panel の空状態を「未計測または利用なし」に合わせ、Web component test で「推定」「一部未計測」「未計測または利用なし」「CostAudit の missing_usage」を区別して表示することを確認した。
- 検証:
  - `npm test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts src/contract/api-contract.test.ts`: pass（script 展開により API test 261 件実行）
  - `npm test -w @memorag-mvp/web -- src/features/admin/components/AdminWorkspace.test.tsx`: pass（7 件）
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `git diff --check`: pass
- 未完了:
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。

## 進捗メモ 2026-06-01 追記 5

- `.workspace/plan-060101.txt` の実装順 8「export は pricingVersion と dataCompleteness を含める」を再監査し、既存 `createAdminExportDownloadUrl()` はあるが admin route と payload 単体検証が不足していることを確認した。
- `POST /admin/audit-log/export` と `POST /admin/costs/export` を追加し、既存 `AdminExportResponseSchema` を OpenAPI response として公開した。
- `buildAdminExportPayload()` を追加し、cost summary export payload が `CostAuditSummary` を含むことで `pricingVersion` と `dataCompleteness` を保持することを service test で固定した。
- `api-contract.test.ts` の Phase 2 admin permission test に export routes の 403 確認を追加した。
- 新規 export routes の日本語 OpenAPI summary / description を追加し、generated OpenAPI docs を更新した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts src/contract/api-contract.test.ts src/security/access-control-policy.test.ts`: pass（script 展開により API test 261 件実行）
  - `npm run docs:openapi:check`: fail（新規 export routes の docs 未生成）-> `npm run docs:openapi` 後 pass
  - `git diff --check`: pass
- 未完了:
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。

## 進捗メモ 2026-06-01 追記 6

- `.workspace/plan-060101.txt` の UT-CHAT-USAGE-001/002/003 を再監査し、`UsageTrackingTextModel` 単体では feature mapping と putOnce dedupe を確認済みだったが、chat orchestration 経由の直接証拠が弱いことを確認した。
- `executeChatRun()` の service test に、completed chat run が `rag.query_rewrite`、`rag.answerability`、`rag.generate_answer`、`rag.support_verification` の UsageEvent を保存することを追加した。
- 同じ chat run を再実行した場合も、保存済み LLM UsageEvent の idempotencyKey が重複しないことを確認する assertion を追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: fail（再実行で別 LLM step が追加され event 数比較が過剰に厳しい）-> idempotencyKey 重複なし確認へ修正後 pass（46 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 7

- `.workspace/plan-060101.txt` の UT-ADMIN-USAGE-002 を再監査し、service-level では UsageEvent 合算を確認済みだったが、HTTP route / OpenAPI schema 経由での token 合算 contract が弱いことを確認した。
- `api-contract.test.ts` の major endpoint contract に、`/chat` と `/chat-runs` 実行後の `/admin/usage` が `local-dev` の token usage、`llmCallCount >= 2`、`totals.totalTokens = inputTokens + outputTokens`、completeness の actual/estimated event を返すことを追加した。
- 誤って repo root から `./node_modules/.bin/tsx --test apps/api/src/contract/api-contract.test.ts` を直接実行し、test 内の `process.cwd()` 前提とずれて fixture / child tsx 解決で失敗した。正規の workspace script 経由で再実行し pass を確認した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`: pass（script 展開により API test 261 件実行）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 8

- `.workspace/plan-060101.txt` の「/admin/costs を UsageEvent + ModelPricing 集計へ差し替える」方針を再監査し、HTTP contract は schema validation と currency 確認のみで、`pricingVersion` / `dataCompleteness` / token usage が response まで届く証跡が弱いことを確認した。
- `api-contract.test.ts` の major endpoint contract に、`/admin/costs` が `Bedrock / chat completion tokens` item を返し、`usage > 0`、`estimatedCostUsd > 0`、`pricingVersion` を持ち、`dataCompleteness` が `/admin/usage` と一致することを追加した。
- 途中で `CostAuditItem` の数量フィールドを `usageQuantity` と誤認して test が失敗したため、既存 schema の `usage` フィールドへ修正して再実行した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`: fail（`usageQuantity` 誤参照）-> `usage` へ修正後 pass（script 展開により API test 261 件実行）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 9

- `.workspace/plan-060101.txt` の UT-USAGE-002 を再監査し、provider usage がない場合に `tokenizer_estimate` になることの assertion が `tokenizer_estimate|mock_estimate` と緩く、非 mock 実行時の契約として弱いことを確認した。
- `usage-tracking-text-model.test.ts` の generate 推定 test を `tokenSource: "tokenizer_estimate"` 固定にした。
- embedding でも provider usage がない場合に input token を tokenizer 推定し、`totalTokens = inputTokens`、`usageConfidence: "estimated"` になる test を追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（5 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 10

- `.workspace/plan-060101.txt` の Cost / PricingCatalog 方針を再監査し、`UsageEvent` には `cacheReadTokens` / `cacheWriteTokens` があるが、pricing test は input/output と embedding のみで cache token cost の証跡が弱いことを確認した。
- `pricing-catalog.test.ts` に cache read / cache write 単価を持つ `v-cache` pricing を追加し、input / output / cache read / cache write token の合算 cost を確認する test を追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/rag/pricing-catalog.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（10 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 11

- `.workspace/plan-060101.txt` の UsageEvent 型には `status: "failed"` と `errorCode` があるが、`UsageTrackingTextModel` では provider が throw した generate / embed 呼び出しが UsageEvent として残らないことを確認した。
- `UsageTrackingTextModel` の generate / embed を try/catch 化し、失敗時も token 推定、`status: "failed"`、`errorCode`、idempotencyKey を持つ UsageEvent を `putOnce` してから元 error を再 throw するようにした。
- `usage-tracking-text-model.test.ts` に、failed generate と failed embedding がそれぞれ UsageEvent を保存し、呼び出し元には元 error が伝播する test を追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/rag/usage-tracking-text-model.test.ts apps/api/src/rag/pricing-catalog.test.ts`: pass（11 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 12

- `.workspace/plan-060101.txt` の UsageEvent token 内訳方針を再監査し、`UsageTrackingTextModel` は `cacheReadTokens` / `cacheWriteTokens` を保存する実装だが unit test では保存 contract が固定されていなかった。
- `usage-tracking-text-model.test.ts` の fake provider usage 型を `TextModelTokenUsage` に揃え、provider usage が cache read / cache write token を返した場合に UsageEvent へ保存され、`totalTokens` に含まれることを確認する test を追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/rag/usage-tracking-text-model.test.ts apps/api/src/rag/pricing-catalog.test.ts`: pass（12 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 13

- semantic embedding usage の呼び出し経路を再監査し、chat / async chat は `depsWithUsageTracking` を通る一方、`MemoragService.search()` は `searchRag(this.deps, ...)` を直接呼び、通常検索の query embedding が UsageEvent に残らないことを確認した。
- `MemoragService.search()` で検索リクエストごとの `search:<uuid>` run id を払い出し、usage tracking 付き deps を `searchRag` に渡すようにした。同一ユーザー・同一検索語の複数回検索でも idempotency key が衝突しないよう、`depsWithUsageTracking` は任意の `orchestrationRunId` を受けられる形にした。
- `memorag-service.test.ts` に、semantic search を 2 回実行した場合に user の embedding UsageEvent が 2 件保存され、`orchestrationRunId` が `search:` prefix を持ち、`totalTokens = inputTokens` になる contract を追加した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（47 件）
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 14

- `.workspace/plan-060101.txt` の `/admin/usage` response 方針を再監査し、`users` / `totals` / `dataCompleteness` は実装済みだったが、明示されている `periodStart` / `periodEnd` が UsageSummary API schema と HTTP contract に含まれていないことを確認した。
- `/admin/usage` が当月 UTC 月初の `periodStart` と response 生成時刻の `periodEnd` を返すようにし、`UsageSummaryListResponseSchema` と OpenAPI generated docs に反映した。
- `api-contract.test.ts` に、通常 usage response と empty usage response の両方で `periodStart` / `periodEnd` が返り、OpenAPI schema validation を通ることを追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`: pass（script 展開により API test 266 件実行）
  - `npm run docs:openapi`: pass
  - `npm run docs:openapi:check`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 15

- `.workspace/plan-060101.txt` の「Bedrock / provider が返した実 token usage を優先する」方針を再監査し、Bedrock adapter は `onUsage` へ usage を渡していたが、実 AWS を使わない adapter-level contract test が不足していた。
- `BedrockTextModel` に Bedrock runtime client のテスト注入点を追加し、production 既定は従来通り `BedrockRuntimeClient` を生成する形を維持した。
- `bedrock.test.ts` を追加し、embedding の `inputTextTokenCount` と Converse の `response.usage.inputTokens/outputTokens` が `onUsage` に渡ることを固定した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/adapters/bedrock.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（9 件）
  - `npm run typecheck -w @memorag-mvp/api`: fail（test fake client の暗黙 any）-> 型注釈追加後 pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 16

- sync chat の UsageEvent idempotency context を再監査し、conversation id がない stateless chat では `UsageTrackingTextModel` の fallback が `userId` になり、同一ユーザー・同一質問の別リクエストが重複排除され得ることを確認した。
- `MemoRagService.chat()` で、conversation がある場合は `conversationId:turn:<turnId|uuid>`、conversation がない場合は `chat:<uuid>` を `orchestrationRunId` として払い出し、同一質問の別リクエストを別 usage event として保存できるようにした。
- `memorag-service.test.ts` に、同じ stateless chat を 2 回実行しても RAG UsageEvent が増え、全 event の idempotencyKey が一意であることを確認する test を追加した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（48 件）
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 17

- `.workspace/plan-060101.txt` の embedding usage 方針に対し、chat/search 以外の embedding 呼び出し経路を再監査し、user 起点の非同期 document ingest が `createdBy` を持つ一方で `this.ingest()` は base deps のまま実行され、chunk embedding が UsageEvent に残らないことを確認した。
- `MemoRagService.ingest()` が内部向けに deps を受け取れるようにし、非同期 document ingest run では `depsWithUsageTracking()` に `ingestRunId` を渡して chunk embedding を `feature: "embedding"` / `ingestRunId` 付き UsageEvent として記録するようにした。
- `UsageTrackingTextModel` の context に `ingestRunId` / `toolInvocationId` を追加し、generate / embed の UsageEvent に反映されるようにした。
- `memorag-service.test.ts` の非同期 document ingest run test に、完了後に userId / orchestrationRunId / ingestRunId を持つ embedding UsageEvent が保存される assertion を追加した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（55 件）
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 18

- `.workspace/plan-060101.txt` の UI 用 contract を再監査し、API は `/admin/usage` で `periodStart` / `periodEnd` / `totals` / `dataCompleteness` を返すようになっていたが、Web の `usageApi` / `useAdminData` / `AdminUsagePanel` は `users` だけを保持し、集計期間・合計 token・合計 cost・全体の計測状態を捨てていた。
- Web 側に `UsageSummaryResponse` 型と `getUsageSummary()` を追加し、`useAdminData` で response 全体を保持して `AdminWorkspace` / `AdminUsagePanel` へ渡すようにした。
- `AdminUsagePanel` に集計期間、total tokens、estimatedCostUsd、全体の actual/estimated/missing 状態を表示する summary line を追加した。user 行の推定・未計測・利用なし表示は維持した。
- `AdminWorkspace.test.tsx` と `useAdminData.test.ts` を更新し、usage response 全体を保持・表示すること、推定・未計測・利用なしの区別が続くことを確認した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx`: fail（summary と user row の同一「一部未計測 1」表示に対する単一 query）-> 複数表示 assertion へ修正後 pass（17 件）
  - `npm run test -w @memorag-mvp/web -- src/app/hooks/useAppShellState.test.ts src/App.test.tsx`: pass（45 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 19

- `.workspace/plan-060101.txt` の「機能別・モデル別・ユーザー別・グループ別に集計」方針を再監査し、`/admin/usage` はユーザー別と totals のみで、feature / model / group breakdown を API contract と OpenAPI schema に返していないことを確認した。
- `UsageSummaryBreakdown` / `UsageSummaryBreakdowns` を追加し、`UsageEvent` を feature / model / user group の 3 軸で集約して token、estimatedCostUsd、actual/estimated/missing event count を返す `getUsageSummaryBreakdowns()` を追加した。
- `/admin/usage` response に `breakdowns.byFeature` / `byModel` / `byGroup` を追加し、OpenAPI schema と generated docs に反映した。group breakdown はユーザー所属 group への attribution とし、複数 group 所属時は各 group に同一 event を帰属させ、totals とは別の内訳として扱う。
- `api-contract.test.ts` に、通常 usage response で feature / model / group breakdown が schema validation を通り、empty usage response では各 breakdown が空配列になることを追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm run docs:openapi`: pass
  - `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`（`apps/api` cwd）: pass（16 件）
  - `npm run docs:openapi:check`: pass
  - `git diff --check`: pass
  - `npm test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`: fail（workspace test script が全 API test を実行し、追加 assertion の初版 `feature === "chat"` 固定で 1 件失敗）-> assertion を `chat` または `rag.*` に修正し、上記 direct contract test で pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 20

- 追記 19 で API contract に追加した `breakdowns.byFeature` / `byModel` / `byGroup` を Web 管理 UI がまだ表示していないことを確認した。
- Web の `UsageSummaryResponse` に `UsageSummaryBreakdown` を追加し、`AdminUsagePanel` で機能別・モデル別・グループ別の上位 5 件を tokens / estimatedCostUsd / 計測状態つきで表示するようにした。
- `AdminWorkspace.test.tsx` / `useAdminData.test.ts` / `App.test.tsx` の usage response fixture を新 contract に合わせ、Usage / Cost タブで breakdown の各軸が表示されることを追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx`: fail（breakdown 追加で `推定 2` / `1,500 tokens` / `$0.0017` が複数表示になったため単一 query が失敗）-> 複数表示 assertion へ修正後 pass（17 件）
  - `npm run test -w @memorag-mvp/web -- src/app/hooks/useAppShellState.test.ts src/App.test.tsx`: pass（45 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 21

- `.workspace/plan-060101.txt` の「内部 LLM 呼び出し単位で残す」方針を再監査し、`TextModel.generate()` の `usageTask` には `retrievalJudge` / `memoryCard` がある一方、`UsageTrackingTextModel` の feature 写像では default `chat` に落ちていたことを確認した。
- `UsageEventFeature` に `rag.retrieval_judge` / `rag.memory_card` を追加し、retrieval judge と memory card generation を機能別 breakdown で `chat` から分離できるようにした。
- `usage-tracking-text-model.test.ts` に、`retrievalJudge` と `memoryCard` が明示的な `rag.*` feature として保存される assertion を追加した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（8 件）
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 S3 への admin export 保存と署名付き URL の動作は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 22

- `.workspace/plan-060101.txt` の「export は集計値だけでなく pricingVersion と dataCompleteness を含める」方針に対し、API は `/admin/audit-log/export` と `/admin/costs/export` を提供している一方、Web の `AdminAuditPanel` は「export は未提供」と表示し、Cost/Audit export 操作も持っていないことを確認した。
- Web に `AdminExportArtifact` 型、`createAdminAuditLogExport()`、`createCostSummaryExport()`、signed URL download helper を追加した。
- `useAdminData` に `onExportAdminAuditLog()` / `onExportCostSummary()` を追加し、`AdminAuditPanel` と `AdminCostPanel` に download icon button を追加した。Audit panel の未提供文言から export を外し、実装状態と表示を合わせた。
- `AdminWorkspace.test.tsx` / `useAdminData.test.ts` に、権限がある場合だけ export download が開始され、UI ボタンが handler を呼ぶ assertion を追加した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx src/shared/utils/downloads.test.ts`: pass（24 件）
  - `npm run test -w @memorag-mvp/web -- src/app/hooks/useAppShellState.test.ts src/App.test.tsx`: pass（45 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 23

- `.workspace/plan-060101.txt` の「月次コスト」方針を再監査し、`/admin/usage` と `/admin/costs` は当月 `periodStart` / `periodEnd` を返す一方、service 集計は `UsageEventStore.list()` の全期間 event を集計しており、過去月 token/cost が当月表示に混ざることを確認した。
- `currentUsageSummaryPeriod()` と period filter を追加し、`listUsageSummaries()` / `getUsageSummaryTotals()` / `getUsageSummaryBreakdowns()` / `getCostAuditSummary()` が当月 period 内の UsageEvent だけを集計するようにした。
- legacy `db.usage` counters は `lastActivityAt` が当月 period 内の場合だけ user summary に反映し、期間外の旧集計値が月次 usage に混ざらないようにした。
- `memorag-service.test.ts` に、当月 event と前月 event が同一 user にある場合でも、user summary / feature breakdown / cost item は当月 event だけを集計する assertion を追加した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（48 件）
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`（`apps/api` cwd）: pass（16 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 24

- `.workspace/plan-060101.txt` の `UsageSummaryResponse` 例にある `chatRequestCount` が、API schema / service response / Web 型と表示では未提供で、`chatMessages` のみ表示していたことを確認した。
- `UserUsageSummary` と OpenAPI schema に `chatRequestCount` を追加し、UsageEvent ベースの月次集計では chat request 件数として `event.chatMessages` を反映するようにした。
- legacy admin ledger の初期 usage に `chatRequestCount: 0` を追加し、Web 管理 UI の Usage table は「チャット」を request count で表示するようにした。
- API contract / service test / Web fixture を新 field に追従し、OpenAPI generated docs を再生成した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（56 件）
  - `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`（`apps/api` cwd）: pass（16 件）
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx src/app/hooks/useAppShellState.test.ts src/App.test.tsx`: pass（65 件）
  - `npm run docs:openapi`: pass
  - `npm run docs:openapi:check`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 25

- `.workspace/plan-060101.txt` の `UsageEvent.cacheReadTokens` / `cacheWriteTokens` 方針に対し、`UsageTrackingTextModel` と pricing catalog は cache token を扱える一方、`BedrockTextModel.generate()` が Converse usage の `cacheReadInputTokens` / `cacheWriteInputTokens` を `TextModelTokenUsage` に渡していないことを確認した。
- AWS SDK のローカル型定義で Converse usage に `cacheReadInputTokens` / `cacheWriteInputTokens` が存在することを確認し、Bedrock adapter で `cacheReadTokens` / `cacheWriteTokens` として転送するようにした。
- `bedrock.test.ts` の Converse usage fixture に cache token を追加し、provider usage callback が input/output/cache read/cache write をまとめて返すことを検証した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/adapters/bedrock.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts apps/api/src/rag/pricing-catalog.test.ts`: pass（15 件）
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 26

- `.workspace/plan-060101.txt` の「価格改定後に過去イベントの金額が勝手に変わらない」方針を再監査し、`calculateUsageEventCost()` は価格表が見つからない場合だけ保存済み `estimatedCostUsd` を返し、同一 `pricingVersion` の catalog 定義が変わった場合は再計算され得ることを確認した。
- `usageConfidence=missing` は引き続き cost から除外しつつ、保存済み `estimatedCostUsd` が有限 number として存在する UsageEvent では保存時金額を優先するようにした。
- `pricing-catalog.test.ts` に、保存済み `estimatedCostUsd` が pricing catalog の再計算値より優先される assertion を追加した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/rag/pricing-catalog.test.ts apps/api/src/rag/memorag-service.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（62 件）
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 27

- `.workspace/plan-060101.txt` の export / cost audit 方針では `pricingVersion` を含めることが求められる一方、`recordUsageEvent()` が作る benchmark / debug / async_agent などの非 token UsageEvent には `pricingVersion` が入っていないことを確認した。
- `recordUsageEvent()` で作る missing usage event にも `defaultPricingVersion` を保存し、非 token event でも監査時にどの pricing catalog 前提で記録されたかを追跡できるようにした。
- async agent 成功イベントと benchmark queued イベントの test に `pricingVersion` assertion を追加した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/rag/pricing-catalog.test.ts`: pass（54 件）
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 28

- `.workspace/plan-060101.txt` の「export は集計値だけでなく pricingVersion と dataCompleteness を含める」方針を再監査し、`CostAuditItem.pricingVersion` はある一方、`CostAuditSummary` 自体には top-level `pricingVersion` がないことを確認した。
- `CostAuditSummary` / Zod schema / Web 型に `pricingVersion` を追加し、`getCostAuditSummary()` は当月 UsageEvent 全体の pricing version を `pricingVersionForEvents()` で集約し、event がない場合は `defaultPricingVersion` を返すようにした。
- Web の Cost panel に top-level pricing version を表示し、API contract / Web fixture / OpenAPI generated docs を更新した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（48 件）
  - `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`（`apps/api` cwd）: pass（16 件）
  - `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx src/App.test.tsx`: pass（61 件）
  - `npm run docs:openapi`: pass
  - `npm run docs:openapi:check`: pass
  - `git diff --check`: pass
  - 失敗後再実行済み: `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/contract/api-contract.test.ts` は root cwd から contract test を実行したため fixture path / tsx spawn 解決に失敗。`apps/api` cwd の direct contract test で pass。
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 29

- 追記 28 で追加した `CostAuditSummary.pricingVersion` が、export payload と Web 表示の test ではまだ明示的に固定されていないことを確認した。
- `buildAdminExportPayload(..., "cost_summary")` の service test に、`costSummary.pricingVersion` が当月 UsageEvent の `v1` を保持する assertion を追加した。
- Web の `AdminWorkspace.test.tsx` に、Cost panel が `version: bedrock-2026-06-local-v1` を表示する assertion を追加した。
- 検証:
  - `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（48 件）
  - `npm run test -w @memorag-mvp/web -- src/features/admin/components/AdminWorkspace.test.tsx`: pass（8 件）
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 30

- `.workspace/plan-060101.txt` の usage/cost 実装に対し、current dirty tree 全体の広めの検証を実施した。
- API / Web / contract / infra の typecheck、API 全 test、Web 全 test、infra test、OpenAPI drift check、`git diff --check` がすべて pass した。
- これにより、UsageEvent / PricingCatalog / admin usage-cost API / Web admin UI / infra contract / generated OpenAPI の同期が、ローカル検証可能な範囲では成立していることを確認した。
- 検証:
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `npm run typecheck -w @memorag-mvp/web`: pass
  - `npm run typecheck -w @memorag-mvp/contract`: pass
  - `npm run typecheck -w @memorag-mvp/infra`: pass
  - `npm test -w @memorag-mvp/api`: pass（271 件）
  - `npm run test -w @memorag-mvp/web`: pass（34 files / 243 件）
  - `npm test -w @memorag-mvp/infra`: pass（17 件）
  - `npm run docs:openapi:check`: pass
  - `git diff --check`: pass
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。

## 進捗メモ 2026-06-01 追記 31

- 既存 dirty worktree を保持したまま `codex/usage-cost-events` branch を作成し、UsageEvent / cost audit / admin UI / infra / docs / task-report 差分を commit した。
- branch を `origin/codex/usage-cost-events` へ push し、PR #339 `UsageEventベースの利用量コスト監査を追加` を作成した。
- GitHub Apps で PR top-level comment として、受け入れ条件確認コメントとセルフレビューコメントを投稿した。
- 受け入れ条件コメントでは、`.workspace/plan-060101.txt` の usage/cost 関連はローカル検証可能な範囲で満たした一方、実 AWS Bedrock/DynamoDB/S3 検証と章別仕様差分全体は未検証/未達として明記した。
- 検証:
  - commit hook: pass（`git-secrets`, trailing whitespace, EOF fixer, large file check, merge conflict check, mixed line ending）
  - `git push -u origin codex/usage-cost-events`: pass
  - PR 作成: pass（https://github.com/tsuji-tomonori/rag-assist/pull/339）
  - PR 受け入れ条件コメント: posted
  - PR セルフレビューコメント: posted
- 未完了:
  - 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
  - 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
  - ParsedDocument preview、ChatToolInvocation execution、Async agent writeback/provider settings/benchmark runner など、章別仕様差分全体の残 task は未完了。
  - 未達/未検証条件が残るため、この task md は `tasks/done/` に移動していない。
