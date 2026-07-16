# Issue #358 TC-003 Hosted UI + PKCE 作業完了レポート

- 実施日: 2026-07-16〜2026-07-17
- branch: `codex/issue-358-tc003-hosted-ui-pkce`
- PR: #382
- implementation commit: `fcfb38a5`
- 対象: TC-003 段階4

## 受けた指示

production SPAの主認証経路をCognito Hosted UIのOAuth 2.0 Authorization Code Grant + PKCE S256へ移行する。implicit grantとclient secretを無効化し、exact callback/logout、state、nonce、短期expiry、issuer、audience/client bindingを検証する。transient情報は成功・失敗を問わずone-timeでclearし、productionはHosted UIへfail closedにする。FR025 signupは別要件として扱い、実AWS未検証をpassとして報告しない。

## 要件整理とRCA

- 変更前のCDK sourceはOAuth flow、scope、callback、logoutを明示しておらず、synthesized snapshotにはCDK defaultの`AllowedOAuthFlows=[implicit, code]`、広いscope、placeholder `https://example.com` callbackが生成され、logout URLはなかった。
- User Pool domainは作成済みだったが、SPA runtime configへHosted UI base URLを配布していなかった。
- production SPAもCognito `USER_PASSWORD_AUTH`を直接使い、ID token payloadをdecodeするだけで、署名、issuer、audience、nonceを検証していなかった。
- benchmark / API runtimeは同じapp client IDを使うため、本段階ではclient IDとinternal password/SRP flowを維持し、production browser経路だけをHosted UIへ分離した。app client分割・direct flowの技術的禁止は後続hardening事項とした。

## 実施作業

- Cognito app clientをauthorization code onlyへ明示し、implicitを無効化、`GenerateSecret=false`、`openid email profile`、deployed public origin由来のexact callback/logoutを設定した。
- Hosted UI base URL、redirect URI、logout URIをdeployed same-origin `/config.json`へ追加した。
- browserのCognito設定源を`/config.json`だけに限定し、`VITE_COGNITO_*`のbuild-time注入経路を削除した。
- Web Cryptoで十分な長さのstate、nonce、code verifierとPKCE `S256` challengeを生成し、5分expiry付きtransientを`sessionStorage`へ保存した。
- callback開始時にtransientを先にconsume/removeし、callback shape、exact origin/path、state、expiryを検証してreplayを拒否した。
- `jose`のremote JWKSとRS256固定でID/access tokenを検証し、issuer、ID audience、access `client_id`、`token_use`、nonce、expiryを確認した。
- production loginをHosted UI buttonだけにし、設定欠損・不正時はpassword/signup formへfallbackせずunavailableにした。direct password/signupは明示local/dev境界に限定した。
- logout時にsession/transientをclearし、exact Hosted UI logout URLへ遷移するようにした。
- infra/Web tests、CDK snapshot、`ARC_ADR_005`、`DES_HLD_002`、generated Web inventoryを同期した。

## 成果物

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/382
- 主実装: `apps/web/src/features/auth/api/hostedUiAuth.ts`
- runtime config / UI / auth session統合: `apps/web/src/shared/config/runtimeConfig.ts`、`apps/web/src/features/auth/hooks/useAuthSession.ts`、`apps/web/src/features/auth/components/LoginPage.tsx`
- infra: `infra/lib/memorag-mvp-stack.ts`と関連test/snapshot
- docs: `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md`、`docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_002.md`
- task: `tasks/done/20260716-2351-issue-358-tc003-hosted-ui-pkce.md`

## 検証結果

- `npm ci`: success。auditは既存8 vulnerabilities（low 2 / moderate 1 / high 5）を報告し、自動fixは未実施。
- Web targeted auth/runtime/UI tests: pass。
- Web full test: 63 files / 459 tests pass。
- Web coverage: statements 90.11%、branches 85.22%、functions 90.54%、lines 93.07%、global gate pass。
- infra full test: 42/42 pass、snapshot pass。
- Web / infra typecheck: pass。
- Web / infra build: pass。Web buildには約596.86 kBのchunk size warningが残るがbuildは成功。
- root lint: pass。
- `task docs:check`: docs validation、OpenAPI、API code freshness、Web trace/inventory、infra inventory、hidden Unicodeを含めpass。
- `git diff --check`: pass。
- malicious `VITE_COGNITO_*`を注入したproduction build: pass。bundleから注入domain/client/callback、`response_type=token`、`client_secret`はいずれも0件。
- implementation-head GitHub Actions main CI `29510819578`: success。lint、全typecheck、docs checks、全test/coverage、全build、CDK synth + cdk-nagを含む。
- semver check: PR作成直後・label付与前の`29510819194`はfailure。`semver:minor`付与後の`29510826685`はsuccess。
- 初回infra testは意図したOAuth snapshot差分のみで41/42となり、snapshot同期後42/42へ修復した。
- 初回Web coverageは全test成功でもstatements 89.87%でgate failureとなり、helper/callback negative test追加後90.11%へ修復した。
- local root `npm run ci`は既知のsandbox tsx IPC / loopback listen `EPERM`と明示承認なしのため未実施。GitHub Actions full CIを判定に使用した。

## 指示へのfit評価

- authorization code only、PKCE S256、implicit無効、client secretなし、exact callback/logoutをinfra assertionとWeb negative testで固定した。
- state、nonce、expiry、issuer、audience/client bindingとone-time transientを実装・testし、production password fallbackを排除した。
- FR025 signup、WebSocket認証、execute-api direct restriction、client分割は完了扱いにしていない。
- API route、authorizer/middleware、tenant/resource boundary、RAG safetyは変更していない。
- benchmark期待語句、QA sample固有値、dataset固有分岐を実装へ追加していない。
- production UIへmock/demo fallbackや架空tokenを追加していない。

## 未対応・制約・残存リスク

- 実AWS Cognito managed login、MFA、cookie、redirect、JWKS取得、logoutのbrowser疎通は未実施。stacked predecessorを順にmerge/deployしたpreview環境で確認が必要。
- manual viewport/zoom、screen reader、axe、visual regression、real-deviceは未実施。
- app clientはbenchmark/API互換のためinternal password/SRP flowを保持している。production browser pathの分離はtest固定したが、client分割とdirect flowの技術的制限は後続hardeningが必要。
- long-lived token保存の既存方針とXSS耐性は本PRで拡張していない。PKCE transientは短期・one-timeだが、sessionStorage自体はXSS耐性を提供しない。
- Web chunk size warningは既存のbundle分割課題として残る。
- GitHub AppsによるPR作成は60秒timeoutし、未作成を確認して`gh` fallbackを使用した。PR本文更新はGitHub Appsで成功した。受け入れ条件・セルフレビューコメントは各60秒timeout後に未投稿を確認し、`gh` fallbackを使用した。
- merge、deploy、releaseは実施していない。
