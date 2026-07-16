# Issue #359 Phase 4a MemoRagService characterization 作業完了レポート

## 受けた指示

Issue #359 Phase 4a として、current main の `MemoRagService` を挙動変更せず characterization し、公開 contract、consumer、constructor、内部依存を後続分割の安全網として固定する。専用 worktree、task、検証、commit、draft PR、PR コメント、task lifecycle、final-head CI、Issue 進捗コメントまで実施し、merge / deploy / release は行わない。

## 要件整理

- `MemoRagService` の全公開 method 名と TypeScript signature を exact に固定する。
- REST route / worker / oRPC consumer、全 constructor site、private/store/AWS/policy dependency を source-backed に固定する。
- tenant、permission、idempotency、audit、compensation、artifact key、error status、RAG trust の既存 characterization 根拠を設計文書に残す。
- 後続 service に `Dependencies` 全体を渡さない narrow port 方針と抽出候補を示す。
- service 本体、HTTP/oRPC contract、認可、永続化、generated docs を変更しない。

## 検討・判断

- `origin/main` (`8a427a24`) を契約基準とし、open PR #339 / #387 の未取り込み変更は baseline に含めなかった。
- #387 は `deleteConversationHistory` の返却型変更と `getConversationHistory` 追加を含むため、取り込み時に snapshot と consumer inventory の明示レビューが必要と判断した。
- open PR との path conflict を抑えるため、service 本体と既存巨大 test は編集せず、新規 contract test・snapshot・設計文書だけを追加した。
- method 名は `keyof MemoRagService` の exact type check、signature は TypeScript compiler checker、依存グラフは AST/source inventory で固定した。
- 現在の whole-`Dependencies` receiver/call は既存上限として固定し、Phase 4a では分割自体を行わなかった。

## 実施作業と成果物

- `apps/api/src/rag/memorag-service-contract.test.ts`
  - 公開 101 method の exact name/signature guard
  - consumer、明示 `Pick`、constructor site、`Dependencies`、直接 dependency、AWS/policy import、whole-dependency boundary の inventory guard
- `apps/api/src/rag/__snapshots__/memorag-service-public-contract.snapshot.json`
  - compiler-resolved public signature 101 件
- `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md`
  - current dependency graph、characterization matrix、narrow port 候補、互換性方針
- `tasks/do/20260717-0149-issue-359-service-characterization.md`
  - 受け入れ条件、overlap 監査、実施・検証記録

## 検証

- targeted contract test: 初回は direct dependency inventory の `accountRevocationRegistry` 欠落を検出。期待値修正後に成功。
- `npm run typecheck -w @memorag-mvp/api`: 成功。
- `npm test -w @memorag-mvp/api`: 806 tests / 806 pass。
- `npm run build -w @memorag-mvp/api`: 成功。
- `npm run docs:openapi:check`: 成功。
- `npm run docs:api-code:check`: 成功（97 APIs / 582 docs）。
- `npm run ci`: 初回は型だけに使用した method 名 inventory の lint error を検出。runtime exact assertion へ修正後、lint と targeted test を再確認し、再実行で全 workspace lint/typecheck/test/build に成功。
- `git diff --check` と staged source audit は commit 前に実施する。
- 実 AWS、deploy、smoke、benchmark は production code/runtime behavior を変更しない source characterization のため対象外。

## 指示への fit 評価

実装挙動を変えず current main の contract と依存境界を executable inventory と設計文書に固定した。後続 Phase 4b 以降は差分を明示しながら facade を維持して分割できる。benchmark 期待語句、QA sample 固有値、dataset 固有分岐は production code に追加していない。

## 未対応・制約・リスク

- #387 を先に取り込む場合は公開 contract 差分への判断と snapshot 更新が必要。
- #339 は service/test を直接変更する open / DIRTY PR であり、同時統合時は semantic review が必要。
- whole-`Dependencies` boundary は可視化と増加防止までで、実際の narrow port 抽出は後続 Phase の範囲。
- compiler-based contract test は API suite に追加時間を要するが、公開 signature の型解決を文字列抽出より正確に固定するため採用した。
- `npm ci` は既存 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告した。依存更新は本タスクの範囲外。
- web build は既存の 500 kB 超 chunk warning を報告した。
- PR URL、PR/Issue コメント、final-head CI、task done lifecycle、最終 CLEAN は PR 作成後に本レポートへ追記する。

## ドキュメント保守

詳細設計文書を新規追加した。README、OpenAPI、API examples は公開 HTTP contract と運用手順が変わらないため更新不要。generated docs は freshness check に成功し、変更していない。
