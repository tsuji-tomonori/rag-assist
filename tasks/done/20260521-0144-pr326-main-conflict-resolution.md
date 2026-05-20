# PR326 origin/main 取り込み競合解決

状態: done
タスク種別: 修正

## 背景

PR #326 のレビュー指摘対応後、`origin/main` が RAG 実装の配置変更を含んで進んだため、GitHub 上で PR が merge conflict 状態になった。

## 目的

`origin/main` を取り込み、PR #326 の認可境界修正と main 側の RAG 配置変更を両立させる。

## なぜなぜ分析

- confirmed: `git merge origin/main` で `apps/api/src/search/hybrid-search.ts` と `apps/api/src/chat-orchestration/nodes/search-evidence.ts` が競合した。
- confirmed: main 側では旧パスが shim 化され、実装本体が `apps/api/src/rag/online/retrieval/` 配下へ移動している。
- confirmed: PR #326 側では manifest / search metadata の ACL fail-closed ロジックを旧実装に加えていた。
- inferred: 競合の根本原因は、同じ認可ロジックに対して「実装移動」と「権限境界修正」が別ブランチで同時に入ったこと。
- root cause: fail-closed 修正を新しい RAG 配置先へ移植せずに旧ファイルだけで解決すると、PR #326 の認可境界が main 取り込み後に失われる。
- remediation: 旧ファイルは main 側の shim を採用し、認可境界の実体を新配置の RAG module へ反映して focused test と typecheck で確認する。

## 受け入れ条件

- [x] merge conflict marker が残っていない。
- [x] 旧 `hybrid-search` / `search-evidence` は main 側の shim 形に揃っている。
- [x] PR #326 の ACL fail-closed / folder permission 判定が新配置 module に反映されている。
- [x] `npm run typecheck -w @memorag-mvp/api` が pass する。
- [x] 関連 API / RAG focused tests が pass する。
- [x] PR に受け入れ条件確認とセルフレビューを日本語コメントで追記する。

## 検証計画

- `rg -n "^(<<<<<<<|=======|>>>>>>>)" apps packages benchmark tools tasks --glob '!reports/**'`
- `git diff --check`
- `npm run typecheck -w @memorag-mvp/api`
- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts src/rag/memorag-service.test.ts src/search/hybrid-search.test.ts src/rag/__tests__/runtime-layout.test.ts`

## ドキュメント保守方針

挙動仕様を追加する変更ではなく、既存 PR の競合解決と配置追従のため、README / docs 更新は不要と判断する。作業記録は `reports/working/` に残す。

## リスク

merge commit には `origin/main` の既存変更も含まれるため、PR #326 固有の修正と main 由来の差分を PR コメントで区別する。
