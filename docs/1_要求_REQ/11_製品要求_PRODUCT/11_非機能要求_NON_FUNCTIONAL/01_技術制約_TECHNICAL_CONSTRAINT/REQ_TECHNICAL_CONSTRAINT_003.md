# 要件定義（1要件1ファイル）

- 要件ID: `TC-003`
- 種別: `REQ_TECHNICAL_CONSTRAINT`
- 状態: Draft
- 優先度: A

## 要件

- TC-003: 本番ブラウザ導線ではCloudFrontを唯一の公開入口とし、SPA、REST API、WebSocket APIを同一originの相対経路で扱うこと。

## 受け入れ条件（この要件専用）

### CloudFront / origin

- AC-TC003-001: `https://app.example.com/` はSPAを返し、S3 bucket URL直アクセスは403または非公開になること。
- AC-TC003-002: S3 SPA bucketはprivate bucketとし、CloudFront OAC経由だけで配信すること。
- AC-TC003-003: S3 website endpointを本番SPA originとして使わないこと。
- AC-TC003-004: `/api/v1/health` はCloudFront経由でAPI Gateway REST APIへ届き、origin側では `/v1/health` として扱えること。
- AC-TC003-005: `/ws/v1?ticket=xxx` はCloudFront経由でAPI Gateway WebSocket APIへ届き、origin側では `/v1?ticket=xxx` として扱えること。
- AC-TC003-006: API behaviorはcache policyを無効化し、認証付きAPI応答をCloudFront cacheに保存しないこと。
- AC-TC003-007: REST API behaviorはviewerの `Host` をoriginへそのまま渡さないorigin request policyを使うこと。
- AC-TC003-008: WebSocket behaviorはupgradeに必要なheaderとquery stringをoriginへ転送すること。
- AC-TC003-036: WebSocket behaviorはviewerの `Host` headerをAPI Gateway WebSocket originへ転送しないこと。
- AC-TC003-037: WebSocket behaviorはquery stringをoriginへ転送すること。
- AC-TC003-038: WebSocket behaviorは `Sec-WebSocket-Key` と `Sec-WebSocket-Version` をoriginへ転送すること。
- AC-TC003-039: WebSocket behaviorはclientが使う場合に `Sec-WebSocket-Protocol` と `Sec-WebSocket-Extensions` をoriginへ転送すること。
- AC-TC003-040: WebSocket behaviorはcache policyを無効化すること。
- AC-TC003-041: WebSocket originへ送られる `Host` はCloudFront viewer domainではなくAPI Gateway origin domainであること。

### SPA / CORS

- AC-TC003-009: 本番API応答に `Access-Control-Allow-Origin: *` が存在しないこと。
- AC-TC003-010: SPAの本番bundleと本番設定に `execute-api`、`amazonaws.com/{stage}`、旧API domainが含まれないこと。
- AC-TC003-011: SPAは本番で `fetch("/api/v1/me")` のような同一origin相対pathでREST APIを呼び出せること。
- AC-TC003-012: SPAは本番で `/ws/v1` の同一origin WebSocket pathへ接続できること。
- AC-TC003-013: CORS allowlistはlocal、dev、preview環境だけで使うこと。
- AC-TC003-014: allowlist外originからのCORS preflightは拒否されること。
- AC-TC003-015: CORS、OPTIONS、public endpoint、protected endpointの扱いはAPI共通middlewareまたは同等の共通層へ集約すること。

### 認証・認可

- AC-TC003-016: ログインはCognito Hosted UI + Authorization Code + PKCEを使うこと。
- AC-TC003-017: Cognito callback URLはCloudFront domain配下のSPA routeへ統一すること。
- AC-TC003-018: Authorizationなしの `/api/v1/me` は401になること。
- AC-TC003-019: 無効JWTの `/api/v1/me` は401になること。
- AC-TC003-020: 有効JWTだがfeature permission不足の操作は403になること。
- AC-TC003-021: 有効JWTだがresource permission不足のフォルダ・文書は検索、citation、debug traceに出ないこと。
- AC-TC003-022: REST APIはJWT検証後に、active user、feature permission、resource permission、tenant境界、quality policy、visibility policyをhandler実行前に確認すること。
- AC-TC003-023: Cognito authorizerは本人確認の層として扱い、業務認可を置き換えないこと。

### WebSocket

- AC-TC003-024: `/api/v1/ws-ticket` はBearer tokenなしではticketを発行しないこと。
- AC-TC003-025: WebSocket ticketは30秒から120秒のTTLを持つこと。
- AC-TC003-026: TTL超過後のticketは `$connect` で拒否されること。
- AC-TC003-027: ticketは2回目の `$connect` で拒否されること。
- AC-TC003-028: `$connect` 成功時だけDynamoDB WebSocketConnectionsまたは同等のconnection storeに `connectionId` が保存されること。
- AC-TC003-029: ticketは `userId`、`tenantId`、`issuedAt`、`expiresAt` と紐付けて検証すること。
- AC-TC003-030: ticket検証失敗時は権限外情報を返さず401または403を返すこと。

### Security / observability

- AC-TC003-031: CloudFront response headersにHSTS、CSP、frame制御、XSS/Content-Type系のsecurity headerが付くこと。
- AC-TC003-032: API error responseに内部origin名、権限外文書名、内部policy名、token断片が含まれないこと。
- AC-TC003-033: CloudFront、API Gateway、LambdaのrequestIdをログ相関できること。
- AC-TC003-034: 401、403、5xx、WebSocket connect失敗、ticket失敗をメトリクス化すること。
- AC-TC003-035: API Gateway execute-api URLをSPAから使わせないこと。

## 要件の源泉・背景

- 源泉: 2026-05-22 ユーザー提示のCloudFront単一入口構成方針。
- 背景: 本番ブラウザ導線でREST APIやWebSocket APIのoriginが分裂すると、CORS設定、API domain埋め込み、preview/local差分が増える。
- 背景: 本番ではCORS許可を広げるのではなく、CloudFront domainを唯一の公開入口としてsame-origin化する方が運用・セキュリティ境界を単純にできる。

## 要件の目的・意図

- 目的: 本番CORSを最小化し、公開入口、認証認可、WebSocket接続、security header、ログ相関の責務を整理する。
- 意図: SPA / REST / WebSocketの入口をCloudFrontへ集約し、LLM、RAG、tool、workerへ権限判断を委譲しない実装方針を固定する。
- 区分: 技術制約。

## 状態管理

- Draft理由: 本要件はCloudFront単一入口構成の受け入れ条件を先に固定するための要求定義であり、CloudFront/CDK、API middleware、SPA相対パス化、Cognito callback、WebSocket ticket実装は未完了である。
- 昇格条件: 後続実装で `AC-TC003-001` から `AC-TC003-041` を自動テストまたは実環境検証で確認し、CloudFront/CDK、API middleware、SPA、Cognito、WebSocket ticketの設計文書または実装PRへ紐づいた時点で Accepted / Verified 相当へ更新する。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `TC-003` |
| 説明 | CloudFront単一入口と本番CORS最小化 |
| 根拠 | 本番ブラウザ導線をsame-origin化し、CORS設定の散在とAPI domain埋め込みを避けるため |
| 源泉 | 2026-05-22 ユーザー提示方針 |
| 種類 | 技術制約 |
| 依存関係 | `ARC_ADR_005`, Cognito Hosted UI, API Gateway REST API, API Gateway WebSocket API, CloudFront, S3 OAC |
| 衝突 | direct execute-api接続や広いCORS allowlistを前提にした既存設定がある場合は移行が必要 |
| 受け入れ基準 | `AC-TC003-001` から `AC-TC003-041` |
| 優先度 | A |
| 安定性 | High |
| 変更履歴 | 2026-05-22 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 本番CORS、公開入口、API domain埋め込みの方針を固定する必要がある |
| 十分性 | OK | SPA、REST、WebSocket、CORS、認証認可、security header、observabilityを含む |
| 理解容易性 | OK | path、origin、認可順序、ticket方式を具体化している |
| 一貫性 | OK | `ARC_ADR_005` の採用判断と整合する |
| 標準・契約適合 | OK | AWS CloudFront、S3 OAC、API Gateway、Cognitoの前提に沿う |
| 実現可能性 | OK | CloudFront behavior、API middleware、Cognito、DynamoDB connection storeで実装可能 |
| 検証可能性 | OK | 受け入れ条件をインフラ、API、WebSocket、security、observabilityの観点で検証できる |
| ニーズ適合 | OK | CORS設定の散在、入口分裂、権限境界の曖昧化を避ける |

## 関連文書

- `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md`
- `docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_002.md`
