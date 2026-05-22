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

S3 SPA bucketはprivate bucketとし、CloudFront OAC経由だけで配信する。OAC対象外のS3 website endpointは本番SPA配信に使わない。

CloudFront behaviorは次の3系統に固定する。

| Path | Origin | 方針 |
| --- | --- | --- |
| `default (*)` | S3 SPA bucket | 静的アセット配信。OAC必須。`index.html` は短TTL、hashed assetsは長TTL。 |
| `/api/*` | API Gateway REST API | `/api` prefixを削除してoriginへ転送する。キャッシュは無効化する。`Authorization` を転送する。 |
| `/ws/*` | API Gateway WebSocket API | `/ws` prefixを削除してoriginへ転送する。viewerの `Host` はoriginへ渡さない。WebSocket upgrade系request headerとquery stringをoriginへ渡す。キャッシュは無効化する。 |

REST API behaviorのorigin request policyは、API Gateway向けに `AllViewerExceptHostHeader` を基本とする。cache policyは `CachingDisabled` を基本とする。

WebSocket API behaviorもAPI Gateway origin向けであるため、viewerの `Host` はoriginへ渡さず、origin requestではAPI Gateway origin domainの `Host` を使う。WebSocket handshakeに必要な `Sec-WebSocket-Key` と `Sec-WebSocket-Version` はoriginへ転送し、clientが使う場合は `Sec-WebSocket-Protocol` と `Sec-WebSocket-Extensions` も転送する。`Sec-WebSocket-Accept` はoriginからviewerへ返るhandshake responseとして通す。

本番APIのCORSは、広いallowlistやwildcardでブラウザ導線を成立させる用途に使わない。本番ブラウザ導線はsame-origin前提とし、CORS allowlistはlocal、dev、preview環境に限定する。

認証はCognito Hosted UI + Authorization Code + PKCEを採用する。REST APIのJWT検証はAPI Gateway Cognito User Pool Authorizerで行い、業務認可はLambdaまたはapplication middlewareで実施する。

WebSocketは長いJWTをqueryに直接持たせず、REST APIで短命ticketを発行し、API Gateway WebSocket APIの `$connect` Lambda authorizerでticketを検証する。

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
