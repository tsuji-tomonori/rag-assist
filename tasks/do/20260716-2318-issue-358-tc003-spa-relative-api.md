# Issue #358 TC-003 SPA REST接続先のsame-origin `/api` 化

- 状態: do
- タスク種別: 機能追加
- 作成日: 2026-07-16
- 起点: `codex/issue-358-tc003-cloudfront-api` final head `30bfd248`
- branch: `codex/issue-358-tc003-spa-relative-api`
- 関連要件: `TC-003`, `AC-TC003-010`, `AC-TC003-011`, `AC-TC003-035`
- 対応 ADR / design: `ARC_ADR_005`, `DES_HLD_002`

## 背景・目的

TC-003段階3として、CloudFrontから配信するSPA `config.json.apiBaseUrl` をAPI Gateway execute-api stage URLからsame-origin relative `/api`へ切り替える。段階2のCloudFront `api` / `api/*` behaviorをbrowser runtimeのREST入口として使用し、本番SPA設定からdirect API originを除去する。

local / test / explicit Vite環境変数によるAPI URL overrideは維持する。benchmark / CodeBuildが使うinternal `API_BASE_URL` とstackの`ApiUrl` / `OpenApiUrl` outputsはbrowser runtimeではないためexecute-api URLを維持する。

## RCA / なぜなぜ分析

### 問題文

CloudFront API behavior実装後も、`s3deploy.Source.jsonData("config.json", ...)` は`apiBaseUrl: restApiBaseUrl`を配布するため、production browserはexecute-api domainへdirect cross-origin接続し続ける。`AC-TC003-010`, `011`, `035`に未達である。

### 確認済み事実

- deployed SPA `config.json` は`restApiBaseUrl`を含む。
- `runtimeConfig.ts` はfile configと`VITE_API_BASE_URL`を読み、末尾slashを削除する。
- HTTP / oRPC / SSE clientsはbase URLと`/...`を各所で文字列結合する。
- stage 2でCloudFront `api` exact / `api/*` behaviorとprefix rewriteが実装・CI確認済みである。
- internal benchmark targetとstack outputsも`restApiBaseUrl`を使うが、browser runtime設定ではない。

### 根本原因

same-origin移行を段階化した際、CloudFront routingを先に安全に実装するためSPA runtime configは意図的にdirect REST URLへ残され、段階3の切替と非漏洩assertionが未実装だった。

### 対策

- deployed SPA runtime configの`apiBaseUrl`だけを`/api`へ変更する。
- deployed config生成をpure helperへ集約し、`apiBaseUrl === "/api"`かつ`execute-api`非包含をunit assertionする。
- relative/absolute baseの末尾slashとrequest pathの先頭slashを正規化する共通URL join helperを追加し、HTTP/oRPC/SSEで使う。
- config値を型・形式・environmentで検証し、productionはcanonical `/api`、dev/testはexplicit `VITE_API_BASE_URL` > file config > localhostの順でfail-safeに解決する。
- internal benchmark / CodeBuild / outputsのexecute-api URLは維持し、browser設定との責務差をHLDへ記録する。

## 決定事項

1. deployed SPA runtime configは`apiBaseUrl: "/api"`とする。CloudFront domain自体をconfigへ埋め込まない。
2. `VITE_API_BASE_URL`のabsolute origin overrideはdev/testだけで最優先する。productionではVITE/fileのexecute-apiまたは任意cross-origin absolute baseを拒否し、canonical `/api`へfail closedに戻す。
3. config取得失敗・未設定・non-string・blank・malformed時、productionはsame-origin `/api`、dev/localは`http://localhost:8787`へ解決する。end-userのlocalhostへproductionが暗黙接続してはならない。
4. API URL結合はbase末尾slashとpath先頭slashを1つに正規化し、`/api//documents`や`/apidocuments`を作らない。
5. benchmark / CodeBuildの`API_BASE_URL`、Lambdaのinternal target、`ApiUrl` / `OpenApiUrl` outputsはexecute-apiのまま維持する。
6. WebSocket、Hosted UI + PKCE、direct execute-api technical restrictionは後続段階とする。

## スコープ

### 対象

- deployed SPA `config.json.apiBaseUrl=/api`
- deployed config pure helperとexecute-api非漏洩test
- web runtime configのrelative `/api`、dev/test explicit override、production fail-closed、malformed値、local fallback test
- base URL / request pathの安全な共通joinとHTTP/oRPC/SSE利用
- Web / infra tests、snapshot / generated inventory、ADR / HLD同期
- task / report / commit / draft PR / review lifecycle

### 対象外

- benchmark / CodeBuild internal API URL変更
- stack `ApiUrl` / `OpenApiUrl` output変更
- WebSocket `/ws/*`、ticket、Hosted UI + PKCE
- execute-api endpoint自体の無効化、WAF、custom header
- API route、認証・認可、tenant/resource/RAG境界変更
- merge、deploy、release、実AWS疎通

## 実装チェックリスト

- [ ] deployed SPA runtime configを`/api`へ切り替える。
- [ ] deployed config helperとexecute-api非漏洩assertionを追加する。
- [ ] relative/absolute baseのURL join helperを追加しHTTP/oRPC/SSEへ適用する。
- [ ] file config、dev/test VITE override、production `/api` fail-closed、malformed値、local fallback、safe joinをWeb unit testで固定する。
- [ ] internal execute-api consumers / outputsを維持するnegative assertionを追加する。
- [ ] snapshot / generated infra inventory / ADR / HLDを同期する。
- [ ] selected validations、GitHub Actions、PR/task/report lifecycleを完了する。

## 受け入れ条件

- [ ] deployed SPA `config.json.apiBaseUrl` はexact `/api`である。
- [ ] deployed SPA runtime configのJSONに`execute-api`、stage URL、旧API domainが含まれない。
- [ ] file config `/api`から`/api/documents`、`/api/rpc`、`/api/chat-runs/.../events`を二重slashなしで生成できる。
- [ ] dev/testのexplicit `VITE_API_BASE_URL` absolute/local overrideはfile configより優先され、末尾slashを安全に正規化する。
- [ ] productionはVITE/fileのexecute-api・任意cross-origin absolute base、config fetch失敗、未設定、malformed値をcanonical `/api`へfail closedに解決し、localhostへ接続しない。
- [ ] benchmark / CodeBuild internal `API_BASE_URL`とstack API outputsはexecute-api URLを維持する。
- [ ] WebSocket / Hosted UI / direct origin restrictionを実装済みと扱わない。
- [ ] API auth / permission / tenant / resource / RAG safetyを変更しない。
- [ ] Web/infra tests、snapshot/generated docs、canonical docsが同期する。
- [ ] selected local validationsとimplementation/final-head GitHub CIが成功する。
- [ ] 日本語の受け入れ条件コメントとセルフレビューをPRへ残す。

## 検証計画

- Web runtime config / API targeted tests
- `npm test -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm test -w @memorag-mvp/infra`
- `npm run typecheck -w @memorag-mvp/infra`
- `npm run docs:infra-inventory:check`
- `npm run docs:hidden-unicode:check`
- `python3 scripts/validate_docs.py`
- root lint / GitHub Actions full CI
- `git diff --check`

local root CIがsandboxのtsx IPC / loopback listen制約で失敗する場合、require_escalatedを自動実行せず、GitHub Actionsをfull判定に使う。

## ドキュメント保守計画

- `ARC_ADR_005`: browser runtime設定のsame-origin化とinternal consumer境界を追記する。
- `DES_HLD_002`: 段階3実装契約、override/fallback、URL join、後続段階を追記する。
- `docs/generated/`: CDK snapshot由来inventoryを更新する。
- README / API docs: API shapeとlocal起動契約を変えないため更新不要予定。差分後に再確認する。

## リスク

- `/api` relative baseとrequest pathのslash結合不良は全SPA API呼び出しを壊すため、共通helperとdirect testで固定する。
- CloudFront stage 2が先にdeployされていない環境でSPA configだけを切り替えるとAPI到達不能になるため、stacked merge/deploy順をblockerとして明記する。
- CDK assertionは実AWS疎通を代替しない。previewで認証、SSE、error status/bodyを確認する。

## Done 条件

- すべての受け入れ条件がpassし、未解決のvalidation failureがない。
- PRが作成され、受け入れ条件確認とセルフレビューが日本語top-level commentとして残る。
- PR作成後にtaskを`tasks/done/`へ移動し、作業レポートと完了更新をsame branchへcommit/pushする。
- final-head GitHub CIを確認する。
