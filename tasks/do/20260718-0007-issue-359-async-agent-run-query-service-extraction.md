# Issue #359 Phase 4n: async-agent run query service 抽出

- 状態: do
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

- [ ] serviceはrun repositoryの`list`/`get`とnarrow auth portsだけに依存する。
- [ ] listはactor tenantのみを読み、self/managed filter、updatedAt降順、100件上限を維持する。
- [ ] getはcross-tenant/missingを`undefined`、same-tenant unauthorizedを403として非列挙順序を維持する。
- [ ] repositoryのnon-missing failureを隠さず伝播する。
- [ ] artifact list/getはauthorized runだけをprojectionし、missing semanticsを維持する。
- [ ] facade public/API/auth policy/create/cancel/execute/provider/writeback/RAG/schemaは非変更でdelegateになる。
- [ ] targeted/API full/root CI、docs generation/check、source audit、diff/pre-commit、GitHub CIが成功する。
- [ ] Draft stacked PR、semver、日本語AC/self-review、report/task done、Issue progressを記録する。

## Done条件・計画

1. query service unit testを先行追加し、authorization order/filter/sort/limit/error propagationを固定する。
2. narrow production serviceとfacade composition/delegateを実装する。
3. DES Phase4nとcanonical API-code docsを同期する。
4. targeted/API full/root CI/docs/source/pre-commitを成功させる。
5. implementation commit/push、Draft stacked PR、両head CI、task done/report/final comments/Issue progressを完遂する。

actual AWS/manual UIは対象外かつ未実施として記録する。merge/deploy/releaseは実行しない。
