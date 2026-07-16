# TC-003 単一入口移行と CORS 設定契約

- ファイル: `docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_002.md`
- 種別: `DES_HLD`
- 作成日: 2026-07-16
- 状態: Accepted
- 対応要求: `TC-003`
- 対応 ADR: `ARC_ADR_005`

## 対象範囲

本設計は、現在の SPA / REST API / WebSocket の分離入口から、CloudFront same-origin 単一入口へ安全に移行する順序と、移行期間中の CORS 設定契約を定義する。

本設計だけでは `TC-003` 全体を実装済みにしない。REST用CloudFront behaviorとSPA REST same-origin設定は段階2・3で実装するが、Hosted UI + PKCE、WebSocket ticket / behavior、direct origin technical restriction、signup は個別の後続実装で検証する。

## 目標構成

```mermaid
flowchart LR
  Browser[Browser SPA] -->|https://app.example.com/*| CF[CloudFront]
  CF -->|default| S3[Private S3 SPA origin]
  CF -->|/api/* prefix rewrite| REST[API Gateway REST]
  CF -->|/ws/* prefix rewrite| WS[API Gateway WebSocket]
  REST --> API[API Lambda]
  WS --> CONNECT[$connect authorizer]
  API --> Ticket[Short-lived one-time WS ticket]
  Ticket --> CONNECT
  Hosted[Cognito Hosted UI<br/>Authorization Code + PKCE] -->|CloudFront callback route| Browser
```

- Browser が保持する production origin は CloudFront public origin 1件だけとする。
- SPA は REST を `/api/*`、WebSocket を `/ws/*` の相対 path で呼び出す。
- REST / WebSocket の execute-api origin は Browser 設定へ公開しない。
- CloudFront から origin への転送、API 認証、application authorization は別責務とし、CORS を認証・認可の代替にしない。

## CORS 設定の唯一の正本

### Deployed stack

CDK context `corsAllowedOrigins` を deployed stack の唯一の入力とする。入力は shared contract で検証し、次の3箇所へ同じ exact origin を設定する。

1. API Lambda `CORS_ALLOWED_ORIGINS`
2. API Gateway preflight response
3. API Gateway default 4xx / 5xx GatewayResponse

API Gateway は request の `Origin` を反射せず、検証済み exact origin のみを静的に返す。deployed stack は `dev` / `preview` / `staging` でも exact origin 1件を要求し、wildcard と複数 origin を許可しない。

production の exact 1 origin は CloudFront 単一入口を根拠とし、HTTPSだけを許可する。`deploymentEnvironment=prod` または `production` では unset、blank、wildcard、HTTP、malformed、path/query/credential付き URL、複数 origin、localhost / loopback を synth 前に拒否する。

`corsAllowedOrigins` に `distributionDomainName` token を自動注入しない。後続で CloudFront `/api/*` origin が REST API/Lambda に依存したとき、Lambda environment から distribution への逆依存を作ると CloudFormation dependency cycle になり得るためである。production deploy は custom domain または確定済み CloudFront public origin を context へ明示する。

### Local / test runtime

`NODE_ENV` が production 以外の standalone API は、暗黙 default を持たない。

| 設定 | 結果 |
| --- | --- |
| unset / blank | CORS allow origin なし |
| exact `http(s)` origin 1件 | 許可 |
| exact `http(s)` origin 複数件 | 許可 |
| `*` の単独明示 | local/test用途として許可 |
| `*` と exact origin の混在 | 拒否 |
| malformed origin | 拒否 |

Taskfile の local API は `http://localhost:5173` を明示する。test が暗黙 wildcardを注入して production validation を通過させる構成にはしない。

## 移行順

| 順序 | 実装単位 | 安全条件 | rollback / blocker |
| ---: | --- | --- | --- |
| 1 | CORS fail-closed と shared contract | production exact origin 1件、wildcard 0、API/IaC negative test | 先行変更で実装済み。単独では `TC-003` 全体未達 |
| 2 | CloudFront `api` / `api/*` behavior と prefix rewrite | cache disabled、viewer `Host` 非転送、認証 header 転送、API errorをSPAへrewriteしない | 先行変更で実装済み。direct REST origin はまだ emergency rollback用 |
| 3 | SPA REST 接続先を `/api` 相対baseへ変更 | production bundle/configから execute-api / stage URLを除去し、production overrideもsame-originへfail closed | 本変更。CloudFront API behaviorのCI成功後に切替 |
| 4 | Hosted UI + Authorization Code + PKCE | callbackをCloudFront SPA routeへ限定 | signup方針とは別PR。既存認可を迂回しない |
| 5 | 短命・単回 WebSocket ticketと `/ws/*` behavior | Bearer認証済み発行、TTL 30–120秒、tenant/user binding | ticket検証とconnection保存を同時に導入 |
| 6 | direct origin制限と最終検証 | SPA設定からdirect origin 0、CORS wildcard 0、401/403/5xx/WS失敗を観測 | 全経路確認後にのみ緊急direct経路を閉じる |

本変更は順序3までを実装する。順序4以降とdirect origin technical restrictionは後続PRであり、REST same-origin化だけで `TC-003` 全体を完了扱いにしない。

## 段階2 REST behavior 実装契約

CloudFront DistributionはREST API Gatewayを `RestApiOrigin` として持ち、次のordered behaviorをdefault S3 behaviorより先に評価する。

| Viewer path pattern | Prefix rewrite | Origin path | Method / cache | Origin request |
| --- | --- | --- | --- | --- |
| `api` | `/api` → `/` | REST API deployment stage `prod` | all methods / `CachingDisabled` | `AllViewerExceptHostHeader` |
| `api/*` | `/api/...` → `/...` | REST API deployment stage `prod` | all methods / `CachingDisabled` | `AllViewerExceptHostHeader` |

AWS managed `AllViewerExceptHostHeader` はviewerの `Host` をAPI Gatewayへ転送せず、API Gateway origin domainの `Host` を使う。`Authorization`、`Last-Event-ID` を含むviewer header、cookie、全query stringはoriginへ転送する。CloudFront cache keyへ認証情報を入れて応答を共有するのではなく、`CachingDisabled` で認証付きresponseを保存しない。

prefix rewriteはviewer-request CloudFront Functionで行う。`/api` exact behaviorを別に持つのは、`api/*` に一致しないAPI root requestがdefault SPA behaviorへ落ちることを防ぐためである。Functionは `/api` または `/api/` prefixだけを変換し、他URIを変更しない。

### SPA fallback と API error の分離

Distribution-level 403/404 custom error responseは設定しない。これはorigin種別を区別せず、APIの認証・認可失敗やresource not foundを `/index.html`、HTTP 200へ変換するためである。

SPA client route fallbackはdefault S3 behaviorのviewer-request Functionだけに関連付ける。最終path segmentに拡張子がないURIを `/index.html` へrewriteし、`/assets/missing.js` のような拡張子付きstatic assetはrewriteしない。このためmissing static assetはS3 originの403/404を保持し、SPA HTMLを成功responseとして返さない。拡張子なしstatic objectを将来配信する場合は専用behaviorまたは明示除外を追加する。

API behaviorsはAPI prefix Functionだけを持ち、SPA Functionを持たない。したがってAPI Gatewayの401/403/404/5xx status/bodyはCloudFrontでSPA HTMLまたは200へ変換されない。CORS、Cognito authorizer、application permission、resource/tenant境界はこのrouting層とは別責務として維持する。

### 段階2完了時点の境界

- 段階2完了時点ではSPA `config.json` の `apiBaseUrl` はexecute-api stage URLを保持していた。段階3で相対 `/api` へ切り替える。
- `/ws/*` behavior、WebSocket ticket、Hosted UI + PKCE、direct origin制限は後続段階とする。
- CDK assertionはsynthesized policyとrewriteを検証するが、実AWSでの認証、SSE、large payload、error body/statusの疎通を代替しない。段階3をproductionへdeployする前にpreview環境で確認する。

## 段階3 SPA REST runtime config 実装契約

CloudFrontへdeployするSPA `config.json`は次のbrowser runtime設定を持つ。

```json
{
  "apiBaseUrl": "/api",
  "authMode": "cognito"
}
```

`apiBaseUrl`へCloudFront domainまたはexecute-api domainを埋め込まず、browser current originを基準に`/api/...`を呼び出す。deployed config生成はpure helperへ集約し、JSONに`execute-api`、`amazonaws.com/{stage}`、旧API domainが含まれないことをunit assertionする。

### environment別解決順

| Runtime | 解決順 | Fail-safe |
| --- | --- | --- |
| production build | canonical `/api` | VITE/fileのexecute-api、localhost、任意cross-origin absolute、non-string、blank、malformedを採用せず`/api`へ戻す |
| dev / test | valid `VITE_API_BASE_URL` → valid file `apiBaseUrl` → `http://localhost:8787` | invalid値をURLとして組み立てず次候補へ進む |

productionのVITE/file overrideをsame-originへ制限するのは、buildまたはruntime configの誤設定でdirect browser originを再導入しないためである。dev/testのabsolute overrideはローカルAPI・preview検証用途に限定する。

relative baseとrequest pathは共通helperで結合し、base末尾slashとpath先頭slashを1つに正規化する。HTTP、oRPC、chat SSEの全経路が同じhelperを使い、`/api//documents`または`/apidocuments`を生成しない。

### browser外consumerの境界

次のexecute-api URLはbrowser runtime leakではないため維持する。

- Lambdaの`BENCHMARK_TARGET_API_BASE_URL`
- benchmark state machineからCodeBuildへ渡すinternal `API_BASE_URL`
- CloudFormation `ApiUrl` / `OpenApiUrl` outputs

これらをSPA `config.json`へ再利用しないことをCDK assertionで固定する。execute-api endpoint自体のtechnical restrictionは全段階の疎通とrollback確認後に行う。

### 段階3の未実装境界

- `/ws/*` behavior、WebSocket ticket、Hosted UI + PKCE、security response headers、direct execute-api restrictionは後続段階とする。
- 実AWSのCloudFront→API Gateway疎通はunit/CDK testで代替しない。preview環境で認証、SSE、large payload、401/403/404/5xx status/bodyを確認する。

## 責務分担

| コンポーネント | 責務 | 非責務 |
| --- | --- | --- |
| shared CORS contract | origin syntax、environment rule、件数、wildcard、loopbackを検証 | 認証・認可、runtime response生成 |
| CDK | CORS single source、CloudFront REST behavior、SPA fallback分離、deployed SPA `/api` configを構成 | request Originの反射、application permission判定 |
| API middleware | 許可済みoriginへだけCORS headerを付与 | CORSによるJWT/permission代替 |
| API auth / authorization | JWT、active status、feature/resource/tenant境界を維持 | Browser originを本人性の根拠にすること |
| CloudFront | SPA/RESTのsame-origin path routing。後続でWS単一入口とsecurity headersを追加 | application permission判定 |
| WebSocket ticket（後続） | 短命・単回・user/tenant binding | 長期JWTのquery露出 |

## Security invariant

- Public endpoint は既存 `/health` と `/openapi.json` の allowlistから増やさない。
- OPTIONS bypass は preflight に限定し、protected routeの認証を迂回させない。
- route-level permission、resource ownership、tenant boundary、RAG grounding/citation/security guardを変更しない。
- CORS拒否はBrowserのcross-origin読取制御であり、APIの401/403、JWT、permission、ownershipを代替しない。
- API Gateway default error responseは内部origin、token、権限外resource名を返さない。

## 検証対応

| 設計項目 | 自動検証 |
| --- | --- |
| shared syntax/environment contract | `packages/contract/src/cors.test.ts` |
| API startup fail-closed | `apps/api/src/contract/api-hardening.test.ts` |
| public/preflight/auth boundary | `apps/api/src/security/access-control-policy.test.ts` |
| CDK synth-time fail-closed / single source | `infra/test/memorag-mvp-stack.test.ts` |
| generated IaC state | CDK snapshot、`docs/generated/infra-*` freshness check |
| CloudFront REST behavior / prefix / cache / forwarding | `infra/test/memorag-mvp-stack.test.ts` のbehavior・managed policy・Function assertion |
| API error / SPA fallback分離 | global custom error不存在、default/API Function分離、missing asset保持のnegative assertion |
| deployed SPA config非漏洩 / internal consumer分離 | `infra/test/memorag-mvp-stack.test.ts` のconfig helper・execute-api非包含・internal URL維持assertion |
| production fail-closed / dev override / URL join | `apps/web/src/shared/api/runtimeConfig.test.ts` とWeb API tests |
| 後続 PKCE / WS / direct origin制限 | 後続 PR の assertion、integration、browser/E2E、実環境確認 |

## 関連文書

- `docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/01_技術制約_TECHNICAL_CONSTRAINT/REQ_TECHNICAL_CONSTRAINT_003.md`
- `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md`
- `docs/3_設計_DES/41_API_API/DES_API_001.md`
- `tasks/todo/20260522-2120-cloudfront-single-entry-implementation.md`
