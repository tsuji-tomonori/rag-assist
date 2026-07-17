# Issue #358 FR-049 enabled tool permission vocabulary integrity

- 保存先: `tasks/do/20260718-0337-issue-358-fr049-tool-permission-vocabulary.md`
- 状態: in_progress
- タスク種別: 修正
- stacked base: PR #440 final head `0fef0461bf4d091aedca1d7210007dee8f3c9614`

## 背景

Issue #358 P1-A は、tool 単位の permission 宣言を runtime で強制し、拒否 trace を残すことを追跡している。PR #440 後の read-only 監査で、現行 enabled RAG tool registry の feature permission metadata に、正規 `ApplicationPermission` catalog に存在しない `rag:run` が含まれることを確認した。full per-tool executor / denial trace の前提として、まず enabled graph-backed tool の公開 metadata を現行 chat authorization boundary と同じ正規語彙へ限定する。

## 目的

enabled graph-backed RAG tool の `requiredFeaturePermission` を compile-time に正規 `ApplicationPermission` へ限定し、全 tool が実際の sync / async chat boundary と同じ `chat:create` を明示するよう修正する。未知 permission を default で生成できない構造と regression test を追加し、FR-049 にこの bounded prerequisite と残る runtime enforcement scope を記録する。

## 対象範囲

- `ragTool` helper の feature permission type / explicit argument
- enabled RAG tool 12 件の canonical `chat:create` 宣言
- enabled tool permission の catalog validity / `CHAT_USER` grant regression tests
- FR-049 の現状・受け入れ evidence・残差境界
- 必要な generated API docs の freshness 確認
- work report、Draft stacked PR、two-head CI、Issue progress、clean / upstream / remote lifecycle

対象外:

- tool executor、tool 選択 API、disabled placeholder の実装
- approval UI / approval workflow、専用 invocation store
- per-tool runtime denial / denial trace の新規実装
- resource permission / search-scope policy の再設計
- route、request/response schema、API shape、Cognito role grant の変更
- actual AWS、scanner、migration、retention、owner policy
- merge、deploy、release

## なぜなぜ分析 / RCA

### 問題文

`CHAT_TOOL_DEFINITIONS` の enabled tool 12 件のうち 5 件が、正規 `ApplicationPermission` catalog に存在しない `rag:run` を `requiredFeaturePermission` として公開している。現行 schema / type / test は non-empty string だけを要求するため、runtime enforcement を追加した場合に正規 role grant と一致しない metadata が拒否判断へ流入し得る。

### confirmed

- `ragTool` helper の `requiredFeaturePermission` default は `"rag:run"` である。
- `rag.rerank`、`rag.select_final_context`、`rag.validate_citations`、`rag.verify_answer_support`、`rag.repair_supported_only` の 5 件は explicit argument を持たず default を継承する。
- `ApplicationPermission` / `ROLE_PERMISSION_CATALOG` / `UNASSIGNED_APPLICATION_PERMISSIONS` に `rag:run` は存在しない。
- sync `/chat` と async `/chat-runs` は `chat:create` を route で要求し、service / worker は `chat:create` と search-scope resource authorization を boundary ごとに再検証する。
- `CHAT_USER` は `chat:create` と検索に必要な read/search permission を持つ。
- current test は enabled definition の `requiredFeaturePermission.length > 0` だけを確認し、catalog membership を検証しない。
- open #358 Draft に `requiredFeaturePermission` vocabulary を所有する PR はない。PR #338 の旧 tool-registry 変更は session-local evidence の trace mapping 1 行であり、本 permission helper を変更しない。

### inferred

- enabled graph-backed tool は独立 executor ではなく、同一 chat orchestration 内の trace projection であるため、現行 feature boundary と同じ `chat:create` が正しい metadata である。
- `ragTool` helper だけを `ApplicationPermission` で型付けし explicit argument を必須化すれば、disabled future placeholder の未成立 permission 語彙を本 unit へ巻き込まず、実行可能 tool の再発を compile-time に防げる。
- catalog-validity と `CHAT_USER` grant の runtime test を併用すると、type assertion や catalog change による drift も検出できる。

### conflict

- 本 unit で per-tool resource permission enforcement を追加する案は、resource target/context と denial trace contract が未設計であり、既存 search-scope authorization と二重化または誤拒否するため不採用。
- disabled placeholder の future permission 名をすべて現 catalog へ丸める案は、未実装 feature の設計決定を先取りするため不採用。
- public schema を canonical enum へ狭める案は disabled future metadata と API compatibility に影響するため不採用。

### open_question

- 将来の executable non-RAG tool が feature permission、resource target、approval、denial trace をどの executor contract で強制するかは未確定。
- disabled placeholder の permission 名を current catalog へ登録するか、実装時に置換するかは各 feature の後続 decision とする。

### 因果と根本原因

- 発生: registry 基盤で future-facing permission 名を helper default として置き、現行 authorization catalog と接続しなかった。
- 流出: `requiredFeaturePermission` が plain string で、test も non-empty だけを確認したため、未知値を検出できなかった。
- 根本原因: executable/enabled definition と future/disabled metadata の permission maturity を型で分離せず、enabled tool の permission を正規 catalog と照合する gate がなかったこと。
- 全範囲対策: enabled helper の canonical type、explicit permission、catalog/grant regression、FR-049 residual boundary を一組で追加する。

## Rollback 境界

- rollback は `ragTool` type/arguments、registry tests、FR-049 docs を一括で戻す。
- API shape、role catalog、runtime authorization、data / infra を変更しないため migration / data rollback は不要。
- rollback 後は enabled tool が未知 `rag:run` metadata を再び公開できる。

## 実行計画

1. enabled definition の `rag:run` と catalog/grant drift を再現する regression test を先に追加する。
2. `ragTool` permission を canonical type / explicit argument へ変更し、全 enabled tool を `chat:create` へ統一する。
3. FR-049 に prerequisite 完了と full per-tool enforcement の残差を明記する。
4. targeted / full validation、security self-review、report、purpose-separated commits、Draft stacked PR、two-head CI、Issue progress、remote lifecycle を完遂する。

## ドキュメント保守計画

- FR-049 の古い Phase F-pre 記述を現実装へ同期し、enabled metadata vocabulary の成立と runtime enforcement 未完を混同しない。
- public API shape / schema 非変更のため OpenAPI 内容変更は原則不要。公式 docs freshness task の結果に差分があれば source-backed generated docs だけを同期する。
- README、operation、infra、Web docs は利用手順・運用・UI 非変更のため更新不要か最終差分後に再確認する。

## 受け入れ条件

- [x] AC1: PR #440 後の Issue / open PR / code / tests / docs を read-only 監査し、非重複の最小 prerequisite unit として vet する。
- [x] AC2: confirmed / inferred / conflict / open_question、原因、影響、rollback 境界を実装前に記録する。
- [x] AC3: `ragTool` が default permission を持たず、explicit canonical `ApplicationPermission` を要求する。
- [x] AC4: enabled graph-backed tool 12 件が `chat:create` を明示し、5 件の `rag:run` regression が解消する。
- [x] AC5: test が enabled tool の feature permission を正規 catalog と照合し、`CHAT_USER` grant を確認する。
- [x] AC6: disabled placeholder、API shape/schema、route、role catalog、sync/async worker、search-scope resource authorization を変更しない。
- [x] AC7: FR-049 が metadata vocabulary prerequisite の成立と、per-tool executor / resource denial / denial trace の未完を区別する。
- [x] AC8: targeted registry/contract/API tests、API lint/typecheck/full coverage/build、docs checks、task verify、source audit、root CI、pre-commit / diff check を成功させる。
- [x] AC9: security review で認証・route permission・resource scope・sensitive trace・role grant が弱まっていないことを確認する。
- [ ] AC10: report、目的別 commit、Draft stacked PR、`semver:patch`、日本語 body / AC / self-review / verification、two-head CI、Issue #358 progress を完遂する。
- [ ] AC11: local HEAD / upstream / remote 一致と clean worktree を確認し、対象外・未実施事項を記録する。

## Done 条件

- AC1〜AC11 の deliverables と validation evidence が揃い、catalog にない permission を enabled / executable metadata として扱わない。
- current route / worker / search-scope authorization を変更せず、full per-tool runtime enforcement を完了と誤表現しない。
- docs と実装、変更範囲に見合う tests、RAG 根拠性・認可境界、dataset 固有分岐不在をセルフレビューする。
- lifecycle commit 後に final-head CI と external evidence を確認する。

## 検証計画

- direct: `tool-registry.test.ts`、chat tools API contract / route tests。
- API: lint、typecheck、full coverage、build。
- docs: source-backed API docs / OpenAPI / canonical docs freshness、`task docs:check`。
- repository: `task verify`、source audit、`npm run ci`、pre-commit、diff check。
- remote: implementation head / final head GitHub Actions。

## PR レビュー観点

- enabled tool の permission が正規 `ApplicationPermission` と current `chat:create` boundary に一致するか。
- compile-time type と runtime regression test が未知値の再流入を防ぐか。
- disabled future placeholder や public schema を意図せず狭めていないか。
- route / worker / resource scope / debug trace disclosure を変更していないか。
- per-tool runtime denial / audit trace を実装済みと誤記していないか。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を追加していないか。

## リスク

- metadata correction 自体は runtime behavior を変えないため、full per-tool enforcement gap は残る。FR-049 と PR で明示する。
- `ApplicationPermission` catalog の将来変更時は enabled tool type/test が意図的に fail し、明示的な見直しが必要になる。
- PR #440 への stacked Draft のため、base 更新時は tool registry / FR-049 の conflict を再確認する。

## 実装・検証証跡

- tests-first: 新規 regression test は実装修正前に 5 tool（`rag.rerank`、`rag.select_final_context`、`rag.validate_citations`、`rag.verify_answer_support`、`rag.repair_supported_only`）を failure として検出し、修正後は 5/5 pass した。
- API full coverage: 917/917 pass、Statements/Lines 90.69%、Branches 80.3%、Functions 93.47%。
- `task verify`: lint、全 workspace typecheck、全 workspace build が成功した。
- `task docs:check`: canonical docs、OpenAPI、source-backed API docs、web trace、inventory、hidden Unicode checks が成功し、generated docs 差分はなかった。
- `npm run rag:release:source-audit`: `datasetSpecificBranchCount=0`、`artifactManifestMismatchCount=0`、audit ID `sha256:346492d9c24842dd25687bfe03e3def6fbc8e544687835f0bd6fd7df52a8cc7f`。
- `npm run ci`: lint、全 workspace typecheck/test/build が成功した（API 917/917、web 444/444 を含む）。
- security review: route、認証、request/response schema、role catalog、worker、search-scope authorization、trace redaction の差分はない。enabled helper のみ canonical type に狭め、disabled future placeholder の 1 件の `rag:run` は非 executable metadata として対象外のまま保持した。
- docs review: FR-049 の stale な未実装記述を現状へ同期した。README / operation / infra / web docs は public API、利用手順、運用、UI の変更がないため更新不要と判断した。
