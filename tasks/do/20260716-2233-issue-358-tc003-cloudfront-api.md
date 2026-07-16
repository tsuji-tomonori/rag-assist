# Issue #358 TC-003 CloudFront `/api/*` behavior

- 状態: do
- タスク種別: 機能追加
- 作成日: 2026-07-16
- 起点: `codex/issue-358-tc003-cors-fail-closed` final head `948832c3`
- branch: `codex/issue-358-tc003-cloudfront-api`
- 関連要件: `TC-003`, `AC-TC003-004`, `AC-TC003-006`, `AC-TC003-007`
- 対応 ADR / design: `ARC_ADR_005`, `DES_HLD_002`

## 背景・目的

TC-003 の段階移行2として、CloudFront same-origin の `/api/*` を既存 REST API Gateway originへ接続する。viewer requestで `/api` prefixを削除し、認証付きAPI応答をcacheせず、viewerの `Host` をAPI Gatewayへ転送しない。

現行DistributionはS3 SPA originだけを持ち、global 403/404 custom error responseで `/index.html` を200として返す。このglobal fallbackを残したままAPI behaviorを追加すると、API Gatewayの403/404までSPA HTML/200へ変換され、認証・認可失敗やnot-foundの意味が壊れる。SPA fallbackをdefault behavior専用viewer-request rewriteへ移し、API behaviorを明確に除外する。

SPAのAPI接続先切替は段階移行3の別PRとし、本タスクでは `config.json` のdirect REST URLを維持する。

## RCA / なぜなぜ分析

### 問題文

現行 synthesized stack にはCloudFront `/api/*` behaviorがなく、CloudFrontをREST APIのsame-origin入口として利用できない。またglobal 403/404 SPA fallbackは、API behaviorを単純追加した場合にAPI errorを200/HTMLへ書き換える危険がある。

### 確認済み事実

- `infra/lib/memorag-mvp-stack.ts` のDistributionはS3 default originのみを持つ。
- 同Distributionは403/404を `/index.html`、HTTP 200へ変換するglobal `errorResponses` を持つ。
- REST APIは同stack内にあり、stage名は `prod` である。
- `ARC_ADR_005` / `DES_HLD_002` はREST behaviorにprefix strip、cache disabled、`AllViewerExceptHostHeader` を要求する。
- `AC-TC003-004` は `/api/v1/health` がoriginで `/v1/health` になること、`AC-TC003-006` はcache無効、`AC-TC003-007` はviewer `Host` 非転送を要求する。

### 根本原因

CloudFront単一入口はaccepted designとして定義されたが、Distribution生成時点ではSPA配信しか実装されず、API routingとglobal SPA error fallbackの責務分離が未実装だった。

### 対策

- `RestApiOrigin` とordered behaviorで `/api/*` をREST API stageへ接続する。
- CloudFront Functionでviewer requestの `/api` prefixを削除する。
- API behaviorはcache disabled、all methods、`AllViewerExceptHostHeader` とする。
- global custom error responseを撤去し、SPA client route rewriteはdefault behaviorのviewer-request Functionだけに限定する。
- CDK assertionでAPI 403/404がSPA fallbackへ変換されないことをnegative invariantとして固定する。

## 決定事項

1. REST originは `origins.RestApiOrigin` を使い、API Gateway stage origin pathはconstructの契約に委ねる。
2. API ordered behaviorは `/api/*` と、prefix rootの誤ったSPA fallbackを防ぐため `/api` の両方を同じ設定で登録する。
3. API prefix Functionは `/api` を `/`、`/api/...` を `/...` へ変換し、それ以外を変更しない。
4. API behaviorは `AllowedMethods.ALLOW_ALL`、`CachePolicy.CACHING_DISABLED`、`OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER` を使用する。query string、`Authorization`、`Last-Event-ID` はmanaged origin request policyで転送する。
5. SPA client route fallbackはdefault behaviorのviewer-request Functionだけで実施し、API behaviorには関連付けない。Distribution-level `CustomErrorResponses` は生成しない。
6. SPA `config.json` の `apiBaseUrl` 切替、WebSocket behavior、Hosted UI、security response headers、direct origin制限は別タスクとする。

## スコープ

### 対象

- CloudFront REST API originと `/api`, `/api/*` ordered behavior
- `/api` prefix strip CloudFront Function
- default SPA viewer-request rewriteとglobal error response撤去
- cache/method/header/query forwardingのCDK assertion
- API errorがSPA HTML/200へ変換されないnegative assertion
- snapshot / generated infra inventory / canonical design同期
- task / report / commit / draft PR / review lifecycle

### 対象外

- SPA production API base URLの相対path切替
- `/ws/*` behavior、WebSocket ticket、Hosted UI + PKCE
- CloudFront custom domain、WAF、direct execute-api制限
- API route、認証・認可、resource/tenant/RAG boundaryの変更
- merge、deploy、release、実AWS疎通

## 実装チェックリスト

- [ ] CloudFront API origin / ordered behavior / prefix Functionを実装する。
- [ ] SPA fallbackをdefault behavior専用Functionへ移し、global error responseを撤去する。
- [ ] forwarding / cache / methods / rewrite / negative invariantをCDK assertionで固定する。
- [ ] snapshotとgenerated infra docsを同期する。
- [ ] ADR / HLDに段階2の実装契約、SPA error分離、未実装境界を記録する。
- [ ] targeted infra test / typecheck / build、root CI、docs checksを実行する。
- [ ] 日本語commit、draft PR、受け入れ条件コメント、セルフレビュー、task done、作業レポート、final-head CI確認を完了する。

## 受け入れ条件

- [ ] `/api/v1/health` viewer requestがREST API Gateway originへ `/v1/health` として転送される設定である。
- [ ] `/api` もSPAへfallbackせずREST API root `/` へ転送される。
- [ ] API behaviorはall methodsを許可し、CloudFront cacheを無効化する。
- [ ] API behaviorは `AllViewerExceptHostHeader` を使い、viewer `Host` を除外しつつquery string、`Authorization`、`Last-Event-ID` をoriginへ転送する。
- [ ] Distribution-level 403/404 custom error responseがなく、APIの401/403/404/5xxをSPA HTMLまたはHTTP 200へ変換しない。
- [ ] SPA client route fallbackはS3 default behaviorだけに関連付くviewer-request Functionで維持される。
- [ ] public endpoint、Cognito authorizer、route permission、tenant/resource boundary、RAG safetyを変更しない。
- [ ] SPA API接続先切替、WebSocket、Hosted UI、direct origin制限を実装済みと扱わない。
- [ ] snapshot / generated infra docs / ADR / HLDが実装に同期する。
- [ ] selected validations、root CI、docs checks、final-head GitHub CIが成功する。
- [ ] 日本語の受け入れ条件コメントとセルフレビューをPR top-level commentに残す。

## 検証計画

- `npm test -w @memorag-mvp/infra`
- `npm run typecheck -w @memorag-mvp/infra`
- `npm run build -w @memorag-mvp/infra`
- `npm run docs:infra-inventory:check`
- `npm run docs:hidden-unicode:check`
- `python3 scripts/validate_docs.py`
- `npm run ci`
- `git diff --check`

Taskfile commandを使う場合は実体を確認してから実行し、sandbox escalationは自動再実行しない。

## ドキュメント保守計画

- `ARC_ADR_005`: API behaviorとSPA fallback責務分離、段階2の実装状態を追記する。
- `DES_HLD_002`: prefix rewrite、managed policies、API error preservation、段階3切替前の境界を追記する。
- `docs/generated/`: synthesized template由来のinventoryを更新する。
- README / API docs / UI docs: viewer-facing接続先とAPI shapeはまだ切り替えないため更新不要。差分後に再確認する。

## リスク

- CloudFront FunctionのURI rewrite誤りは全API到達性に影響するため、function code文字列とbehavior associationをassertionする。
- managed origin request policyによりviewer header/query/cookieを広く転送するが、application authorizationは既存Cognito/API middlewareが引き続き担う。
- CDK assertionは実AWS疎通を代替しない。SPA切替前にpreview環境でCloudFront経由の認証・SSE・error statusを確認する必要がある。
- stacked predecessorのmerge前に本PRをmergeすると、#365 / #369 / #374との履歴が混在する。

## Done 条件

- すべての受け入れ条件がpassし、未解決のvalidation failureがない。
- PRが作成され、受け入れ条件確認とセルフレビューが日本語top-level commentとして残る。
- PR作成後にtaskを `tasks/done/` へ移動し、完了更新を同branchへcommit/pushする。
- final-head GitHub CIの完了結果を確認する。
