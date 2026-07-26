# Issue #358 TC-003 Hosted UI + PKCE 認証フロー

- 状態: done
- タスク種別: セキュリティ機能追加
- 作成日: 2026-07-16
- 起点: `codex/issue-358-tc003-spa-relative-api` final head `23c6612c`
- branch: `codex/issue-358-tc003-hosted-ui-pkce`
- 関連要件: `TC-003`
- 分離要件: `FR025` signupは本タスク対象外

## 背景・目的

TC-003段階4として、production SPAの主認証経路をCognito Hosted UIのOAuth 2.0 authorization code grant + PKCE S256へ移行する。implicit grantとclient secretを使わず、callbackでstate、nonce、transient expiry、token issuer、audienceを検証する。authorization code、verifier、state、nonceなどの一時情報は成功・失敗を問わずone-timeでclearし、再利用・replayを許さない。

FR025 signup UXは別要件として分離し、本タスクではHosted UI signin/callback/logout契約だけを扱う。実AWS疎通はunit/CDK assertionで代替せず、未実施の場合は残存リスクとして明記する。

## 初期問題文

現行production SPAがHosted UI authorization code + PKCEをprimaryにしていない、またはcallback security contractが十分に固定されていない可能性がある。Cognito client、runtime config、Web auth実装、既存test/docsを調査し、確認済み事実と根本原因を実装前に追記する。

## RCA / 確認済み事実

- Cognito User Pool domainは作成済みだが戻り値を保持せず、SPA runtime configへHosted UI base URLを配布していない。
- app client sourceは`USER_PASSWORD_AUTH` / SRPと`generateSecret: false`だけを明示し、OAuth flow、scope、callback URL、logout URLを指定していなかった。その結果、変更前snapshotにはCDK defaultの`AllowedOAuthFlows = [implicit, code]`、広いdefault scope、placeholder `https://example.com` callbackが生成され、logout URLはなかった。
- browser `signIn`はCognito IDP `InitiateAuth`へemail/passwordを直接送信し、productionとdevの認証経路を分離していない。
- session作成時はID token payloadをbase64 decodeしてgroupを読むだけで、署名、issuer、audience、nonceを検証していない。
- runtime configにHosted UI domain、redirect URI、logout URIがなく、PKCE verifier/state/nonce/expiryのtransient storeとcallback handlerも存在しない。
- benchmark / CodeBuildとAPI runtimeは同じapp client IDを使うため、app clientを単純分割するとAPI audience contractとbenchmark認証へ波及する。

## 根本原因

初期MVPではself-hosted login formとCognito password authを先に実装し、Hosted UI domainは将来用resourceとしてだけ作成された。CloudFront single-entryへの段階移行でcallback originが確定するまでOAuth client設定とbrowser callback security contractを後続へ残し、CDK default OAuth値も明示的に上書きしなかったため、implicit許可とplaceholder callbackを含むclientが生成され、production primary経路、PKCE、callback検証も未接続のままだった。

## 対策方針

- 既存app client IDを維持してbenchmark/API audience contractを壊さず、authorization code grant、exact callback/logout、openid/email/profile scopeを追加する。implicitは明示的に無効、client secretは引き続き生成しない。
- production browserはcomplete Hosted UI configがない場合にpassword formへfallbackせずunavailableとしてfail closedにする。direct password/signup UIは明示local/dev境界だけに残し、FR025変更を本タスクへ混ぜない。
- Hosted UI runtime config、PKCE S256、state/nonce/短期expiry、one-time transient consume、token exchange、JWKS署名 + issuer/audience/client binding/nonce/expiry検証を独立moduleへ実装する。
- callback routeはCloudFront SPA fallbackを使う`/auth/callback` exact URLとし、logoutはpublic origin root exact URLへ戻す。

## スコープ

### 対象

- Cognito Hosted UI domain / app client OAuth code grant設定
- PKCE S256 challenge/verifier生成とauthorization redirect
- implicit grant無効、client secretなしのCDK assertion
- production callback/logout URLのexact allowlist
- OAuth callbackのstate / nonce / transient expiry検証
- ID/access tokenのissuer / audienceまたはclient binding検証
- authorization code exchangeとtoken反映
- transient auth stateのone-time clear（成功・失敗・replay）
- productionでHosted UIをprimary signin/logout経路にする
- dev/testの安全な既存認証経路の扱いを明確化
- Web/infra unit tests、ADR/HLD、task/report/PR lifecycle

### 対象外

- FR025 signup画面・招待・自己登録UX
- WebSocket認証/ticket
- execute-api direct endpoint制限
- API route、application RBAC、tenant/resource/RAG境界変更
- merge、deploy、release、実AWS疎通

## 実装チェックリスト

- [x] 現行Cognito/Web auth/runtime config/test/docsを調査しRCAを確定する。
- [x] Hosted UI domainとauthorization code grant + PKCE対応app clientをinfraへ実装する。
- [x] implicit grant無効、client secretなし、exact callback/logout URLをassertion化する。
- [x] PKCE S256、state、nonce、expiryを含むauthorization requestとtransient storeを実装する。
- [x] callbackでstate/nonce/expiry/issuer/audienceを検証してcode exchangeする。
- [x] transient stateを成功・失敗・replay時にone-time clearする。
- [x] production signin/logoutをHosted UI primaryへ切り替える。
- [x] FR025 signupと後続security段階を実装済みとして扱わない。
- [x] docs/generated inventoryを同期し、selected validationsを実行する。
- [x] draft PR、AC comment、self-review、task/report、final-head CIを完了する。

## 受け入れ条件

- [x] Cognito app clientはauthorization code grantを許可し、implicit grantを許可しない。
- [x] public SPA clientにclient secretが生成・配布されない。
- [x] authorization requestはPKCE `S256`を必須とし、plain/no challengeへfallbackしない。
- [x] production callback/logout URLはdeployed SPAのexact URLだけをallowlistし、wildcard・任意origin・execute-api URLを含まない。
- [x] authorization requestごとに十分なentropyのstate、nonce、code verifier、短いexpiryを生成・保存する。
- [x] callbackはcode/state/errorのshape、state一致、未期限切れを検証し、不一致・欠損・期限切れ・replayを拒否する。
- [x] code exchange後のtokenは署名検証済みJWTとしてissuer、audience/client binding、nonce、expiryを検証し、不一致を拒否する。
- [x] transient stateはcallback開始後にone-timeでconsume/clearされ、成功・失敗後に再利用できない。
- [x] productionのsignin/logout primary経路はHosted UIであり、password grant・implicit・client secret・架空token fallbackを使わない。
- [x] dev/testの経路は明示的な非production境界に限定し、productionへ混入しないnegative testがある。
- [x] FR025 signup、WebSocket、direct origin restrictionを実装済みと扱わない。
- [x] API authorization、tenant/resource boundary、RAG safetyを弱めない。
- [x] Web/infra tests、snapshot/generated docs、canonical docsが同期する。
- [x] selected local validationsとimplementation/final-head GitHub CIが成功する。
- [x] 日本語の受け入れ条件コメントとセルフレビューをPRへ残す。

## 検証計画

- targeted Web auth / callback / runtime config tests
- targeted infra Cognito / frontend config tests
- Web full test / typecheck / production build
- infra full test / typecheck / build / synth
- root lint、generated inventory freshness、hidden Unicode、docs validation、`git diff --check`
- production build artifactにclient secret、implicit grant用token処理、注入した任意Cognito domain/client/callback値が混入しないnegative inspection
- GitHub Actions full CI

local root CIがsandboxのtsx IPC / loopback listen制約で失敗する場合、require_escalatedを自動実行せず、GitHub Actionsをfull判定に使う。

## ドキュメント保守計画

- Cognito/SPA認証を記述するADR/HLDへHosted UI + PKCE security contractと後続境界を反映する。
- generated infra/Web inventoryを再生成し、差分または差分なしを確認する。
- README/API docsへの影響を差分後に判断する。

## リスク

- callback/logout URLはCloudFront distribution URLのdeployment-time値となるため、CDK tokenを含むexact構成とHosted UI redirect生成の整合が必要。
- JWT検証をdecodeだけで済ませるとissuer/audience/nonce偽装を許すため、既存Cognito verifierとの統合を確認する。
- sessionStorage/localStorageの一時情報はXSS耐性を持たないため、保存期間を短くしone-time consumeする。長期token保存方針は既存契約を不用意に拡大しない。
- unit/CDK assertionは実AWS Hosted UI、cookie、redirect、logoutを代替しない。preview確認を別gateとして残す。

## 完了結果

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/382
- implementation commit: `fcfb38a5`
- implementation-head main CI: `29510819578` success
- semver check: label付与前の`29510819194`はfailure、`semver:minor`付与後の`29510826685`はsuccess
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/382#issuecomment-4993744145
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/382#issuecomment-4993764177
- Web: 63 files / 459 tests pass、coverage statements 90.11% / branches 85.22% / functions 90.54% / lines 93.07%
- infra: 42/42 tests pass、snapshot pass
- root lint、Web/infra typecheck/build、`task docs:check`、`git diff --check`: pass
- 作業レポート: `reports/working/20260717-0031-issue-358-tc003-hosted-ui-pkce.md`
- final-head CIは本task/report lifecycle commitをpush後に確認し、結果をPRコメントへ記録する。
- 実AWS Hosted UI/browser、MFA、cookie、redirect、JWKS、logoutは未検証であり、preview browser gateとして残す。
- FR025 signup、WebSocket、execute-api direct restriction、client分割は未対応として分離した。

## Done 条件

- すべての受け入れ条件がpassし、未解決のvalidation failureがない。
- 実AWS未検証を実施済みとして扱わず、残存リスクとpreview確認項目を記録する。
- draft PRへ日本語AC確認とセルフレビューを残す。
- taskを`tasks/done/`へ移動し、作業レポートをsame branchへcommit/pushする。
- final-head GitHub CIを確認する。
