# Issue #359 Phase 4d: AgentProviderCatalogService の narrow-port 抽出

- 状態: do
- タスク種別: 修正
- Issue: #359
- 対象 branch: `codex/issue-359-agent-provider-catalog-extraction`
- stacked base: `codex/issue-359-question-service-extraction`（PR #397 final head `b9e6a707`）

## 背景

Issue #359 Phase 4a / PR #390 は `MemoRagService` の 101 public method と 31 dependency key を characterization し、Phase 4b / PR #393 は favorite、Phase 4c / PR #397 は human question lifecycle を narrow-port service へ分離した。current stacked baseline では async-agent provider catalog の一覧・設定 projection と execution adapter 解決が facade 内に残り、`asyncAgentProviders` registry を直接参照している。

## 着手前 overlap 監査と選定理由

- PR #383 は Taskfile legacy alias、guard、README、repository-local skill の変更であり、API provider catalog と code path が重複しない。
- PR #390 は characterization の正本であり、本タスクはその 101 public method / dependency graph guard を継承する。
- PR #393 は favorite 3 public method と `FavoriteService`、PR #397 は question 7 public method と `QuestionService` を扱う。本タスクは #397 final head を stacked base とし、両 domain 実装には触れない。
- open PR #387 は chat/session-local evidence、conversation history、RAG retrieval/trace を変更するため、history/chat/debug/RAG は対象外にする。
- provider catalog boundary は `AsyncAgentProviderRegistry` の `list` / `get` と public setting projection に閉じられる。async-agent run store、authorization、artifact/writeback、provider execution orchestrationは facade に残し、現在の open PR 群との semantic overlap を最小化する。
- `memorag-service.ts` の行移動により canonical generated API docs は stacked PR と機械的競合し得る。生成物競合を PR に明記し、base 順に再生成する。

## なぜなぜ分析（軽量 RCA）

### 問題文

current stacked baseline の `MemoRagService` は provider definition 一覧、admin setting projection、provider adapter 解決を直接保持し、`asyncAgentProviders` dependency を facade 内から読む。公開 API、provider availability、credential mode、run の blocked/queued 判定、実行 adapter 選択は変えてはならない。

### confirmed

- public method は `listAgentRuntimeProviders` と `listAgentProviderSettings` の 2 件で、Phase 4a signature snapshot に固定されている。
- `createAsyncAgentRun` は runtime provider definition の availability を参照し、blocked/queued と failure reason を決定する。
- `executeAsyncAgentRun` は同じ registry から adapter を取得し、実 provider を実行する。
- provider registry の最小 capability は `list()` と `get(provider)` であり、store、AWS client、global config を必要としない。
- production fallback は registry 未設定時の empty list / unresolved adapter であり、mock provider 実行を作らない。

### inferred

- provider catalog と adapter resolution を表す明示 service boundary がなく、composition root が projection policy と registry lookup を直接保持したことが direct dependency の残存原因である。
- public 2 method だけを移して facade execution が registry を直接読むままにすると、同じ capability の ownership が二重化し、direct dependency は減らない。

### open_question

- async-agent run lifecycle、artifact persistence、writeback approval、current authorization を同じ service へ移すかは本タスクでは決定しない。security/data/compensation を伴うため後続の独立 unit とする。
- provider registry 自体の adapter/plugin architecture は変更しない。

### root cause と対策対応

- 根本原因: provider definition projection と adapter resolution の capability が domain boundary として表現されず、facade が registry を直接操作している。
- 対策: `AgentProviderCatalogService` に optional registry の narrow port だけを注入し、一覧、setting projection、definition/adapter lookup を集約する。facade public method と create/execute caller は同 service へ委譲する。
- 効果指標: 101 public method snapshot 不変、`asyncAgentProviders` の facade direct read 0、facade direct dependency read は 26 から 25、provider characterization/full API/root CI/docs freshness が成功する。

## 目的

- provider catalog と adapter resolution を narrow-port `AgentProviderCatalogService` へ抽出する。
- `MemoRagService` の公開 signature と async-agent run behavior を維持する。
- favorite/question/history/chat/RAG/usage/admin/resource governance へ意味的変更を加えない。

## Scope

### In scope

- `AgentProviderCatalogService` と registry-only port の追加
- provider public 2 method、create 時 definition lookup、execute 時 adapter lookup の委譲
- provider availability / credential-mode / missing-registry / adapter-resolution characterization test
- Phase 4a dependency guard と `DES_DLD_012.md` の同期
- canonical source-backed API docs の同期

### Out of scope

- async-agent run persistence、authorization、artifact、writeback、budget、workspace mount、execution result policy
- provider adapter/command implementation、secret redaction、environment/config
- route、HTTP schema、permission、Web UI、infra、benchmark、RAG/chat/history/favorite/question/usage/admin
- merge / deploy / release

## 実施計画

1. registry-only provider contract を domain test に固定する。
2. narrow-port service を追加し、definition/setting/adapter lookup を移す。
3. facade は public signature と run lifecycle を変えず service へ委譲する。
4. Phase 4a contract、targeted/full API、docs freshness、source audit、root CI で回帰を検証する。
5. report、commit、draft stacked PR、semver、AC/self-review、task done、final-head CI、Issue コメントまで完遂する。

## ドキュメント保守計画

- `DES_DLD_012.md` に Phase 4d provider catalog boundary、保持 contract、残余 async-agent debt を追記する。
- HTTP/UI/運用/config は不変のため README、API examples、OpenAPI 本文の手動更新は不要とし、freshness/docs check で確認する。
- source-backed API docs は canonical generator の正規差分だけを同一 PR で同期する。

## 受け入れ条件

- [x] AC1: `AgentProviderCatalogService` が whole `Dependencies` / AWS client / global config ではなく optional `AsyncAgentProviderRegistry` の `list` / `get` capability だけを受ける。
- [x] AC2: `MemoRagService` の provider public 2 method name/signature、route/consumer compile contract、PR #390 の 101 public method snapshotが不変である。
- [x] AC3: provider definition、setting credential mode、missing registry fallback、create availability判定、execute adapter解決を domain test と既存 async-agent test で維持する。
- [x] AC4: async-agent authorization/store/artifact/writeback/execution result、HTTP/schema/permission、favorite/question/history/chat/RAG/usage/admin に挙動変更がない。
- [x] AC5: targeted/full API、API typecheck/build、root `npm run ci`、OpenAPI/API code docs freshness、source audit、`task docs:check`、`git diff --check`、pre-commit が成功する。
- [x] AC6: `DES_DLD_012.md`、task、作業レポートが実装・検証・generated docs 競合・real provider/AWS/benchmark/manual 未実施リスクと同期する。
- [ ] AC7: 日本語 draft stacked PR、`semver:patch`、AC/self-review/final-head CI/Issue progress、task done lifecycle、clean/upstream を完了する。

## 実施結果（PR 前）

- `AgentProviderCatalogService` へ optional registry の `list` / `get` だけを注入し、runtime provider 一覧、setting projection、create-time definition lookup、execution-time adapter lookup を移した。
- `MemoRagService` の public method 数 101 と compiler-resolved signature snapshot は不変。facade の `asyncAgentProviders` direct read は 0、全 direct read は 26 から 25 になった。
- provider availability 全 4 状態、missing registry、順序、credential mode、definition / adapter lookup を新規 domain test で固定した。
- canonical API-code generator は 97 API / 582 文書を生成し、source line/call graph 由来で 297 generated file が機械更新された。
- targeted service/contract、API full 821 tests、API typecheck/build、OpenAPI/API-code freshness、`task docs:check`、source audit、root CI が成功した。OpenAPI 単独 check は sandbox 内の `tsx` Unix socket が `EPERM` になったため、固定読み取り専用コマンドを権限委譲して再実行し成功した。
- real provider command、AWS、実 benchmark、manual UI は未実施。provider adapter を呼ばない fake registry characterization と全 CI で境界回帰を確認した。

## 検証計画

- `node --import tsx apps/api/src/async-agent/provider-catalog-service.test.ts`
- `node --import tsx apps/api/src/rag/memorag-service-contract.test.ts`
- async-agent provider/run を含む既存 `memorag-service.test.ts` は authoritative package script で実行
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`
- `npm run build -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `npm run docs:api-code:check`
- `task docs:check`
- `npm run rag:release:source-audit`
- `npm run ci`
- `git diff --check`
- `pre-commit run`

## PR セルフレビュー観点

- public signatures、availability/failure reason、credential-mode projection、adapter selection が不変か。
- subservice に whole `Dependencies`、AWS client、config、object store、authorization を渡していないか。
- missing registry/provider を mock success に変換していないか。
- #383/#390/#393/#397 と #387 の semantic/code scope を取り込んでいないか。
- canonical generated docs と詳細設計が実装に同期しているか。
- benchmark期待語句、QA sample固有値、dataset固有分岐が実装へ混入していないか。

## リスク

- source line/call graph の変更で `docs/generated/api-code/` が広範に機械更新され、stacked PR と path conflict が発生し得る。semantic code overlap と分けて PR に記録し、stacked base 順に generator を再実行する。
- provider catalog の service 化後も run lifecycle は facade に残る。provider service を run service と誤認しないよう boundary と残余 debt を docs に明記する。
- real provider command、AWS、benchmark、manual UI は外部状態・credential・費用を伴うか本変更に非該当のため未実施とし、fake provider を使う full CI と GitHub Actions で回帰を検証する。
