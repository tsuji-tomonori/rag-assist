# Issue #359 Phase 4c: QuestionService の narrow-port 抽出

- 状態: do
- タスク種別: 修正
- Issue: #359
- 対象 branch: `codex/issue-359-question-service-extraction`
- stacked base: `codex/issue-359-favorite-service-extraction`（PR #393 final head `2217ac80`）

## 背景

`MemoRagService` は Phase 4a / PR #390 で 101 public method と 31 dependency key を持つ巨大 facade として characterization され、Phase 4b / PR #393 で favorite domain を最初の narrow-port service へ分離した。human question lifecycle の作成・一覧・取得・回答・解決も `questionStore` 中心の独立境界だが、現在は facade 本体へ直接実装されている。

## 着手前 overlap 監査と選定理由

- PR #387 は chat orchestration、session-local evidence、conversation history、RAG retrieval/trace、schema と大量の generated API docs を変更するため、history/chat/RAG は対象外とする。
- PR #339 は usage/cost、admin route/UI、service/test、schema、infra を変更するため、usage/cost/admin は対象外とする。
- PR #390 は contract snapshot と依存グラフの正本であり、本タスクはその contract guard を継承する。
- PR #393 は favorite 3 method と `FavoriteService` を変更する。本タスクは #393 final head を stacked base とし、favorite 実装には触れず同じ narrow-port pattern を次の独立 domain へ適用する。
- human question lifecycle は `QuestionStore`、既定担当 group 設定、requester/responder display-name resolver に閉じられ、上記 open PR の semantic/code 領域と重複が最小である。
- `memorag-service.ts` の行移動により canonical generated API docs は #387/#393 と競合し得るため、生成物競合を PR に明記し、merge 時は base 順で再生成する。

## なぜなぜ分析（軽量 RCA）

### 問題文

current stacked baseline の `MemoRagService` では、human question の 7 public method が巨大 facade 本体にあり、question lifecycle の変更でも service 全体の dependency graph と同一ファイルを扱う必要がある。公開 API、route-level permission、requester/assignee/admin の可視性、永続化形式は変えてはならない。

### confirmed

- 対象 public method は `createQuestion`、`listAssignedQuestions`、`listRequestedQuestions`、`listAllQuestionsForAdmin`、`getQuestion`、`answerQuestion`、`resolveQuestion` の 7 件である。
- domain 実装の永続化依存は `questionStore` だけである。
- `createQuestion` は requester ID/name/department、default assignee group、sanitized diagnostics を補完して store へ渡す。
- `answerQuestion` は responder display name を補完する。
- requester/assignee/admin の認可・非列挙境界と requester response redaction は `question-routes.ts` が保持する。
- public method name/signature は PR #390 の executable snapshot に固定されている。

### inferred

- domain が facade に残った主因は、question lifecycle に必要な store/config/display-name 能力を表す明示 port がなく、composition root が軽量な domain policy も直接保持したことにある。
- 実装を別ファイルへ移すだけで `Dependencies` や global config 全体を渡すと、構造負債を移動するだけになる。

### open_question

- route に残る requester/assignee/admin authorization を domain service へ移すかは本タスクでは決定しない。公開 HTTP contract と責務境界を変えないため現状維持する。
- alias search-improvement candidate は `getQuestion` を facade 経由で利用するが alias domain であるため、本タスクでは抽出しない。

### root cause と対策対応

- 根本原因: question lifecycle が必要とする最小 store/config/resolver 能力を表す domain port がなく、facade が composition と domain policy の両方を保持している。
- 対策: `QuestionService` へ narrow port と原始値だけを注入し、facade の public method は同一 signature の委譲へ縮小する。whole `Dependencies`、AWS client、RAG policy は渡さない。
- 効果指標: 101 public method snapshot 不変、question method 本体が delegate のみ、domain characterization/full API/root CI/docs freshness が成功し、whole-dependency boundary が増えない。

## 目的

- human question lifecycle を narrow-port `QuestionService` へ抽出し、`MemoRagService` は公開契約不変の facade とする。
- requester/default assignee/diagnostics/responder の補完と store lifecycle を executable characterization で固定する。
- #387 の history/RAG、#339 の usage/cost/admin、#393 の favorite に意味的変更を加えない。

## Scope

### In scope

- `QuestionService` と narrow port の追加
- facade の question 7 public methodを同一 signature の委譲へ変更
- domain unit/characterization test の追加と既存 route/contract/facade test の維持
- `DES_DLD_012.md` への Phase 4c 境界追記
- canonical source-backed API docs の同期

### Out of scope

- question route、HTTP schema、permission、requester response redaction、store schema/key
- search-improvement candidate / alias lifecycle
- conversation history、favorite、RAG/session evidence、usage/cost、benchmark、Web UI
- merge / deploy / release

## 実施計画

1. question store/config/display-name contract を domain test に固定する。
2. narrow port の `QuestionService` を追加し、既存補完・永続化実装を移す。
3. facade は public signature を変えず subservice へ委譲する。
4. Phase 4a contract、route、targeted/full API、docs freshness、root CI で回帰を検証する。
5. report、commit、draft stacked PR、semver、AC/self-review、task done、final-head CI、Issue コメントまで完遂する。

## ドキュメント保守計画

- `DES_DLD_012.md` に Phase 4c question boundary、narrow port、保持 contract と残余 debt を追記する。
- HTTP contract/運用/UI は不変のため README、API examples、OpenAPI 本文の手動更新は不要。freshness check で確認する。
- source-backed API docs は canonical generator の正規差分だけを同一 PR で同期する。

## 受け入れ条件

- [x] AC1: `QuestionService` が whole `Dependencies` や AWS client ではなく `QuestionStore`、既定担当 group、display-name resolver だけを受ける。
- [x] AC2: `MemoRagService` の question 7 method name/signature、route compile contract、PR #390 の 101 public method snapshot が不変である。
- [x] AC3: requester metadata、default/explicit assignee、diagnostics sanitization、responder display name、assigned/requested/admin list、get/answer/resolve、idempotent create を domain test と既存 test で維持する。
- [x] AC4: route permission、requester/assignee/admin 可視性、response redaction、HTTP schema/status、store schema、alias/RAG/history/favorite/usage に挙動変更がない。
- [x] AC5: targeted/full API、API typecheck/build、root `npm run ci`、OpenAPI/API code docs freshness、source audit、`git diff --check` が成功する。
- [x] AC6: `DES_DLD_012.md`、task、作業レポートが実装・検証・generated docs 競合・real AWS 未実施リスクと同期する。
- [ ] AC7: 日本語 draft stacked PR、`semver:patch`、AC/self-review/final-head CI/Issue progress、task done lifecycle、clean/upstream を完了する。

## 検証計画

- `node --import tsx apps/api/src/questions/question-service.test.ts`
- `node --import tsx apps/api/src/routes/question-routes.test.ts`
- `node --import tsx apps/api/src/rag/memorag-service-contract.test.ts`
- `node --import tsx apps/api/src/rag/memorag-service.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`
- `npm run build -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `npm run docs:api-code:check`
- `npm run ci`
- `npm run rag:release:source-audit`
- `git diff --check`
- `pre-commit run`

## PR セルフレビュー観点

- facade public signature、question route permission/status/redaction が不変か。
- requester/responder fallback、diagnostics sanitization、default assignee selection が移動前と同一か。
- subservice に whole `Dependencies`、global config object、AWS client、RAG/usage policy を渡していないか。
- #387/#339/#393 の semantic/code scope を取り込んでいないか。
- canonical generated docs と詳細設計が実装に同期しているか。
- benchmark期待語句、QA sample固有値、dataset固有分岐が実装へ混入していないか。

## リスク

- source line/call graph の変更で `docs/generated/api-code/` が広範に機械更新され、#387/#393 と path conflict が発生し得る。semantic code overlap とは分けて PR に記録し、stacked base の順序に合わせて canonical generator を再実行する。
- route authorization は意図的に route layer に残すため、domain service 単体は caller authorization 済みを前提とする。この前提を docs/test に明示する。
- real AWS smoke は外部状態を変更する可能性があるため未実施とし、local store を使う full CI と GitHub Actions で回帰を検証する。

## 実施結果（PR lifecycle 前）

- `QuestionService` と 6 件の domain test を追加し、facade の question 7 public method を delegate のみにした。
- Phase 4a contract は 101 public method / 31 dependency key を維持し、facade の direct dependency read は 27 から 26 へ減少した。
- route 9/9、contract 4/4、API full 817/817、root CI（contract 1 / API 817 / web 442 / infra 38 / benchmark 102）、`task docs:check`、source audit、typecheck/build/lint/diff check が成功した。
- staged 312 files に対する `pre-commit run` は全 hook が成功した。`--all-files` で検出した scope 外の既存末尾空白は取り込まず復元した。
- canonical API code docs は 97 API / 582 文書を再生成した。generated path は #387/#393 と conflict し得るため stack 順で再生成する。
- direct `memorag-service.test.ts` invocation は package test environment を欠いて既存失敗となるが、同じ失敗を変更前 #393 head で再現し、authoritative package suite 817/817 を確認した。
- real AWS smoke、benchmark、deploy/release は未実施。draft PR lifecycle と final-head CI は次工程で実施する。
