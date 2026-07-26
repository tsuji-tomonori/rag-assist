# Issue #358 TC-003 SPA same-origin REST接続 作業完了レポート

- 作成日時: 2026-07-16 23:42 JST
- branch: `codex/issue-358-tc003-spa-relative-api`
- 起点: `30bfd248`（PR #376 final head）
- implementation commit: `bf159f35`
- PR: `https://github.com/tsuji-tomonori/rag-assist/pull/379`（draft）

## 受けた指示

TC-003段階3として、CloudFront配下SPAのREST接続先をexecute-api stage URLからsame-origin `/api`へ切り替える。productionではVITE/file configを経由したexecute-api、任意cross-origin、localhostの再導入を拒否して`/api`へfail closedにする。一方、dev/test overrideとbrowser外のbenchmark / stack outputは維持し、HTTP、oRPC、SSEのURL結合を安全に共通化する。

WebSocket、Hosted UI + PKCE、direct execute-api technical restrictionは後続段階とし、実AWS preview未実施をpass扱いにしない。

## 要件整理

- deployed SPA `config.json.apiBaseUrl`はexact `/api`とし、execute-api URLを含めない。
- productionは外部・不正・欠損configからcanonical `/api`へfail closedし、localhostへ接続しない。
- dev/testはvalid VITE override、valid file config、localhostの順で解決する。
- relative/absolute baseとrequest pathを二重slashなしで結合し、HTTP/oRPC/SSE全経路で使用する。
- internal benchmark / CodeBuild URLとstack API outputsはexecute-apiのまま維持する。
- API認証・認可、tenant/resource、RAG safetyを変更しない。

## 検討・判断

1. CloudFront domain自体を設定へ埋め込まず、browserが現在originを使うrelative `/api`をcanonical値とした。
2. productionではbuild-time VITE値もruntime file値も信頼せず、常に`/api`を返すことでdirect API originの再混入をfail closedにした。
3. dev/testだけ明示overrideを許容し、値はsame-origin relativeまたはcredentials/query/hashなしHTTP(S) absoluteへ制限した。
4. URL joinを共通helperへ集約し、既存HTTP、oRPC `/rpc`、chat SSE event pathの文字列結合差を解消した。
5. browser runtimeとinternal consumerを分離し、benchmark targetとCloudFormation outputsは既存運用契約を維持した。

## 実施作業

- infraのdeployed frontend config生成をpure helperへ集約し、`apiBaseUrl: "/api"`を配布。
- Web runtime resolverへ型・形式検証、production fail-closed、dev/test優先順位、`joinApiPath`を実装。
- HTTP、oRPC、chat SSE clientを共通join helperへ移行。
- infra testでbrowser config非漏洩とinternal execute-api consumer維持をassertion。
- Web testでproduction negative cases、dev override、file config、fallback、実consumer URLを固定。
- `ARC_ADR_005`、`DES_HLD_002`を段階3契約へ同期。
- task、draft PR、日本語の受け入れ条件コメント、セルフレビューを作成。

## 成果物

- implementation commit: `bf159f35`
- draft PR: `https://github.com/tsuji-tomonori/rag-assist/pull/379`
- 受け入れ条件コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/379#issuecomment-4993184909`
- セルフレビュー: `https://github.com/tsuji-tomonori/rag-assist/pull/379#issuecomment-4993189987`
- task: `tasks/done/20260716-2318-issue-358-tc003-spa-relative-api.md`

## 検証結果

### 成功

- targeted Web runtime/API tests: 28/28 pass。
- `npm test -w @memorag-mvp/web`: 448/448 pass。
- `npm test -w @memorag-mvp/infra`: 42/42 pass。
- root lint、Web/infra typecheck、Web production build: pass。
- generated Web/infra inventoryを再生成し差分なし。freshness check: pass。
- hidden Unicode、`python3 scripts/validate_docs.py`、`git diff --check`: pass。
- malicious `VITE_API_BASE_URL=https://abc.execute-api...`を注入したproduction build: pass。`apps/web/dist`の`execute-api`検索は0件。
- GitHub Actions full CI run `29507042880`（implementation head `bf159f35`）: success。全lint/typecheck/docs/inventory/runtime audit/infra・benchmark・API・Web tests/coverage/build/CDK synth + cdk-nag/GSI guardを確認。
- semver label run `29507051978`: success。

### 未実施

- local root `npm run ci`は既知のsandbox tsx IPC / loopback listen `EPERM`と明示承認なしのため未実施。sandbox外実行は要求せず、full判定にGitHub Actions実結果を使用した。
- 実AWS preview疎通は未実施であり、pass扱いにしていない。
- task/report完了commitのfinal-head GitHub CIはpush後に監視し、PR commentへ結果を記録する。

## GitHub Apps / fallback記録

- PR作成はGitHub Apps callが60秒timeoutし、`gh pr list`で未作成を確認してから`gh pr create --draft`へfallbackした。
- PR本文更新、semver label追加、受け入れ条件コメント、セルフレビューコメントはGitHub Appsで成功した。

## 指示へのfit評価

- deployed browser configをexact `/api`へ変更し、productionでdirect endpoint候補をfail closedに拒否したためfit。
- HTTP/oRPC/SSEの実consumerへsafe joinを適用し、二重slashなしをtestしたためfit。
- internal benchmark/outputを維持し、browser runtimeとの境界をtest/docsへ記録したためfit。
- 認証・認可・RAG、WebSocket、Hosted UI、direct origin restrictionを変更せず、段階スコープを維持したためfit。
- 実AWS未検証とstacked deploy blockerを明示し、unit/CIを実疎通の代替として扱っていないためfit。

## 未対応・制約・リスク

- stacked merge/deploy順 `#365 → #369 → #374 → #376 → #379` がblocker。CloudFront stage 2より先にSPA configだけをdeployするとAPI到達不能になる。
- previewでCloudFront経由の認証header/cookie、SSE再接続、large payload、401/403/404/5xx status/body保持を確認する必要がある。
- WebSocket、Hosted UI + PKCE、execute-api direct endpoint制限は後続。TC-003全体は未完了。
- GitHub ActionsのNode.js 20 action deprecation annotationは本変更起因ではないが、workflow更新課題として残る。
- merge、deploy、releaseは未実施。
