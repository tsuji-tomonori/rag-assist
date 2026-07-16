# Issue #358 TC-003 WebSocket same-origin / single-use ticket

- 状態: do
- タスク種別: 機能追加
- 作成日: 2026-07-17
- 起点: `codex/issue-358-tc003-hosted-ui-pkce` final head `55c57ba0`
- branch: `codex/issue-358-tc003-websocket-ticket`
- 関連要件: `TC-003`

## 背景・目的

TC-003段階5として、本番ブラウザのWebSocket接続をCloudFront same-originのexact path `/ws/v1`へ集約する。RESTの認証済みrouteで短命ticketを発行し、API Gateway WebSocketの`$connect` authorizerがticketを一度だけ消費して、user / tenant / Cognito sessionへ接続をbindingする。長期JWTをURL queryへ載せず、ticketを含むsecretをCloudFront/API Gateway/Lambdaのログへ残さない。

CloudFrontとAPI Gateway WebSocketのpath/upgrade制約をAWS公式仕様とcurrent IaCで確認し、安全なsingle entryが構成できない場合は無理に実装せずADR/taskへblocking理由と代替境界を記録する。実AWS疎通はunit/CDK assertionで代替せず、未実施なら残存リスクとして明記する。

## 初期問題文

現行source/infraにはWebSocket API、CloudFront `/ws/v1` behavior、ticket発行/消費、connection lifecycle実装がない。既存ADR/HLDは将来のticket queryを例示するが、CloudFront standard access logは転送有無にかかわらず完全なquery stringを記録するため、ticket queryはredacted loggingを満たさない。

## RCA / 確認済み事実

- `apps/api/src`、`apps/web/src`、`infra`、testsにWebSocket API、`wss://`、`$connect`、connection storeの実装は存在しない。
- current CloudFrontはSPA default behaviorとREST `api` / `api/*` behaviorだけを持ち、WebSocket origin/behavior/rewriteはない。
- AWS公式仕様ではCloudFrontはWebSocketをHTTP/1.1で中継でき、upgradeに必要な`Sec-WebSocket-Key` / `Sec-WebSocket-Version`等のheader転送が必要である。
- CloudFront FunctionでURIを変更してもcache behavior/origin選択は変わらない。このためexact behavior `/ws/v1`でWebSocket originを先に選び、viewer-requestでAPI Gateway stage pathへrewriteする必要がある。
- API Gateway WebSocket invoke URLはstage pathを含み、Lambda authorizerは`$connect`だけで実行される。path parameterは利用できず、identity source欠損は401となる。
- CloudFront standard access logはoriginへqueryを転送しない設定でも完全なquery stringを記録する。ticket queryはredacted logging要件と両立しない。
- API Gatewayは`$connect` integrationが選択済みWebSocket subprotocolを`Sec-WebSocket-Protocol` response headerで返す構成を公式にサポートする。
- current Cognito認証は署名・issuer・audienceとauthoritative identity/revocation fenceを検証するが、API auth contextにsession identifier、token ID、token issued/expiryを保持していない。

## 根本原因

初期MVPはREST/SSE経路を優先し、WebSocketをADR/HLDの後続段階に留めた。CloudFront same-origin化前はWebSocket public path/stage rewriteとbrowser credential transportを確定できず、ticket store、session binding、authorizer、connection lifecycle、redacted logging contractを実装しなかった。また既存ADRのticket query例はCloudFront standard logのquery記録特性を考慮していなかった。

## 対策方針

- public entryをsame-origin exact `/ws/v1`だけにし、CloudFrontでAPI Gateway WebSocket originへroutingしてstage pathへrewriteする。
- browserは`Sec-WebSocket-Protocol`へ固定protocol `memorag.v1`とopaque短命ticketを提示する。長期JWT、ticket、authorization codeをqueryへ載せない。
- 認証済みREST routeで高entropy、60秒TTLのticketを発行し、DynamoDBにはhashだけを保存する。ticketはuser、tenant、session、token issued/expiryへbindingする。
- `$connect` REQUEST authorizerはcacheを無効化し、ticketをatomic conditional updateで一度だけ消費する。missing、expired、replayed、revoked、identity/session mismatch、store/provider failureをgeneric denyへfail closedにする。
- `$connect` integrationはauthorizer contextをconnection storeへ保存し、`memorag.v1`だけをresponseで選択する。`$disconnect`はidempotent deleteし、`$default`は未対応messageを成功扱いせずclose/error境界を明示する。
- Lambda/API Gateway access logへraw event、query、subprotocol ticket、JWTを出さず、allowlistしたrequest/connection/ticket correlation ID、route、status、reason codeだけを記録する。

## スコープ

### 対象

- 認証済みWebSocket ticket発行REST routeとauthorization policy
- short-lived single-use ticket store、hash-at-rest、session/user/tenant binding
- `$connect` authorizer、replay/expiry/revocation fail-closed
- `$connect` / `$disconnect` / `$default` connection lifecycle
- CloudFront exact `/ws/v1` behavior、WebSocket upgrade header転送、stage rewrite
- API Gateway WebSocket API/stage/authorizer/integrationsとredacted access logging
- API/infra unit tests、access-control static policy、ADR/HLD、task/report/PR lifecycle

### 対象外

- serverからの業務message push、chat/RAG WebSocket payload protocol
- 既接続socketの即時強制切断を行う運用worker
- execute-api direct endpointの無効化（段階6）
- SPA製品画面へのWebSocket consumer統合
- merge、deploy、release、実AWS/browser疎通

## 実装チェックリスト

- [ ] current source/infra/auth/logging/docsを再監査しRCAとAWS制約を確定する。
- [ ] task mdへ受け入れ条件、検証計画、blocking/rollback境界を先に固定する。
- [ ] auth contextへ検証済みsession/token binding情報を追加する。
- [ ] ticket service/store、REST route、static access-control policyを実装する。
- [ ] WebSocket authorizerとconnect/disconnect/default lifecycleを実装する。
- [ ] API Gateway WebSocketとCloudFront exact behavior/rewrite/loggingをIaCへ実装する。
- [ ] secret redaction、expiry、replay、revocation、disconnect/reconnect/upgrade errorを自動testへ落とす。
- [ ] ADR/HLD/generated inventoryを同期しselected validationsを実行する。
- [ ] draft PR、AC comment、self-review、task/report、final-head CIを完了する。

## 受け入れ条件

- [ ] production browserのWebSocket public URLはsame-origin exact `/ws/v1`であり、SPA runtimeにexecute-api WebSocket URLを配布しない。
- [ ] CloudFrontはexact `/ws/v1`だけをWebSocket originへrouteし、viewer `Host`を転送せず、HTTP/1.1 upgradeに必要なheaderを転送してAPI Gateway stage pathへrewriteする。
- [ ] WebSocket credentialは`Sec-WebSocket-Protocol`にある短命opaque ticketであり、長期JWT/ticketをURL query、path、cookieへ載せない。
- [ ] ticket発行routeは既存Cognito authと`authenticated` authorizationを必須とし、public/missing auth/group allowlistだけでは発行できない。
- [ ] ticketは暗号学的に十分なentropy、60秒TTL、single-useで、保存時はhash化され、userId、tenantId、sessionId、tokenId、token issued/expiryへbindingされる。
- [ ] ticket応答と永続recordは必要最小限であり、raw JWTや不要なemail/group/resource情報を含まない。
- [ ] `$connect` authorizerはresult cacheを使わず、ticketの消費をatomicかつone-timeに行い、同時接続/replayのうち最大1件だけを許可する。
- [ ] missing、malformed、expired、replayed、revoked ticket、inactive/suspended identity、user/tenant/session不一致、store/provider障害は接続を許可せずgeneric 401/403へfail closedにする。
- [ ] ticket発行後にsession revocation fenceがticket内token issued time以後へ進んだ場合、`$connect`を拒否する。
- [ ] `$connect` integrationは検証済みauthorizer contextだけからconnectionを保存し、ticket token自体を保存せず、選択済みsubprotocol `memorag.v1`だけを応答する。
- [ ] `$disconnect`はconnection削除をidempotentに処理し、重複/遅延eventで別connectionを削除しない。
- [ ] `$default`、unsupported protocol、upgrade/integration errorは接続成功や業務message成功へfallbackせず、generic failure/closeとして扱う。
- [ ] disconnect後のreconnectは新しいticketを必要とし、消費済みticketで再接続できない。
- [ ] Lambda/API Gateway/CloudFrontの設計はraw event、JWT、ticket、query credentialをログへ残さず、allowlistされたcorrelation ID、route、status、reason codeだけを記録する。
- [ ] authorizerは`$connect`時だけ評価され、既接続socketにrevocationが遡及しないAWS制約をdocs/PRへ明記し、将来のserver-pushは送信直前再認可なしに導入しない。
- [ ] REST authorization、tenant/resource boundary、RAG safety、benchmark固有値/dataset分岐を弱めない。
- [ ] API/infra tests、access-control static policy、generated docs、canonical ADR/HLDが同期する。
- [ ] selected local validationsとimplementation/final-head GitHub CIが成功する。
- [ ] 日本語の受け入れ条件コメントとセルフレビューをdraft PRへ残す。

## 検証計画

- targeted API auth/ticket/store/route/access-control tests
- ticket entropy/TTL/hash-at-rest/binding/concurrent single-consume/replay/expiry/revocation/provider failure tests
- targeted WebSocket authorizer/connect/disconnect/default/redaction tests
- targeted infra WebSocket API/authorizer/CloudFront behavior/rewrite/logging CDK assertions
- API full test/typecheck/build、infra full test/typecheck/build/synth
- root lint、generated inventory freshness、hidden Unicode、docs validation、`git diff --check`
- synthesized templateとproduction Web artifactにlong JWT/query ticket/direct WebSocket URL/raw secret loggingがないnegative inspection
- GitHub Actions full CI

local root CIがsandboxのtsx IPC / loopback listen制約で失敗する場合、`require_escalated`を自動実行せず、GitHub Actionsをfull判定に使う。

## ドキュメント保守計画

- `ARC_ADR_005`のticket query例をsubprotocol transportへ更新し、CloudFront standard logの理由を記録する。
- `DES_HLD_002`へexact path/stage rewrite、ticket/session binding、redaction、connect/disconnect/reconnect/error、revocation limitationを反映する。
- generated API/infra inventoryを再生成し、差分または差分なしを確認する。
- READMEへの影響は差分後に判断し、製品message protocol未実装を誤認させない。

## リスク・blocking / rollback境界

- CloudFront/WebSocket/API Gatewayのupgradeはunit/CDK assertionだけでは保証できない。実AWS/browserで101 response、subprotocol echo、idle disconnect/reconnectをpreview gateとして確認する。
- Lambda authorizerは`$connect`だけで、既接続socketはrevocation後も自動再評価されない。server pushは本taskで実装せず、将来は送信直前のconnection/session再認可を別gateにする。
- API Gateway WebSocket execute-api endpointは段階6まで技術的に到達可能である。SPAには配布せず、direct origin制限の後続taskを完了扱いにしない。
- same-origin exact behavior、subprotocol echo、redacted loggingのいずれかを安全に構成できないと判明した場合、実装を強行せずADR/taskへblocked理由と代替境界を残す。
- rollback時はSPA consumer未接続のためCloudFront `/ws/v1` behaviorとWebSocket API resourcesを戻せる。既存REST/SSE経路は変更しない。

## Done 条件

- すべての受け入れ条件がpassし、未解決のvalidation failureがない。
- 実AWS未検証を実施済みとして扱わず、preview gateと残存リスクを記録する。
- draft PRへ日本語AC確認とセルフレビューを残す。
- taskを`tasks/done/`へ移動し、作業レポートをsame branchへcommit/pushする。
- final-head GitHub CIを確認する。
