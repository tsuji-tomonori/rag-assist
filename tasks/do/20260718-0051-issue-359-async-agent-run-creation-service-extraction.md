# Issue #359 Phase 4o: async-agent run creation service 抽出

- 状態: do
- Issue: #359
- stacked base: PR #436 / `codex/issue-359-async-agent-run-query-service-extraction`
- exact base: `30f98a7ca9e9091f796d7ba9c814e9d7378dfce2`

## 目的・スコープ

async-agent runのcreate orchestrationだけをnarrow `AsyncAgentRunCreationService`へ抽出する。selection authorizationを最初に実行し、provider availability、canonical run snapshot、dedupe/read-only mounts、queued/blocked no-mock state、durable saveを不変とする。

対象外: selection authorization実装、list/get/cancel/execute/current worker authorization、provider execution、artifact persistence/cleanup、writeback、route/schema、AWS/IAM、UI、merge/deploy/release。

## なぜなぜ分析

### confirmed

- 現行createはselection authorization完了後にclock/run ID/provider lookup/dedupe/mount ID/saveを実行する。
- provider availableはqueued、disabled/not_configuredはblocked + `not_configured`、unknown/unavailableはblocked + `provider_unavailable`で、mock execution/artifactを作らない。
- tenantは現行`user.tenantId ?? "default"`、requester identity/groupsはverified actor snapshot、workspace/mountはgenerated IDsとselected IDsから構築する。
- save failureはそのまま伝播し、runを返さない。
- open PR #432/#434のproduction sourceとは非重複。#339は同じ巨大facadeを含むため機械的競合余地を明記する。

### inferred / root cause

canonical create mappingとauthorization/provider/store orchestrationが巨大facadeに残り、no-mock blocked contractとeffect orderを独立して検証できない。

### open_question / decision

- selection authorizationはfacade callbackとして注入し、document/folder permission policyを本unitで移動・再定義しない。
- providerはdefinition lookup callbackだけを受け、adapter/executionをserviceへ渡さない。
- tenant fallbackを含む現行create behaviorをcharacterizationし、本unitでauthoritative policy変更を行わない。

## 受け入れ条件

- [ ] serviceはauthorize/provider lookup/run save/clock/ID/tenantのnarrow portsだけに依存する。
- [ ] selection authorizationをclock/ID/provider/saveより先に実行し、denial後のeffectを止める。
- [ ] available/disabled/not_configured/unavailableごとのqueued/blocked reason/no-mock contractを維持する。
- [ ] actor tenant/requester snapshot、unique selections、workspace/read-only mount mapping、timestampsを維持する。
- [ ] save failureを隠さず伝播し、false successを返さない。
- [ ] facade public/API/auth policy/list/get/cancel/execute/provider execution/writeback/RAG/schemaは非変更でdelegateになる。
- [ ] targeted/API full/root CI、docs generation/check、source audit、diff/pre-commit、GitHub CIが成功する。
- [ ] Draft stacked PR、semver、日本語AC/self-review、report/task done、Issue progressを記録する。

## Done条件・計画

1. creation service unit testを先行追加し、effect orderとcanonical mappingを固定する。
2. narrow production serviceとfacade composition/delegateを実装する。
3. DES Phase4oとcanonical API-code docsを同期する。
4. targeted/API full/root CI/docs/source/pre-commitを成功させる。
5. implementation commit/push、Draft stacked PR、両head CI、task done/report/final comments/Issue progressを完遂する。

actual AWS/manual UIは対象外かつ未実施として記録する。merge/deploy/releaseは実行しない。
