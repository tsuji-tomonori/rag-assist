# Issue #358 TC-003 WebSocket ticket 作業完了レポート

- 実施日: 2026-07-17
- branch: `codex/issue-358-tc003-websocket-ticket`
- implementation commit: `836db490`
- stacked draft PR: #388
- task: `tasks/done/20260717-0059-issue-358-tc003-websocket-ticket.md`

## 受けた指示

TC-003段階5として、current source/infraとAWS公式制約を再監査し、WebSocketをCloudFront same-origin single entryへ集約する。長期JWT queryを禁止し、user/tenant/sessionへbindingした短命single-use ticket、redacted logging、expiry/replay/revocation fail-closed、disconnect/reconnect/upgrade errorを実装・検証する。browser成功条件のselected `Sec-WebSocket-Protocol` echo、API Gateway access/execution logのsecret非記録、ticket発行routeのauth/tenant/IAM、atomic consume後の最小authorizer contextを明示する。実AWSの101/idle/reconnectと既接続revocation非遡及はpreview gateとして扱い、merge/deploy/releaseは行わない。

## 要件整理

- public pathはexact `/ws/v1`とし、SPA runtimeへexecute-api WebSocket URLを配布しない。
- CloudFront behavior選択後にAPI Gateway stage `/prod`へrewriteし、query/cookieは転送しない。
- credentialは`Sec-WebSocket-Protocol`のopaque ticketとし、URL query/path/cookieへsecretを載せない。
- ticketは256-bit、60秒以下、SHA-256 hash-at-rest、atomic single-useで、verified user/tenant/Cognito session-tokenへbindingする。
- `$connect`でticketをconsume後、authoritative identity、account status、tenant、session revocation fenceを再検証する。
- `$connect`は`memorag.v1`を選択応答し、connection record/context/logは必要最小限にする。
- API Gateway execution logging/data traceを無効化し、access/app logをallowlist fieldへ限定する。
- 実AWS疎通とdirect endpoint制限、既接続socketのsend-time再認可は後続gateとする。

## 検討・判断

- CloudFront standard logはorigin転送設定に関係なくquery string全体を記録するため、既存ADRのticket query案を不採用とした。
- browserから提示可能でAPI Gateway `$connect` authorizerのidentity sourceにできる`Sec-WebSocket-Protocol`をticket transportに使用し、integrationは製品protocol `memorag.v1`だけをechoする。
- CloudFront FunctionのURI rewriteはbehavior/origin選択を変更しないため、exact `ws/v1` behaviorでWebSocket originを選んだ後に`/prod`へrewriteする。
- API Gateway WebSocket REQUEST authorizerは`$connect`だけで実行されるため、`$disconnect`/`$default`は既接続後のfail-closed lifecycle routeとし、cdk-nagへresource限定の理由付きsuppressを設定した。
- 既存の大きなAPI default IAM policyへticket権限を追加するとsynth条件によってstatementが残らないことをtestで検出したため、API/Heavy APIの2 roleへ付く専用`dynamodb:PutItem` policyへ分離した。

## 実施作業

- auth contextへCognito `origin_jti`、`jti`、iat、exp由来のsession/token bindingを追加した。
- WebSocket ticket service、DynamoDB ticket/connection store、認証済みREST routeを追加した。
- atomic consume、authoritative revocation再検証、minimal authorizer contextを実装した。
- connect/disconnect/default handlerとselected subprotocol echoを実装した。
- API Gateway WebSocket API、stage、routes、authorizer、integration、log groupをCDKへ追加した。
- CloudFront exact behavior、stage rewrite Function、custom origin request policyを追加した。
- ticket issuance、authorizer、connection handlerのIAMを用途別・table別に限定した。
- unit/static/CDK assertion、snapshot、OpenAPI/API code/infra inventoryを追加・更新した。
- `ARC_ADR_005`と`DES_HLD_002`へtransport、redaction、lifecycle、preview gateを反映した。
- draft PR #388を作成し、日本語の受け入れ条件確認とセルフレビューをtop-level commentへ記録した。

## 成果物

- API: `apps/api/src/routes/websocket-ticket-routes.ts`
- ticket: `apps/api/src/websocket-ticket-service.ts`、`apps/api/src/adapters/dynamodb-websocket-ticket-store.ts`
- lifecycle: `apps/api/src/websocket-authorizer.ts`、`apps/api/src/websocket-connection-handler.ts`
- IaC: `infra/lib/memorag-mvp-stack.ts`
- tests: 対応するAPI unit test、`apps/api/src/security/access-control-policy.test.ts`、`infra/test/memorag-mvp-stack.test.ts`
- docs: `ARC_ADR_005.md`、`DES_HLD_002.md`、generated OpenAPI/API code/infra inventory
- PR: #388（#382 final headをbaseにしたstacked draft）

## 検証結果

- `npm run test:coverage -w @memorag-mvp/api`: 828/828 pass、Statements/Lines 90.52%、Functions 92.89%
- `npm test -w @memorag-mvp/infra`: 43/43 pass
- `task docs:check`: pass
- `task verify`: pass
- `npm run synth:yaml -w @memorag-mvp/infra`: pass。既存のMFA/WAF warningのみ
- `git diff --check`: pass
- implementation-head GitHub Actions MemoRAG CI: success（PR #388）

## 指示へのfit評価

same-origin exact entry、URL credential禁止、single-use ticket、session/user/tenant binding、atomic consume、revocation fail-closed、protocol echo、secret-redacted logging、least-privilege IAM、disconnect/reconnect/error境界をsourceとsynthesized templateへ反映した。RAGの根拠性・既存REST認可境界を変更せず、benchmark期待語句・QA sample固有値・dataset固有分岐も追加していない。実AWS未検証をunit/CDK検証で代替したとは報告せず、preview gateとして分離した。

## 未対応・制約・リスク

- 実AWS/browserの101 response、selected `memorag.v1` echo、idle timeout、disconnect/fresh reconnect、consumed-ticket reconnect failure、upgrade/integration errorは未検証である。
- authorizerは`$connect`だけであり、already-connected socketへrevocationは遡及しない。send-time reauthorizationがないserver pushは導入しない。
- execute-api direct endpoint無効化はTC-003段階6であり、本作業では未対応である。
- PR #388は#382へstackしている。#382 merge後にbaseを`main`へretargetする必要がある。
- lifecycle commit push後のfinal-head CI結果はPR/Issue commentへ追記する。
- merge、deploy、releaseは実施していない。
