# ADR-0005: CloudFront単一入口構成を本番公開経路として採用する

- ファイル: `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md`
- 種別: `ARC_ADR`
- 作成日: 2026-05-22
- 状態: Accepted

## Context

MemoRAG の本番ブラウザ導線では、SPA、REST API、WebSocket API が別originとして見えると、domain、subdomain、port、protocol差によりCORSが発生する。

CORS許可を広げて調整し続ける運用は、APIドメイン埋め込み、RESTとWebSocketの入口分裂、preview/localとの差分拡大を招きやすい。

AWSのCORS仕様では異なるoriginからのブラウザ呼び出しにCORS応答が必要になる。CloudFrontはS3 originをOACで保護でき、WebSocket転送にも対応している。API Gateway originではviewerの `Host` をそのまま転送しない origin request policy が用意されている。

## Decision

本番公開入口はCloudFrontのみとする。

```text
https://app.example.com/          -> SPA / S3
https://app.example.com/api/v1/*  -> REST API
wss://app.example.com/ws/v1       -> WebSocket API
```

SPAは本番でAPI Gateway execute-api domainや旧API domainを保持しない。REST APIは `/api/...`、WebSocketは `/ws/...` の同一origin相対経路を使う。

CloudFrontから配信するproduction SPAの`config.json.apiBaseUrl`はcanonical same-origin `/api`とする。production runtimeは`VITE_API_BASE_URL`またはfile configにexecute-api URL、localhost、任意cross-origin absolute URLが指定されても採用せず、`/api`へfail closedに解決する。absolute API origin overrideはdev/testだけに限定し、valid VITE override、valid file config、localhost defaultの順で解決する。non-string、blank、malformed値をendpointとして組み立てない。

browser runtime設定とservice/infrastructure consumerを区別する。benchmark / CodeBuildのinternal `API_BASE_URL`、Lambdaのbenchmark target、CloudFormation `ApiUrl` / `OpenApiUrl` outputsはAPI Gateway stageを直接参照する運用・内部用途として維持し、SPA `config.json`へ混入させない。

S3 SPA bucketはprivate bucketとし、CloudFront OAC経由だけで配信する。OAC対象外のS3 website endpointは本番SPA配信に使わない。

CloudFront behaviorは次の3系統に固定する。

| Path | Origin | 方針 |
| --- | --- | --- |
| `default (*)` | S3 SPA bucket | 静的アセット配信。OAC必須。`index.html` は短TTL、hashed assetsは長TTL。 |
| `/api/*` | API Gateway REST API | `/api` prefixを削除してoriginへ転送する。キャッシュは無効化する。`Authorization` を転送する。 |
| `/ws/*` | API Gateway WebSocket API | `/ws` prefixを削除してoriginへ転送する。viewerの `Host` はoriginへ渡さない。WebSocket upgrade系request headerとquery stringをoriginへ渡す。キャッシュは無効化する。 |

REST API behaviorのorigin request policyは、API Gateway向けに `AllViewerExceptHostHeader` を基本とする。cache policyは `CachingDisabled` を基本とする。

REST API behaviorは `api` exact pathと `api/*` path patternの両方を持つ。viewer-request CloudFront Functionは `/api` を `/`、`/api/...` を `/...` へ変換し、API Gateway stage originへ渡す。allowed methodsは全method、cacheは無効、origin request policyはAWS managed `AllViewerExceptHostHeader` とする。このmanaged policyによりviewerの `Host` を除き、`Authorization`、`Last-Event-ID` を含むviewer header、cookie、query stringをoriginへ転送する。

SPA client route fallbackはS3 default behaviorだけのviewer-request Functionとして実装する。Distribution-levelの403/404 custom error responseは使わない。global custom error responseはordered API behaviorの401/403/404/5xxまで `/index.html` とHTTP 200へ変換するため、認証・認可・not-found・障害の意味を壊す。API behaviorにはSPA rewrite Functionを関連付けず、origin statusとbodyを保持する。

SPA Functionは最終path segmentに拡張子がないURIだけを `/index.html` へrewriteする。`/assets/missing.js` のような拡張子付きmissing static assetはrewriteせず、S3 originの403/404を保持する。拡張子なしの静的objectをSPA配信へ追加する場合は、専用behaviorまたはrewrite除外規則を先に設計する。

WebSocket API behaviorもAPI Gateway origin向けであるため、viewerの `Host` はoriginへ渡さず、origin requestではAPI Gateway origin domainの `Host` を使う。WebSocket handshakeに必要な `Sec-WebSocket-Key` と `Sec-WebSocket-Version` はoriginへ転送し、clientが使う場合は `Sec-WebSocket-Protocol` と `Sec-WebSocket-Extensions` も転送する。`Sec-WebSocket-Accept` はoriginからviewerへ返るhandshake responseとして通す。

本番APIのCORSは、広いallowlistやwildcardでブラウザ導線を成立させる用途に使わない。本番ブラウザ導線はsame-origin前提とし、CORS allowlistはlocal、dev、preview環境に限定する。

production のCORS設定はCloudFront public HTTPS origin 1件だけを exact origin として許可する。これは単一入口の帰結であり、複数production originをallowlistへ追加して入口分裂を維持しない。CDK context `corsAllowedOrigins` を唯一の入力とし、API Lambda、API Gateway preflight、default 4xx/5xx GatewayResponseへ同じ検証済みoriginを配布する。API Gatewayはrequest `Origin` を反射しない。

`deploymentEnvironment=prod` または `production` では、unset、blank、wildcard、HTTP、malformed、複数origin、localhost/loopbackをsynth前に拒否する。deployed dev/preview/stagingもstatic GatewayResponseとの契約を一意にするためexact origin 1件とし、standalone local/test APIに限って複数の明示exact originまたは単独の明示wildcardを許可する。暗黙wildcard defaultは持たない。

CloudFront `distributionDomainName` tokenをLambda environmentの自動defaultにはしない。後続の `/api/*` behaviorがREST API/Lambdaへ依存した際に、Lambdaからdistributionへの逆依存を作ってCloudFormation dependency cycleを生じ得るためである。production deployでは確定済みCloudFront public originをcontextへ明示する。

認証はCognito Hosted UI + Authorization Code + PKCE S256を採用する。public SPA clientはclient secretを生成せず、implicit grantを許可しない。callback URLはproduction public originのexact `/auth/callback`、logout URLは同originのexact `/`だけをallowlistし、wildcard、execute-api origin、任意redirect originを登録しない。REST APIのJWT検証はAPI Gateway Cognito User Pool Authorizerで行い、業務認可はLambdaまたはapplication middlewareで実施する。

production browserはHosted UIをprimary signin/logout経路とし、Hosted UI runtime configが欠損・不正な場合にemail/password formへfallbackしない。authorization requestごとにcryptographically randomなstate、nonce、code verifierを生成し、challenge methodはS256だけを使う。一時情報はsession storageへ短時間だけ保持し、callback開始時にone-time consumeして成功・失敗・replay後に残さない。

Cognito/Hosted UI browser設定はsame-origin `/config.json`だけから読み、`VITE_COGNITO_*` build-time overrideを設けない。production build環境へ任意domain、callback、client IDを注入してもbundle/runtime候補へ混入しない境界を維持する。

callbackはexact origin/path、単一code/state、state一致、transient expiryを検証してからtoken endpointへcode/verifierを送る。取得したID/access tokenはCognito JWKSのRS256署名、issuer、ID token audience、access token client binding、token use、nonce、expiryを検証してからsessionへ反映する。queryのcode/state/errorは処理後にbrowser historyから除去する。

既存benchmark / CodeBuildとAPI audience contractは同じapp client IDを使うため、段階4ではclient IDを分割しない。password/SRP auth flowはinternal benchmark互換のためapp clientに残るが、production browser code pathはHosted UIへfail closedに分離する。direct auth/originの技術的制限とclient分割要否は最終hardening段階で扱う。

FR025のself sign-up UXは独立要件であり、本段階のHosted UI signin/callback/logout実装をもって完了扱いにしない。

WebSocketは長いJWTをqueryに直接持たせず、REST APIで短命ticketを発行し、API Gateway WebSocket APIの `$connect` Lambda authorizerでticketを検証する。

## Migration Order

1. CORS origin contractをAPI runtimeとCDKで共有し、production/deployed stackをfail-closedにする。
2. CloudFront `api` / `api/*` behavior、prefix rewrite、cache無効化、viewer `Host` 非転送、API errorとSPA fallbackの分離を実装する。
3. SPAのREST接続先を `/api` 相対baseへ切り替え、production bundle/configからdirect API originを除去し、production overrideをsame-originへfail closedにする。
4. Cognito Hosted UI + Authorization Code + PKCEとCloudFront callback routeを実装する。
5. 短命・単回WebSocket ticketとCloudFront `/ws/*` behaviorを実装する。
6. direct originを制限し、CORS wildcard 0、SPA direct origin 0、認証・認可・ログ相関を最終検証する。

各段階は前段の自動/実環境検証を切替条件とし、後段未実装の間は `TC-003` 全体をVerified扱いにしない。詳細な責務、rollback条件、検証対応は `DES_HLD_002` を正とする。

## Options

| 選択肢 | 評価 |
| --- | --- |
| SPAからAPI Gateway execute-api domainへ直接接続する | 不採用。本番ブラウザ導線でCORSが常時必要になり、API originがUI設定へ漏れる。 |
| REST APIだけCloudFront経由にし、WebSocketは別domainにする | 不採用。入口が分裂し、CORSや接続設定の運用差分が残る。 |
| CloudFrontを唯一の公開入口にし、SPA / REST / WebSocketを同一origin相対経路へ統一する | 採用。本番CORSを最小化し、公開入口、security header、監視、ログ相関の境界を集約できる。 |

## Consequences

### Positive

- SPAにAPI Gateway実domainを埋め込まない構成にできる。
- 本番ブラウザ導線ではCORSを発生させない設計に寄せられる。
- S3 SPA bucketをOACでCloudFront経由のみにできる。
- RESTとWebSocketの入口を `https://app.example.com` / `wss://app.example.com` に統一できる。
- CloudFront、API Gateway、LambdaのrequestIdを同一入口のログとして相関しやすくなる。

### Negative

- CloudFront behavior、origin request policy、prefix rewriteの設定ミスがAPI到達性に影響する。
- WebSocket upgrade header、query string転送、idle timeoutの検証が必要になる。
- API Gateway execute-api URLは技術的に到達可能なため、CORS、認可、必要に応じたcustom headerやWAFで追加防御する必要がある。

## Required Runtime Boundaries

REST APIの認可順序は次に固定する。

1. JWT検証。
2. `user status = active` 確認。
3. feature permission確認。
4. resource permission確認。
5. tenant境界確認。
6. quality policy / visibility policy確認。
7. handler実行。

RAG検索は、検索前後でresource permission、tenant境界、quality policy、citation可能性を確認する。LLM、RAG、tool、workerに最終的な権限判断を任せない。

WebSocket ticketは次を満たす。

- TTLは30秒から120秒。
- 利用回数は1回。
- `userId`、`tenantId`、`issuedAt`、`expiresAt` と紐付ける。
- DynamoDB TTLまたは署名付きHMAC + nonceで再利用を拒否できる。
- 失敗時は権限外情報を返さず401または403を返す。

## Related Requirements

- `TC-003`: CloudFront単一入口と本番CORS最小化。

## Related Design

- `docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_002.md`: 単一入口への段階移行、CORS single source、failure timing、後続PR境界。

## References

- AWS Documentation: CORS for REST APIs in API Gateway, `https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html`
- AWS Documentation: Restrict access to an Amazon S3 origin, `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html`
- AWS Documentation: Use managed origin request policies, `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html`
- AWS Documentation: Preconfigured distribution settings reference, `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/template-preconfigured-origin-settings.html`
- AWS Documentation: Use WebSockets with CloudFront distributions, `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-working-with.websockets.html`
- AWS Documentation: OAuth 2.0 grants, `https://docs.aws.amazon.com/cognito/latest/developerguide/federation-endpoints-oauth-grants.html`
- AWS Documentation: Control access to REST APIs using Amazon Cognito user pools as an authorizer, `https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html`
- AWS Documentation: Control and manage access to WebSocket APIs in API Gateway, `https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-control-access.html`

## Follow-up

- SPAの本番API接続先を相対パスへ統一し、direct origin用環境変数をdev専用にする。
- CloudFrontに `default (*)`、`/api/*`、`/ws/*` behaviorを追加する。
- `/api` と `/ws` prefix削除をCloudFront Functionまたは同等のedge処理で実装する。
- API共通middlewareへCORS、OPTIONS、public endpoint、JWT、feature permission、resource permission、audit、error sanitizeを集約する。
- Cognito Hosted UI callbackをCloudFront domainのSPA routeへ統一する。
- WebSocket ticket発行API、`$connect` authorizer、connection table、server push経路を実装する。
- direct origin access、wildcard CORS、権限漏れ、security header、ログ相関をテストで固定する。
