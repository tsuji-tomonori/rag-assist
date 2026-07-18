# Issue #359 Phase4p 作業完了レポート

## 受けた指示・要件

active Draft PR #387 を継続中の authoritative contract とし、その current head から dedicated worktree/branch を作成する。conversation history の save/list/get/delete orchestrationだけを narrow serviceへ抽出し、session-context security callbacks、routes/schema/tenant partition/order/limit/errorsを不変にする。async-agent cancel/execute/current authorization/provider/writeback/artifactは変更せず、merge/deploy/releaseを行わない。

## 要件整理・判断

- #437単独baseではPR #387のschema-v3/sessionDocumentContext/get/delete-404 contractを固定できないため、#387 exact head `9a215ac0`をbaseに選定した。
- session document contextのowner/tenant/session/scope/TTL/terminal非復活policyはfacadeに残し、resolver callbackだけをserviceへ注入した。
- store、favorite list、owner key、resolver、normalizer、comparator以外をserviceへ渡さず、route/APIやRAG reauthorizationを移動しなかった。
- #387更新時に同一facade/generated docsの機械的競合があり得るため、stacked Draftのintegration riskとして明記した。

## 実施作業・成果物

- `apps/api/src/conversations/conversation-history-service.ts`
- `apps/api/src/conversations/conversation-history-service.test.ts`（6 tests）
- `MemoRagService`のfour-method delegate/composition
- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`
- canonical API-code docs（98 APIs / 588 documents）
- task `tasks/done/20260718-1558-issue-359-conversation-history-service-extraction.md`
- Draft stacked PR #442（base #387、`semver:patch`）

## 検証

- `npm ci`: success、既存8 vulnerabilities、dependency/lockfile変更なし
- service + temporary attachment targeted: success（service 6 testsを含む）
- focused facade conversation-history: success
- targeted ESLint / API typecheck: success
- API full: 816/816 success
- root `npm run ci`: success（API 816、Web 442、Infra 38、Benchmark 102を含む全workspace lint/typecheck/test/build）
- docs generation/check: success（98 APIs / 588 documents）
- source audit: dataset-specific branch 0 / artifact manifest mismatch 0
- `git diff --check` / staged pre-commit: success
- implementation-head GitHub CI: success（7分40秒、run `29635554109`、promotion gate skipped）
- initial AC `issuecomment-5010386762`、self-review `issuecomment-5010386835`
- final-head CIはPR最終検証コメント、Issue progressはIssue #359進捗コメントへfinal-head監査後に記録する

## 指示への fit 評価

four methodsのpublic signature、tenant/user partition、session authorization-before-save、schema-v3 normalization、favorite-first/order/20件、get/delete not-foundをtest固定した。routes/schema/store interface/types、RAG current reauthorization、UI、async-agent禁止scopeに差分はない。no-mock dataやdataset-specific branchを追加していない。

## 未対応・制約・リスク

- actual AWS/DynamoDBとmanual UIは対象外かつ未実施で、local/GitHub CIを代替とは扱わない。
- PR #387が更新された場合はbase同期、session-context contract再監査、generated docs再生成が必要。
- 既存Vite chunk warning、npm audit 8 vulnerabilities、GitHub Actions Node.js deprecated annotationが残る。
- GitHub Appsのcallable capabilityが利用できず、GitHub操作は`gh` fallbackを使用した。
- merge/deploy/releaseは実行していない。
