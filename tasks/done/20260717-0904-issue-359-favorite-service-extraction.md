# Issue #359 Phase 4b: FavoriteService の narrow-port 抽出

- 状態: done
- タスク種別: 修正
- Issue: #359
- 対象 branch: `codex/issue-359-favorite-service-extraction`
- stacked base: `origin/codex/issue-359-service-characterization`（PR #390 final head `b599898c`）

## 背景

`MemoRagService` は 101 個の公開メソッドと 31 個の `Dependencies` key を持ち、store-centric な favorite 操作も巨大 facade の本体に直接実装されている。Issue #359 Phase 4a / PR #390 は公開 contract と依存グラフを characterization し、最初の抽出候補として favorites / history を挙げた。本タスクはそのうち #387 と公開 contract overlap がない favorite だけを、挙動を変えず narrow-port subservice へ抽出する。

## 着手前 overlap 監査と選定理由

- PR #390 は contract test / snapshot / `DES_DLD_012.md` のみで service 本体を変更していない。本タスクは #390 を stacked base とし、その contract guard を継承する。
- PR #387 は session-local evidence の RAG 統合に加え、conversation history の公開 contract を変更する。したがって `save/list/deleteConversationHistory` は本タスクから除外する。
- PR #339 は usage/cost 実装を `memorag-service.ts` / test へ追加するが、favorite の保存・可視性判定とは意味的に独立している。usage tracking、pricing、admin cost は変更しない。
- Phase 1〜3 の contract shim、Web root shim、unused primitive、Taskfile alias、benchmark 正本化、ConfirmDialog、API transport ADR、Icon/LoadingSpinner は既に別 PR で扱われているため重複させない。
- favorite は `FavoriteStore`、`ConversationHistoryStore` と document/folder visibility resolver だけに閉じられるため、Phase 4a の候補内で最小かつ narrow dependency の効果を検証しやすい。

## なぜなぜ分析（軽量 RCA）

### 問題文

current baseline の `MemoRagService` では favorite の save/list/delete と可視性判定が巨大 facade 内にあり、変更時に service 全体の依存と private helper を同時に理解する必要がある。一方、公開 API、tenant partition、アクセス不能項目の非列挙表現は維持しなければならない。

### confirmed

- favorite 公開メソッドは `saveFavorite`、`deleteFavorite`、`listFavorites` の 3 件である。
- 現実装は `favoriteStore`、`conversationHistoryStore`、`listDocuments`、`listDocumentGroups` を使う。
- owner key は `tenantPartitionedOwnerKey` で生成され、保存用 `ownerUserId` / `targetKey` は response から除外される。
- unsupported target は保存時に拒否し、既存だが解決不能な target は `accessible: false` と安全な固定ラベルで返す。
- route と公開 TypeScript signature は PR #390 の executable snapshot に固定されている。

### inferred

- favorite domain が facade 内に残った主因は、document/folder visibility を facade の既存 list method へ委譲するための明示 port がなく、store と cross-domain lookup が同じ class に集約されたことにある。
- 単に行を別ファイルへ移すだけで `Dependencies` 全体を渡すと、構造負債を移動するだけになる。

### open_question

- 将来 document/folder visibility を専用 query port に置き換えるかは本タスクでは決定しない。今回は既存 facade method の結果を narrow callback port として注入し、挙動を固定する。
- conversation history と favorite の統合 subservice 化は #387 の contract 方針確定後に別 PR で判断する。

### root cause と対策対応

- 根本原因: favorite が必要とする最小 store / visibility 能力を表す domain port がなく、composition root である facade が domain 実装も保持している。
- 対策: `FavoriteService` に必要な port だけを注入し、facade は同一 signature の委譲へ縮小する。subservice へ `Dependencies` 全体は渡さない。
- 効果指標: 公開 method snapshot 不変、favorite の facade 本体が委譲のみ、domain test と既存 facade/full API test が成功、whole-`Dependencies` boundary が増えない。

## 目的

- favorite domain を narrow-port subservice へ抽出し、`MemoRagService` を同一公開契約の facade にする。
- tenant owner partition、target visibility、inaccessible response、storage-only key redaction を executable test で二重に固定する。
- #387 の conversation-history contract と #339 の usage/cost に意味的変更を加えない。

## Scope

### In scope

- `FavoriteService` と narrow port の追加
- facade の favorite 3メソッドを同一 signature の委譲へ変更
- domain unit test の追加と既存 facade characterization の維持
- Phase 4b 境界を `DES_DLD_012.md` に追記
- source-backed API docs の必要最小な同期

### Out of scope

- conversation history 公開メソッドと返却型
- favorite route / HTTP schema / permission / store schema
- document/folder list の認可・表示契約
- RAG、session-local evidence、usage/cost、benchmark、Web UI
- merge / deploy / release

## 実施計画

1. favorite の store / visibility / response contract を domain test に固定する。
2. narrow port の `FavoriteService` を追加し、既存 helper と実装を移す。
3. `MemoRagService` は public signature を変えず subservice へ委譲する。
4. Phase 4a contract test、targeted/full API、docs freshness、root CI で回帰を検証する。
5. report、commit、draft stacked PR、semver、AC/self-review、task done、final-head CI、Issue コメントまで完遂する。

## ドキュメント保守計画

- 既存詳細設計 `DES_DLD_012.md` に Phase 4b favorite 境界、narrow port、保持 contract、残作業を追記する。
- HTTP contract と運用手順は変わらないため README、OpenAPI、API examples は内容更新不要。freshness check で確認する。
- source-backed API docs は generator の正規差分が出た場合だけ同一 PR で同期する。

## 受け入れ条件

- [x] AC1: `FavoriteService` が `Dependencies` 全体ではなく favorite/history store と visibility resolver の narrow port だけを受け取る。
- [x] AC2: `MemoRagService` の favorite 3メソッド名・引数・返却型が不変で、route compile contract と PR #390 の public signature snapshot が成功する。
- [x] AC3: tenant partition、unsupported target 拒否、chat session owner、document/folder visibility、storage-only key redaction、inaccessible response が domain test と既存 facade test で維持される。
- [x] AC4: conversation history、RAG/session evidence、usage/cost、HTTP schema、認可、永続化形式に挙動変更がない。
- [x] AC5: targeted/full API test、API typecheck/build、root `npm run ci`、OpenAPI/API code docs freshness、`git diff --check` が成功する。
- [x] AC6: `DES_DLD_012.md`、task、作業レポートが実装・検証・残リスクと同期する。
- [x] AC7: 日本語 draft stacked PR、`semver:patch`、AC/self-review comment を完了する。

## 検証計画

- favorite domain targeted test
- `npm test -w @memorag-mvp/api -- --test-name-pattern="FavoriteService|favorite"`
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`
- `npm run build -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `npm run docs:api-code:check`
- `npm run ci`
- `git diff --check`
- source audit（benchmark期待語句、QA sample固有値、dataset固有分岐、認可/tenant boundary の弱体化がないこと）

## PR セルフレビュー観点

- facade の公開 signature と route status mapping が不変か。
- owner key、visibility、storage key redaction、inaccessible label が移動前と同一か。
- subservice に whole `Dependencies` や AWS client、RAG policy を渡していないか。
- #387 の history contract、#339 の usage/cost を機械的に取り込んでいないか。
- docs と generated source inventory が実装に同期しているか。

## リスク

- `listDocuments` / `listDocumentGroups` callback は facade を経由するため、domain 間依存を完全には除去しない。今回は既存認可結果を変えない互換 seam として限定する。
- service source の行移動により source-backed generated docs が広範に更新される可能性がある。正規 generator 差分だけを採用し、#387 との merge 時に path conflict が起こり得ることを PR に明記する。
- real AWS smoke は外部環境を変更する可能性があるため実施せず、local/full CI で挙動不変を検証する。

## 実施結果

- `apps/api/src/favorites/favorite-service.ts` を追加し、store、owner key、認可済み document/folder query だけを受け取る narrow-port domain service とした。
- `MemoRagService` の favorite 3 public method は同じ signature の委譲に変更し、conversation history public method は変更していない。
- domain test で whole `Dependencies` / AWS client 非依存、tenant owner key、unsupported target の保存前拒否、chat/document/folder visibility、storage-only key redaction、inaccessible response、explicit tenant delete を固定した。
- 最初は `apps/api/src/rag/favorite-service.ts` として配置したため `runtime-layout.test.ts` が正当に失敗した。RAG domain ではないことを再確認し、`apps/api/src/favorites/` へ移動後 13/13 pass に修復した。
- source line / call graph の変更により API code docs freshness が失敗したため、正規 generator で 97 APIs / 582 documents を再生成した。312 generated files の差分は generator 由来であり、手編集していない。
- `DES_DLD_012.md` に Phase 4b favorite boundary、保持 contract、#387 / #339 非重複方針と残作業を追記した。

## 検証結果

- `npm ci`: 成功。既存 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告。
- `node --import tsx src/favorites/favorite-service.test.ts`: 5/5 pass。
- `node --import tsx src/rag/__tests__/runtime-layout.test.ts`: 初回 12/13 fail（誤配置）→移動後 13/13 pass。
- `node --import tsx apps/api/src/rag/memorag-service.test.ts`: 91/91 pass。
- `node --import tsx apps/api/src/rag/memorag-service-contract.test.ts`: 4/4 pass。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `npm run build -w @memorag-mvp/api`: pass。
- `npm test -w @memorag-mvp/api`: 初回 810/811 pass（runtime layout）→修正後 811/811 pass。
- `npm run docs:openapi:check`: pass。
- `npm run docs:api-code:check`: 初回 stale →正規再生成後 pass（97 APIs / 582 documents）。
- `npm run lint`: pass。
- `npm run ci`: pass（全 workspace lint/typecheck/test/build、API 811、Web 442、infra/benchmark を含む）。
- `npm run rag:release:source-audit`: pass（`datasetSpecificBranchCount: 0`、`artifactManifestMismatchCount: 0`）。
- `git diff --check`: pass。
- real AWS smoke / deploy / benchmark execution: 未実施。外部環境変更を避け、refactor の local/full CI に限定した。

## PR lifecycle gate

- 実装 commit: `4a6344b7`
- stacked draft PR: #393（base: `codex/issue-359-service-characterization`）
- label: `semver:patch`
- 日本語 AC comment: `#issuecomment-4997810997`
- 日本語 self-review comment: `#issuecomment-4997810999`
- GitHub Apps connector が本 session で利用できなかったため、認証済み `gh` fallback で PR 操作した。
- 本 task/report の done lifecycle commit を final head として push 後、GitHub Actions、Issue #359 進捗 comment、CLEAN/upstream 一致を外部 gate として確認する。
- merge / deploy / release は実施しない。
