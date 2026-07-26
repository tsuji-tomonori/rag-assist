# Issue #358 FR-049 enabled tool permission vocabulary integrity 作業完了レポート

- 実施日時: 2026-07-18 03:37–04:06 JST
- 対象 branch: `codex/issue-358-fr049-tool-permission-vocabulary`
- stacked base: `codex/issue-358-fr002-ingest-progress-truth` / `0fef0461bf4d091aedca1d7210007dee8f3c9614`
- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/441
- 実装 commit: `c603be81`

## 受けた指示

Issue #358 の次の非重複・最小 unit を監査し、worktree / task md / RCA / tests-first / 実装 / 検証 / Draft stacked PR / 日本語コメント / CI / Issue 進捗まで完遂する。完了条件を満たすまで完了と報告せず、実施していない検証を実施済みと書かない。

## 要件整理

- enabled graph-backed RAG tool の `requiredFeaturePermission` を正規 `ApplicationPermission` 語彙へ限定する。
- 現行 sync / async chat authorization boundary と同じ `chat:create` を 12 tool で明示する。
- unknown permission を helper default から生成できないようにする。
- catalog membership、`CHAT_USER` grant、exact `chat:create` boundary を regression test で固定する。
- full per-tool executor / feature-resource denial / denial trace の実装完了とは扱わない。
- disabled future placeholder、public schema、route、role catalog、worker、resource authorization、UI、infra、data を変更しない。

## 検討・判断

read-only 監査で、enabled 12 tool のうち 5 tool が helper default の `rag:run` を継承し、同 permission が `ApplicationPermission` catalog に存在しないことを確認した。現行 enabled tool は独立 executor ではなく chat orchestration graph の trace projection であり、route / service / worker が要求する `chat:create` が現実装と一致する feature metadata である。

disabled future placeholder まで current catalog へ丸めると未実装機能の設計を先取りし、public schema を enum 化すると API compatibility に影響する。このため、enabled `ragTool` helper のみを canonical type と explicit argument へ狭め、disabled helper と schema は維持した。

## 実施作業

- tests-first で catalog / role grant / exact boundary regression を追加し、修正前に次の 5 tool の failure を再現した。
  - `rag.rerank`
  - `rag.select_final_context`
  - `rag.validate_citations`
  - `rag.verify_answer_support`
  - `rag.repair_supported_only`
- `ragTool` の `requiredFeaturePermission` を default なしの `ApplicationPermission` 必須引数へ変更した。
- enabled tool 12 件に `chat:create` を明示した。
- FR-049 の stale な Phase F-pre 記述を現行実装へ同期し、runtime enforcement の残差を明記した。
- task md に confirmed / inferred / conflict / open_question、RCA、rollback、AC、検証証跡を記録した。
- Draft stacked PR #441 を作成し、`semver:patch`、日本語本文、受け入れ条件、セルフレビュー、検証コメントを付与した。

## 成果物

- `apps/api/src/chat-orchestration/tool-registry.ts`
- `apps/api/src/chat-orchestration/tool-registry.test.ts`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/08_チャット内オーケストレーション/REQ_FUNCTIONAL_049.md`
- `tasks/done/20260718-0337-issue-358-fr049-tool-permission-vocabulary.md`
- 本レポート
- Draft PR #441 と日本語 AC / self-review / verification comments

## 検証結果

- targeted registry test: tests-first failure 後、5/5 pass。
- contract tests: 4/4 pass。
- API ESLint / typecheck / build: pass。
- API full coverage: 917/917 pass、Statements 90.69%、Branches 80.3%、Functions 93.47%、Lines 90.69%。
- `task docs:check`: canonical docs、OpenAPI、source-backed API docs（98 APIs / 588 docs）、web trace、inventories、hidden Unicode checks が pass。generated docs 差分なし。
- `task verify`: lint、全 workspace typecheck、全 workspace build が pass。
- `npm run rag:release:source-audit`: `datasetSpecificBranchCount=0`、`artifactManifestMismatchCount=0`、audit ID `sha256:346492d9c24842dd25687bfe03e3def6fbc8e544687835f0bd6fd7df52a8cc7f`。
- `npm run ci`: pass。API 917/917、web 444/444 を含む。
- changed-file pre-commit / `git diff --check`: pass。
- implementation-head GitHub Actions: run https://github.com/tsuji-tomonori/rag-assist/actions/runs/29605782792 が 8分30秒で success。

## セキュリティ・セルフレビュー

- route、authentication、request/response schema、role catalog、sync/async worker、search-scope resource authorization、trace redaction に差分はない。
- feature permission metadata を現行 boundary と一致させ、認可を広げる変更はない。
- RAG retrieval / grounding / citation / support verification の runtime behavior は変更していない。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を追加していない。
- blocking 指摘なし。

## 指示への fit 評価

対象は full executor 実装前の permission vocabulary prerequisite に限定し、Issue #358 の別 Draft PR と重複しない bounded unit とした。tests-first、正規 docs 同期、全体検証、security review、stacked Draft PR、日本語 evidence を揃えた。public API / UI / infra / data を広げず、残る runtime enforcement を完了と誤記していない。

## 未対応・制約・リスク

- per-tool executor、feature/resource permission の実行時拒否、denial trace、approval UI、専用 invocation store は未実装であり、Issue #358 の後続範囲である。
- disabled future placeholder に `rag:run` が 1 件残る。非 executable metadata として本 unit の対象外であり、実装時に permission contract を決める必要がある。
- actual AWS、browser E2E、deploy、release、merge は対象外のため未実施。
- GitHub Apps の callable tool が実行環境に公開されていなかったため、規定 fallback の `gh` を使用した。
- lifecycle commit 後の final-head CI、Issue #358 進捗コメント、local/upstream/remote clean readback は本レポート作成後に実施し、PR top-level comment へ最終証跡を残す。
