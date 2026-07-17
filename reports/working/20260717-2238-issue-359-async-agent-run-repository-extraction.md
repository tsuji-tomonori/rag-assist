# Issue #359 Phase 4l async-agent run repository 抽出 作業完了レポート

## 受けた指示

- PR #431 Phase 4k の確定 head から Issue #359 の残存 debt を再監査し、安全で非重複な bounded unit があれば継続する。
- 認可境界、tenant fail-closed、production no-mock を維持し、worktree/task/commit/Draft stacked PR/日本語コメント/検証 lifecycle を完遂する。
- merge、deploy、release は実行しない。

## 要件整理

- async-agent execute/auth/writeback 全体は provider 外部副作用、artifact compensation、owner policyを横断するため本 unit から除外した。
- object-store だけで閉じる run metadata の list/get/save、key mapping、legacy normalization、tenant integrity、legacy migration detection を `AsyncAgentRunRepository` へ抽出する。
- facade public signature、route/RBAC/non-enumeration、create/cancel/execute の順序・結果、provider/artifact writeback、schema、RAG trust を変更しない。
- narrow port、tenant isolation、strict list allowlist、missing/legacy/non-missing error、save mapping を直接 unit test する。

## 検討・判断

- tenant 所有権を確定できない legacy unscoped object は自動移行・削除せず、現行どおり migration-required error で fail closed にした。
- malformed JSON の schema補完、list中の個別 read failure skip、save時の追加 validation は behavior change になるため導入しなかった。
- run metadata と同じ namespace を使う artifact storage は対象外として facade に維持し、helper名だけ `asyncAgentArtifactPrefix` へ明確化した。key値は不変である。
- GitHub open PR #339（usage/admin）、#387（chat/history/RAG）、#432（document share tenant）とは production source が重ならない。canonical generated docs の機械差分だけは stacked baseline の line/call graph変化として発生する。

## 実施作業

- `apps/api/src/async-agent/async-agent-run-repository.ts` を追加し、`Pick<ObjectStore, "listKeys" | "getText" | "putText">` の narrow portで list/get/save を実装した。
- exact tenant-hashed prefix、flat JSON allowlist、encoded run ID、legacy defaults、tenant mismatch fail-closed、legacy migration detection、missing variant判定、canonical JSON saveを移管した。
- `apps/api/src/async-agent/async-agent-run-repository.test.ts` に8 characterization testを追加した。
- `MemoRagService` constructorで repositoryをcomposeし、11か所のrun metadata load/save callをdelegateへ置換した。private object-store helperとrun key/normalize/integrity helperを削除した。
- `DES_DLD_012.md` に Phase 4l の境界、ports、key/list/integrity/legacy contract、非対象とactual AWS gapを追記した。
- canonical API-code docsを再生成した（97 APIs / 582 documents、facade line/call graph由来で286 generated filesを更新）。

## 成果物

- async-agent run repository production module / unit tests
- facade composition/delegation
- Phase 4l 詳細設計更新 / canonical generated docs
- task: `tasks/do/20260717-2211-issue-359-async-agent-run-repository-extraction.md`
- 本レポート

## 検証結果

- `npm ci`: 成功。既存8 vulnerabilities（2 low / 1 moderate / 5 high）を報告。dependency変更なし。
- repository + facade contract targeted tests: 2/2 成功。
- async-agent facade characterization: 成功。
- targeted ESLint: 成功。
- API typecheck: 成功。
- API full suite: 879/879 成功（新規8 testを含む）。
- root `npm run ci`: 成功。API 879、Web 442、Benchmark 102、全workspace lint/typecheck/test/build成功。既存 Vite chunk-size warningのみ。
- `task docs:api-code`: 成功（97 APIs / 582 documents）。
- `task docs:check`: 成功。
- `npm run rag:release:source-audit`: 成功（dataset-specific branch 0、artifact manifest mismatch 0）。
- `git diff --check`: 成功。
- staged pre-commit: 成功。
- implementation-head GitHub Actions: 成功（8m48s、run `29585023213`）。promotion gateは設計どおりskipped。
- final-head GitHub Actionsはtask done lifecycle commit後に記録する。

## 指示への fit 評価

- bounded unit: run metadata persistenceだけを complete repository responsibilityとして抽出し、async-agent外部実行やowner判断へ拡張していない。
- security: raw tenantをkeyへ出さず、same-ID tenant分離、strict list filter、decoded tenant mismatch、legacy presence、operational errorをfail closedで固定した。
- compatibility: public API、route/RBAC、non-enumeration、authorization/side-effect order、schemas、artifact key値を変更していない。
- no mock: production fallback、架空 provider/artifact/user/dataset固有分岐を追加していない。
- workflow: PR #431 exact final headから専用worktree/taskで開始し、検証・report後にDraft stacked PR lifecycleへ進む。

## 未対応・制約・リスク

- actual S3/AWS、legacy migration tooling、manual UIは未実施。local/GitHub CIをactual AWS成功の代替とは扱わない。
- legacy unscoped objectのowner決定・migration/deleteはoperations/owner policyが必要であり、本unitではfail-closed errorのまま残す。
- facadeにはasync-agent create/execute/cancel、current authorization、provider invocation、artifact persistence/writeback/cleanupが残る。次の抽出はside-effect/compensation単位の再監査が必要である。
- canonical generated docsはfacade line/call graph変更により多数の機械差分を含む。
- stacked PRはIssue #359既存chainとPR #431を先に必要とする。

## PR lifecycle

- implementation commit: `893456885f19a56ecd16dd1fc0802f5e7073db9e`
- Draft stacked PR: #433
- base/head: `codex/issue-359-benchmark-run-creation-extraction` → `codex/issue-359-async-agent-run-repository-extraction`
- `semver:patch`: 付与済み
- 日本語AC comment: `issuecomment-5003909093`
- 日本語self-review comment: `issuecomment-5003910438`（blocking指摘なし）
- implementation-head CI: success
- final-head CI、final AC/self-review/verification、Issue #359 progressはlifecycle commit push後に外部証跡として記録する。
