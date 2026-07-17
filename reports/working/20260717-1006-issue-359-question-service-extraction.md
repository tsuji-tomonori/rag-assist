# Issue #359 Phase 4c QuestionService 抽出 作業レポート

- 作業日時: 2026-07-17 09:49-10:06 JST
- Issue: #359
- branch: `codex/issue-359-question-service-extraction`
- stacked base: `codex/issue-359-favorite-service-extraction`（PR #393 final head `2217ac80`）
- 状態: 実装・ローカル検証完了、draft PR lifecycle 実施前

## 受けた指示と要件整理

Issue #359 の残余構造負債から、進行中 PR と semantic/code overlap が小さい独立単位を選び、専用 worktree、task、実装、検証、commit、draft PR、AC/self-review、final-head CI、Issue 進捗コメントまで進める。merge、deploy、release は行わない。

PR #387 の chat/history/RAG、PR #339 の usage/cost/admin、PR #393 の favorite を除外し、`QuestionStore` 中心で閉じる human question 7 public method を Phase 4c として選定した。公開 method signature、route authorization/redaction、HTTP/store contract は変更しない。

## 検討・判断

- `QuestionServicePorts` は `QuestionStore` の create/list/get/answer/resolve、default assignee group の原始値、display-name resolver だけを受ける。
- whole `Dependencies`、global config object、AWS client、RAG/usage policy は domain service へ渡さない。
- requester/default assignee/diagnostics/responder 補完を facade から移し、7 public method は同一 signature の delegate にする。
- route permission、requester/assignee/admin visibility、requester response redaction は route layer に残す。
- セルフレビューで default assignee を新規に trim する差分を検出し、旧実装と同じ `value || undefined` semantics へ戻した。
- source line/call graph 変更に伴う `docs/generated/api-code/` の広範差分は canonical generator 出力として保持する。PR #387/#393 と path conflict が見込まれるため、stack 順に再生成する必要がある。

## 実施作業と成果物

- `apps/api/src/questions/question-service.ts`: narrow-port `QuestionService` と display-name/sanitization policy を追加。
- `apps/api/src/questions/question-service.test.ts`: source boundary、create canonicalization、idempotency field forwarding、全 read boundary、answer/resolve、display-name fallback の 6 test を追加。
- `apps/api/src/rag/memorag-service.ts`: question 7 method を subservice delegate へ縮小。
- `apps/api/src/rag/memorag-service-contract.test.ts`: public 101 method/31 dependency key は維持し、direct dependency read を 27 から 26 へ更新。
- `apps/api/src/api-code-docs/generator.test.ts`: question data boundary の期待値を narrow port に同期。
- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`: Phase 4c 境界、保持 contract、残余 debt、generated docs 方針を追記。
- `docs/generated/api-code/`: canonical `npm run docs:api-code` で 97 API / 582 文書を再生成。
- `tasks/do/20260717-0949-issue-359-question-service-extraction.md`: overlap 監査、RCA、受け入れ条件、検証計画を記録。

## 検証結果

成功:

- `node --import tsx apps/api/src/questions/question-service.test.ts`: 6/6
- `node --import tsx apps/api/src/routes/question-routes.test.ts`: 9/9
- `node --import tsx apps/api/src/rag/memorag-service-contract.test.ts`: 4/4
- `npm test -w @memorag-mvp/api`: 817/817
- `npm run typecheck -w @memorag-mvp/api`
- `npm run build -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `npm run docs:api-code:check`: 97 API / 582 文書
- `task docs:check`
- `npm run lint`
- `npm run ci`: contract 1、API 817、web 442、infra 38、benchmark 102 と全 workspace build が成功
- `npm run rag:release:source-audit`: dataset 固有分岐 0、artifact manifest mismatch 0
- `git diff --check`
- `pre-commit run`: staged 312 files の全 hook が成功

修正して再実行した項目:

- contract test の dependency key と direct read の期待を一度混同したため、31 dependency key は維持し `questionStore` だけを direct read 期待から外して 4/4 を確認した。
- API code generator test が旧 `this.deps.questionStore` を期待して失敗したため、canonical `this.ports.questionStore` へ更新して full API 817/817 を確認した。
- 初回 docs freshness は生成前で stale だったため canonical generator を実行し、freshness check と `task docs:check` を再実行した。
- `pre-commit run --all-files` は scope 外の既存レポート 1 件の末尾空白を修正して停止したため、その変更を戻し、今回の staged 312 files に限定した `pre-commit run` で全 hook 成功を確認した。
- direct `node --import tsx apps/api/src/rag/memorag-service.test.ts` は package script が設定する test environment を欠くため既存 test が失敗した。同じ direct invocation が変更前 PR #393 head でも同じ失敗になることを確認し、authoritative な `npm test -w @memorag-mvp/api` では 817/817 を確認した。

## 指示への fit 評価

- non-overlap: question lifecycle に限定し、PR #387/#339/#393 の semantic domain を変更していない。
- 構造負債: facade の direct dependency read を 1 件減らし、domain policy を narrow port service へ分離した。
- contract: public signature、route permission/redaction、schema/store/RAG/usage/favorite/history を不変として既存 test と full CI で確認した。
- docs: 詳細設計と canonical source-backed docs を同期した。README/API example/運用手順/UI は挙動不変のため更新不要と判断した。

## 未対応・制約・リスク

- real AWS smoke、benchmark 実行、deploy/release は外部状態・費用を伴い、挙動変更のない構造抽出の範囲外のため未実施。local/full CI と GitHub Actions を gate とする。
- generated API docs は 304 file diff（staged 全体は 312 files）を占め、PR #387/#393 と機械的 conflict が発生し得る。stacked base 順に merge/rebase 後、canonical generator を再実行する。
- route authorization は domain service 外に残る。subservice は認可済み caller を前提とし、後続で再配置する場合は security policy test と HTTP contract を独立に見直す。
- draft PR、label、AC/self-review comment、task done、final-head CI、Issue comment、clean/upstream 確認は後続 lifecycle で実施する。
