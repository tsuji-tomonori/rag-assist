# PR94 local stream fixes 作業完了レポート

## 受けた指示

- PR #94 の最新レビュー指摘を受け、merge 前にローカル開発のチャット UI 破損リスクを修正する。
- 追加指摘の debug trace サイズ、network disconnect retry、StartExecution 失敗、API Gateway authorizer 由来 CORS も可能な範囲で対応する。
- 変更後に検証し、commit と PR 更新まで進める。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | Hono local API に `GET /chat-runs/{runId}/events` SSE route を追加する | 対応 |
| R2 | run owner または `chat:admin:read_all` の購読境界を維持する | 対応 |
| R3 | network disconnect 時も `Last-Event-ID` で retry する | 対応 |
| R4 | `StartExecution` 失敗時に queued run を failed/error にする | 対応 |
| R5 | full debug trace を ChatRun/Event item に保存しない | 対応 |
| R6 | authorizer 由来 4xx/5xx の CORS を安定させる | 対応 |
| R7 | 関連 docs と tests を更新する | 対応 |

## 検討・判断

- local dev の互換性を優先し、Web を `/chat` fallback に戻さず、Hono 側に同じ SSE contract の route を追加した。
- SSE 購読は `chat:read:own` を route-level permission とし、そのうえで run owner または `chat:admin:read_all` を確認する方針にした。
- debug trace は既存 object store に永続化されるため、非同期 run の final payload と ChatRun item は `debugRunId` 参照だけにして DynamoDB 400KB item limit のリスクを下げた。
- API Gateway Cognito authorizer が Lambda 到達前に返す 4xx/5xx には handler CORS が効かないため、CDK の GatewayResponse で CORS header を付与した。

## 実施作業

- `apps/api/src/app.ts` に local SSE route を追加し、`Last-Event-ID`、heartbeat、timeout、final/error close を実装した。
- `apps/api/src/rag/memorag-service.ts` で `StartExecution` 失敗時に `markChatRunFailed()` を呼び、debug trace は `debugRunId` 参照保存に変更した。
- `apps/web/src/features/chat/hooks/useChatSession.ts` で timeout だけでなく stream/network error 時の retry を追加し、`debugRunId` から debug trace を取得するようにした。
- `infra/lib/memorag-mvp-stack.ts` に REST API `DEFAULT_4XX` / `DEFAULT_5XX` GatewayResponse CORS を追加した。
- API/Web/Infra tests、OpenAPI access-control static test、CDK snapshot、API docs/examples を更新した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/app.ts` | local dev 用 SSE route と `Last-Event-ID` CORS header |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | StartExecution failure marker、debug trace 参照化 |
| `memorag-bedrock-mvp/apps/web/src/features/chat/hooks/useChatSession.ts` | stream disconnect retry、`debugRunId` trace fetch |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | GatewayResponse CORS |
| `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md` | SSE/local/dev/debug/CORS 設計追記 |
| `memorag-bedrock-mvp/docs/API_EXAMPLES.md` | `debugRunId` 参照の説明追記 |

## 検証

| コマンド | 結果 | 補足 |
|---|---|---|
| `npm --prefix memorag-bedrock-mvp/apps/api run typecheck` | pass | API 型検証 |
| `npm --prefix memorag-bedrock-mvp/apps/api run test` | pass | 76 tests |
| `npm --prefix memorag-bedrock-mvp/apps/api run build` | pass | API build |
| `npm --prefix memorag-bedrock-mvp/apps/web run typecheck` | pass | Web 型検証 |
| `npm --prefix memorag-bedrock-mvp/apps/web run test` | pass | 13 files / 87 tests |
| `npm --prefix memorag-bedrock-mvp/apps/web run build` | pass | Vite production build |
| `npm --prefix memorag-bedrock-mvp/infra run typecheck` | pass | Infra 型検証 |
| `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp/infra test` | pass | CDK snapshot 更新 |
| `npm --prefix memorag-bedrock-mvp/infra test` | pass | 6 tests |
| `npm --prefix memorag-bedrock-mvp run lint` | pass | ESLint |
| `git diff --check` | pass | whitespace check |
| `rg -n "<<<<<<<|=======|>>>>>>>" memorag-bedrock-mvp .github skills --glob '!reports/**'` | pass | conflict marker なし |

`task docs:check:changed` はこの worktree の Taskfile に存在しなかったため実行不可。代替として docs を含む `git diff --check` と lint/build/test を実行した。

## Fit 評価

総合fit: 4.8 / 5.0（約96%）

レビュー指摘の High/Medium/Low はコード、IaC、docs、tests まで反映した。実 AWS deploy と実ブラウザ streaming 疎通は環境依存のため未実施であり、merge 前または dev deploy 後の smoke test として残る。

## 未対応・制約・リスク

- 実 AWS dev deploy 後の CloudFront UI からの SSE 疎通確認は未実施。
- worker Lambda の実 timeout/OOM を AWS 上で発生させた end-to-end 確認は未実施。
- local SSE route は contract test で `POST /chat-runs` から `GET /events` まで確認したが、実ブラウザ操作は未実施。
