# Issue #359 Phase 4n: async-agent run query service 抽出

- 状態: done
- Issue: #359
- stacked base: PR #435 / `codex/issue-359-async-agent-artifact-repository-extraction`
- exact base: `a988f8e734174bb16349a539f30a40f0ca471dc0`

## 目的・スコープ

async-agent run の read-only query（list/get/artifact list/artifact get）だけを narrow `AsyncAgentRunQueryService` へ抽出する。facade public API、tenant partition、self/managed permission、cross-tenant non-enumeration、repository error propagationを不変とする。

対象外: create、cancel、execute、provider、current worker authorization、selection authorization、artifact persistence/cleanup、writeback、route/schema、AWS/IAM、UI、merge/deploy/release。

## なぜなぜ分析

### confirmed

- list は authoritative actor tenant の runs だけを読み、self または `agent:read:managed` で filter、updatedAt 降順、最大100件を返す。
- get は actor tenant partition に対象がなければ `undefined`、same-tenant で read不可なら `403 Forbidden`、repository errorは伝播する。
- artifact query は authorized get の結果だけを projectionし、run/artifact missing は `undefined` である。
- open PR #432/#434 の production source は document permission service で非重複。#339 は同じ巨大 facade を含むため機械的競合余地を明記する。

### inferred / root cause

repositoryを抽出済みでも、read projectionとauthorization orderが巨大facadeに残り、非列挙とfilter/sort/limitの契約を独立して検証できない。

### open_question / decision

- `canRead` と authoritative tenant resolver は既存 facade logicをnarrow portsとして注入し、本unitでRBAC policyを再定義しない。
- cancel/execute/writebackはwrite/state/security policyを含むため同時に移動しない。

## 受け入れ条件

- [x] serviceはrun repositoryの`list`/`get`とnarrow auth portsだけに依存する。
- [x] listはactor tenantのみを読み、self/managed filter、updatedAt降順、100件上限を維持する。
- [x] getはcross-tenant/missingを`undefined`、same-tenant unauthorizedを403として非列挙順序を維持する。
- [x] repositoryのnon-missing failureを隠さず伝播する。
- [x] artifact list/getはauthorized runだけをprojectionし、missing semanticsを維持する。
- [x] facade public/API/auth policy/create/cancel/execute/provider/writeback/RAG/schemaは非変更でdelegateになる。
- [x] targeted/API full/root CI、docs generation/check、source audit、diff/pre-commit、implementation-head GitHub CIが成功した。final-head CI結果はPRの最終検証コメントへ記録する。
- [x] Draft stacked PR #436、`semver:patch`、日本語AC/self-review、report/task doneを記録した。Issue progressはfinal-head監査後にIssueへ記録する。

## 完了証跡

- implementation commit: `7939c80c353ea7b79c5b9ae37989d0884476987a`
- Draft PR: #436 / base PR #435 exact `a988f8e734174bb16349a539f30a40f0ca471dc0`
- initial AC: `issuecomment-5004837037`
- initial self-review: `issuecomment-5004837237`
- implementation-head CI: success（7分24秒、run `29592276195`、promotion gate skipped）

## Done条件・計画

1. query service unit testを先行追加し、authorization order/filter/sort/limit/error propagationを固定する。
2. narrow production serviceとfacade composition/delegateを実装する。
3. DES Phase4nとcanonical API-code docsを同期する。
4. targeted/API full/root CI/docs/source/pre-commitを成功させる。
5. implementation commit/push、Draft stacked PR、両head CI、task done/report/final comments/Issue progressを完遂する。

actual AWS/manual UIは対象外かつ未実施として記録する。merge/deploy/releaseは実行しない。
