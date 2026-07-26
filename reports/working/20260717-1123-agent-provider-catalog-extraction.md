# Issue #359 Phase 4d AgentProviderCatalogService 抽出 作業完了レポート

- 作成日時: 2026-07-17 11:23 JST
- Issue: #359
- branch: `codex/issue-359-agent-provider-catalog-extraction`
- stacked base: PR #397 final head `b9e6a707`
- 状態: draft PR #403 作成・初回 CI 成功・task 完了

## 受けた指示

PR #397 final head から Issue #359 を継続し、Issue と PR #383 / #390 / #393 / #397 の基準を確認したうえで、最小かつ独立した non-overlap の構造/service boundary 抽出を選び、worktree/task/実装/検証/draft PR/コメント/Issue 進捗まで完遂する。merge、deploy、release は行わず、AWS・benchmark・manual の未実施を正直に記録する。

## 要件整理と判断

- open PR #387 の chat/history/RAG、#393 の favorite、#397 の question、#383 の Taskfile alias と重ならない async-agent provider catalog を次の小単位に選んだ。
- provider 一覧・setting projection・作成時 definition lookup・実行時 adapter lookup は registry `list` / `get` だけで閉じる。
- run store、selection authorization、artifact/writeback、secret redaction、provider execute と result/compensation policy は facade に残す。
- 公開 101 method と provider public 2 signature、registry 順序、availability、credential mode、missing-registry fail-closed、create/execute lookup semantics を不変条件とした。

## 実施作業

- `AgentProviderCatalogService` と optional `Pick<AsyncAgentProviderRegistry, "list" | "get">` port を追加した。
- `MemoRagService` の provider public method、create、execute を同 service へ委譲した。
- narrow-port source guard、missing registry、availability 全 4 状態、projection、definition/adapter lookup の domain test を追加した。
- Phase 4a dependency characterization から facade direct `asyncAgentProviders` read を除き、direct read を 26 から 25 へ更新した。
- `DES_DLD_012.md` に Phase 4d boundary、保持 contract、残余 async-agent debt を追記した。
- canonical generator で 97 API / 582 文書を再生成し、297 generated file の source line/call graph 差分を同期した。

## 成果物

- `apps/api/src/async-agent/provider-catalog-service.ts`
- `apps/api/src/async-agent/provider-catalog-service.test.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service-contract.test.ts`
- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`
- `docs/generated/api-code/` canonical 差分
- `tasks/do/20260717-1110-issue-359-agent-provider-catalog-extraction.md`
- 本レポート

## 検証

成功:

- `node --import tsx --test apps/api/src/async-agent/provider-catalog-service.test.ts`
- `node --import tsx --test apps/api/src/rag/memorag-service-contract.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`（821 tests）
- `npm run build -w @memorag-mvp/api`
- `npm run docs:api-code`
- `npm run docs:openapi:check`（sandbox 外へ固定読み取り専用コマンドを権限委譲）
- `npm run docs:api-code:check`
- `task docs:check`
- `npm run rag:release:source-audit`（dataset-specific branch 0、artifact mismatch 0）
- `npm run ci`（API 821、Web 442、Infra 38、Benchmark 102 を含む全 workspace）
- `git diff --check`
- GitHub Actions run #29549928756（実装 head `fb6a4d19`）: 成功（8分38秒、promotion gate は skip）

修復履歴:

- 初回 typecheck は test fixture に `AgentRuntimeProvider` union 外の値と unchecked index があり失敗した。実在 `custom` provider と名前付き definition へ修正し、targeted test/typecheck/API full/root CI を再実行して成功した。
- 単独 OpenAPI check は sandbox 内で `tsx` Unix socket 作成が `EPERM` となった。同 check が `task docs:check` で成功したことを確認後、repository 手順どおり固定読み取り専用コマンドを sandbox 外で再実行して成功した。

## 指示への fit 評価

- provider catalog だけの独立 seam とし、favorite/question/history/chat/RAG/usage/admin/security policy の意味変更を入れていない。
- whole `Dependencies`、AWS client、global config、store、authorization を新 service へ渡していない。
- 公開 signature、availability、setting projection、adapter selection、missing-registry fail-closed を characterization と full CI で維持した。
- production 実装へ benchmark 期待語句、QA sample 固有値、dataset 固有分岐を追加していない。
- README/API example/運用/config/HTTP schema は不変のため手動更新不要。詳細設計と canonical generated docs は同期した。

## 未対応・制約・リスク

- real Claude Code/Codex/OpenCode/custom provider command、実 AWS、実 benchmark、manual UI は未実施。credential、費用、外部状態を伴うか本変更の provider catalog seam に非該当である。
- `npm ci` は既存 dependency graph に 8 vulnerability（low 2、moderate 1、high 5）を報告した。本タスクは lockfile を変更せず、依存更新は別途判断が必要である。
- generated docs は 297 file の機械更新を含み stacked PR 間で path conflict になり得る。base 順に merge/rebase し、最終 base で canonical generator を再実行する必要がある。
- async-agent run lifecycle、artifact/writeback、authorization、provider execution/result policy は facade に残る。後続で独立した security/data/compensation 単位として扱う。
- merge、deploy、release は指示どおり行わない。

## PR lifecycle

- draft stacked PR: #403 `♻️ Issue #359: provider catalog を narrow port へ抽出`
- base: `codex/issue-359-question-service-extraction`（PR #397）
- label: `semver:patch`
- 日本語 AC コメント: 記録済み
- 日本語セルフレビュー: blocking 指摘なしとして記録済み
- task: PR コメント後に `tasks/done/` へ移動
- task completion commit 後の final-head CI、Issue #359 進捗コメント、clean/upstream は post-completion check で確認する。
