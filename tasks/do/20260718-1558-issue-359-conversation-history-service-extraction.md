# Issue #359 Phase 4p: conversation history service 抽出

- 状態: do
- Issue: #359
- stacked base: PR #387 / `codex/issue-359-rag-integration`
- exact base: `9a215ac08e5788c9dbb74b48e94b2243c85f609d`

## 目的・スコープ

PR #387 が確立した conversation history の save/list/get/delete orchestration を narrow `ConversationHistoryService` へ抽出する。tenant/user partition、session document context authorization、normalization、favorite projection、display order/20件上限、not-found delete を不変とする。

対象外: route/schema/permission、session document context policy 実装、RAG session evidence normalization、favorite service、async-agent cancel/execute/current authorization/provider/writeback/artifact、merge/deploy/release。

## confirmed / integration gate

- PR #387 は Draft/Open/Clean/Mergeable、current head `9a215ac0`、GitHub CI success である。
- save は facade の `resolveSessionDocumentContext` による current authorization 完了後に store save する。
- list/get は `normalizeConversationHistoryInput` を適用し、list は chat-session favorite projection、display sort、20件上限を維持する。
- delete は同一 owner partition の get を先行し、missing=false、existing delete=true を返す。
- Phase4p は #387 current head を exact base とし、#437 単独の旧 conversation-history contract を固定しない。
- #387 の今後の更新により同一 facade/generated docs に機械的競合が生じる可能性があるため、PR は stacked Draft として同期対象を明記する。

## 受け入れ条件

- [x] service は conversation history store、favorite list、owner-key resolver、session-context resolver、normalizer、comparator の narrow ports のみに依存する。
- [x] save は session-context resolver 完了後だけ store save し、`isFavorite: false` を authoritative projection として保存する。resolver failure 後に save しない。
- [x] list は tenant/user owner keyを共有して history/favorites を取得し、normalized item、chatSession favorite、既存 display order、20件上限を維持する。
- [x] get は同一 owner partition だけを参照し、存在時のみ normalization する。
- [x] delete は同一 owner partition の get-before-delete を維持し、missing=false、existing=true、store failure propagation を維持する。
- [x] facade public signatures、routes/schema/permissions、session context authorization、RAG current reauthorization は非変更で delegate になる。
- [ ] targeted/API full/root CI、docs generation/check、source audit、diff/pre-commit、GitHub CI が成功する。
- [ ] Draft stacked PR、`semver:patch`、日本語 AC/self-review、task done/report、Issue progressを記録する。

## Done 条件・計画

1. service unit testを先行追加し、effect order、partition、normalization、sort/limit、not-found/errorを固定する。
2. narrow production serviceとfacade composition/delegateを実装し、security callbackをfacadeに残す。
3. DES と canonical API-code docs を同期する。
4. targeted/API full/root CI/docs/source/pre-commitを成功させる。
5. implementation commit/push、Draft stacked PR、両head CI、task done/report/final comments/Issue progressを完遂する。

actual AWS/DynamoDB/manual UIは対象外かつ未実施として記録する。merge/deploy/releaseは実行しない。

## ローカル検証証跡

- `npm ci`: success（既存8 vulnerabilities、dependency/lockfile変更なし）
- service + temporary attachment targeted: 2 files / service 6 testsを含めsuccess
- focused facade conversation history: success
- targeted ESLint / API typecheck: success
- API full: 816/816 success
- root `npm run ci`: API 816、Web 442、Infra 38、Benchmark 102を含む全workspace lint/typecheck/test/build success
- docs generation/check: 98 APIs / 588 documents success
- source audit: dataset-specific branch 0 / artifact manifest mismatch 0
- 既存Vite chunk warningのみ。actual AWS/DynamoDB/manual UIは未実施。
