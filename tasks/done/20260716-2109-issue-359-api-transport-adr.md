# Issue #359 Phase 3c API transport ADR

保存先: `tasks/done/20260716-2109-issue-359-api-transport-adr.md`

状態: done

タスク種別: ドキュメント更新

## 背景・目的

Web、API、benchmark に REST helper、oRPC contract、SSE、OpenAPI が併存している一方、どの transport をどの境界で正規とするか、将来 migration の順序・rollback・guard が正規 ADR に固定されていない。実ソースを棚卸しし、「chat以外REST」「oRPC維持」「境界別併存」の3案を比較して、公開挙動やコードを変更せずに architecture decision を確定する。

## RCA / 問題構造

- `confirmed`: Web の汎用 API client は `apps/web/src/shared/api/http.ts` の `fetch` wrapper で、JSON、text、blob、DELETE body、Bearer token、非2xx error を扱う。
- `confirmed`: `packages/contract/src/router.ts` の oRPC contract は health、chat、chat-runs、benchmark query/search の5 operationだけを定義し、API全routeを覆わない。
- `confirmed`: API本体は `apps/api/src/routes/*-routes.ts` の OpenAPIHono route群で、chat run events と document ingest events は `text/event-stream` を使う。
- `confirmed`: OpenAPI runtime documentとgenerated docs、benchmark release auditが公開contract driftの検証境界として存在する。
- `inferred`: oRPC導入時の限定scopeと、その後拡張されたREST/OpenAPI route群の間で、transportの長期方針が暗黙化した。
- `conflict`: end-to-end type contractを広げたい動機と、SSE/blob/text/DELETE body、認証・error normalization、Lambda/worker bundle境界を単一transportへ寄せる移行コストが衝突する。
- `open_question`: oRPCをAPI全面へ拡張する投資対効果、SSEのtyped streaming対応、既存OpenAPI利用者の移行期限は確定していない。ADRでは未確定を将来decision gateとして残す。
- 根本課題: transportごとの責任境界、contract source、migration gate、rollback単位が正規architecture decisionとして未定義である。

## 初期参照 inventory

| 観点 | 主な実ソース |
| --- | --- |
| Web REST helper | `apps/web/src/shared/api/http.ts`、各feature API module |
| Web oRPC | `apps/web/src/shared/api/orpc.ts` |
| oRPC contract/server | `packages/contract/src/router.ts`、`apps/api/src/orpc/router.ts` |
| API REST/OpenAPI routes | `apps/api/src/app.ts`、`apps/api/src/routes/api-routes.ts`、`apps/api/src/routes/*-routes.ts` |
| SSE/streaming | `apps/api/src/routes/chat-routes.ts`、`apps/api/src/routes/document-routes.ts`、`apps/api/src/chat-run-events-stream.ts` |
| OpenAPI | `apps/api/src/generate-openapi-docs.ts`、`apps/api/src/validate-openapi-docs.ts`、`docs/generated/openapi*` |
| 認証・error | `apps/web/src/shared/api/http.ts`、API middleware/error handler、route schemas |
| benchmark/release audit | `benchmark/release-audit.ts`、`benchmark/release-audit.test.ts`、benchmark API clients |
| bundle/workers | workspace `package.json`、API Lambda/worker entrypoints、infra bundling definitions |
| 既存architecture | `ARC_ADR_005.md`、`DES_API_001.md`、`DES_API_002.md`、関連FR/TC |

## 作業前チェックリスト

- [x] 指定base `origin/main` (`e12abb07`) から専用worktree/branchを作成した。
- [x] task種別、RCA、初期参照inventory、受け入れ条件、Done条件をmain deliverable編集前に記録した。
- [x] Web/API/benchmark、認証、error、contract、test、bundle、routes/workersを実ソースから棚卸しする。
- [x] 3候補を同一評価軸で比較し、confirmed/inferred/conflict/open_questionを区別する。
- [x] PR #338 changed pathsと禁止scopeの非変更を確認する。

## 実行計画

1. transport consumer/provider、schema source、auth/error/stream/test/bundle境界を棚卸しする。
2. 「chat以外REST」「oRPC維持」「境界別併存」を互換性、型安全、streaming、運用、移行可能性、bundle、testabilityで比較する。
3. `ARC_ADR_006.md` にdecision、consequences、migration順序、rollback、guard、validation gateを記録する。
4. 最小docs検証を実行し、root CIは挙動・契約・コード非変更というdiffに対する必要性をselectorで判断して理由を記録する。
5. report、commit、push、draft PR、受け入れ条件コメント、セルフレビュー、task done移動まで実施する。

## 予定成果物

- `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_006.md`
- `reports/working/20260716-*-issue-359-api-transport-adr.md`
- 本task md（完了時に `tasks/done/` へ移動）

## 受け入れ条件

- [x] REST helper、oRPC、SSE、OpenAPI、認証、error normalization、type contract、testability、bundle依存、routes/workersの現状が実ソース根拠付きで記録される。
- [x] 3候補を比較し、1案を根拠付きでADRのAccepted decisionとして選ぶ。
- [x] `confirmed`、`inferred`、`conflict`、`open_question`を区別し、未確定事項を決定済みにしない。
- [x] 将来migrationの境界、順序、rollback、guard、検証gateを定義する。
- [x] 現在の挙動、公開contract、code、generated docs/historyを変更しない。
- [x] benchmark paths/release-audit、FR-089/CORS、Web shim/UI、PR #338 changed pathsを尊重し、一括変更を行わない。
- [x] 選定した最小docs検証が成功し、root CIの実施/省略判断と残余riskが記録される。
- [x] 日本語draft PR、受け入れ条件コメント、セルフレビュー、task done移動、作業レポートが完了する。

## Done条件

- [x] 全受け入れ条件を満たす。
- [x] ADRと作業レポートのpath・参照・状態・Markdownが検証済みである。
- [x] stage対象を確認し、日本語gitmoji commitをpushする。
- [x] PR lifecycleとPR更新後セルフレビューを完了する。
- [x] 未実施検証と未確定事項を明示し、未解決failureを残さない。

## 検証計画

- `git diff --check`
- ADR/task/reportのpath、metadata、参照path、Mermaid、禁止scope差分のtargeted inspection
- `pre-commit run --files <changed Markdown>`
- Taskfileの実体確認後、`task docs:check`
- root `npm run ci`: selectorでdiff影響を評価。docs-onlyでcode/generated/public contract非変更なら省略し、理由と残余riskを記録する。

## ドキュメントメンテナンス計画

architecture decisionはSWEBOK-liteの `ARC_ADR` に1ファイルで追加する。既存要件、API contract、generated OpenAPI、README、運用手順は挙動を変更しないため直接更新しない。参照のみ行い、矛盾が見つかった場合はADRで`conflict`または`open_question`として明示する。

## PRレビュー観点

- inventoryが実ソースと一致し、全APIをoRPC化済みと誤認させないこと。
- SSE/blob/text/auth/error/OpenAPI/worker境界を単一transportで隠蔽しないこと。
- migrationが認可、CORS、RAG根拠性、benchmark release auditを弱めないこと。
- benchmark固有値、UI shim、FR-089、PR #338、generated履歴へscope creepしていないこと。

## リスク

- route数やconsumer数はbase時点のsnapshotであり、将来変化する。ADRでは固定件数より責任境界とgateを正規化する。
- oRPC/OpenAPIの二重schemaはdrift riskがあるが、本PRではcode generationやcontract統合を実装しない。
- migrationの期限と全面移行可否は未確定であり、decision gateを満たすまで既存境界を維持する。

## 調査・決定結果

- base時点でOpenAPIHono routeは95 operation、oRPC contractは5 procedure、WebのREST helper参照は19 production module、WebのoRPC production consumerはchat APIであることを確認した。
- benchmark query/searchはoRPC、seed/artifact/agent pathはRESTであり、`release-audit` はruntimeとbenchmark固有pathの分離を検査する。
- API main Lambda、chat/ingest stream Lambda、各workerは別entrypointでbundleされ、worker contractはHTTP transportではなくrun/event/artifactである。
- PR #338 changed pathsはchat orchestration、chat Web/API、contract chat schema、`DES_API_001.md`、generated OpenAPI/Web inventory等であり、本PRでは変更しない。
- ADRの決定は「境界別併存」。公開REST/OpenAPI、選択済みJSON unaryのoRPC、SSE/blob/text/upload、worker eventを別責任境界として維持する。
- 全面移行時期、oRPC streaming、external consumer期限は `open_question` とし、operation単位のdecision gateを満たすまで決定しない。

## 検証選定結果

- docs-onlyでcode、公開contract、generated docs、package lockを変更しないため、root `npm run ci` はselectorにより省略する。残余riskはADR記述のsource interpretationであり、`task docs:check`、pre-commit、path/diff inspectionで直接検証する。
- `scripts/validate_docs.py`: pass。
- `task docs:check`: pass（OpenAPI、API code docs、Web trace/inventory、infra inventory、hidden Unicodeを含む）。

## PR lifecycle結果

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/371
- 受け入れ条件確認: https://github.com/tsuji-tomonori/rag-assist/pull/371#issuecomment-4991779015
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/371#issuecomment-4991784752
- Label: `semver:patch`
- GitHub AppsでPR作成・label・受け入れコメントを実施。受け入れコメントは60秒超で中断後に投稿成功を確認し、以降は`gh` fallbackを使用した。
