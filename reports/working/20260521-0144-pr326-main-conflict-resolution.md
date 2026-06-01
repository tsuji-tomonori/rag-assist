# PR326 origin/main 取り込み競合解決レポート

## 指示

PR #326 のレビュー指摘対応を続行し、merge 前に残っている競合を解消する。

## 要件整理

- `origin/main` の RAG 実装移動を取り込み、PR #326 の認可境界修正を失わない。
- 競合 marker を残さない。
- API / RAG の focused tests と API typecheck で確認する。
- task md と作業レポートを残し、PR に日本語コメントで結果を記載する。

## 検討・判断

- main 側の旧 `hybrid-search` / `search-evidence` は compatibility shim 化されていたため、その形を採用した。
- PR #326 側の ACL fail-closed ロジックは、新配置の `apps/api/src/rag/online/retrieval/` 配下へ移植した。
- semantic vector hit は軽量 metadata だけを持ち、folder scope は manifest で判定されるため、vector metadata に明示 ACL がない場合は manifest 側の `canAccessManifest` に委譲する形にした。manifest が存在しない場合や manifest 側に ACL / owner / folder permission がない場合は fail-closed のまま落ちる。

## 実施作業

- `origin/main` を merge し、競合した旧 RAG import path を shim として解決した。
- 新配置の hybrid retriever / request-time evidence に manifest ACL fail-closed ロジックを反映した。
- semantic-only folder scope 検索で、vector metadata ではなく manifest 側の folder permission 判定へ進めるようにした。
- 競合解決用 task md を追加した。

## 成果物

- `apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts`
- `apps/api/src/rag/online/retrieval/request-time/search-evidence.ts`
- `apps/api/src/search/hybrid-search.ts`
- `apps/api/src/chat-orchestration/nodes/search-evidence.ts`
- `tasks/do/20260521-0144-pr326-main-conflict-resolution.md`

## 実行した検証

- `rg -n "^(<<<<<<<|=======|>>>>>>>)" apps packages benchmark tools tasks --glob '!reports/**'`: pass（該当なし）
- `git diff --check`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `../../node_modules/.bin/tsx --test src/search/hybrid-search.test.ts`: pass
- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts src/rag/memorag-service.test.ts src/search/hybrid-search.test.ts src/rag/__tests__/runtime-layout.test.ts`: pass

## fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: 競合解決、認可境界の新配置反映、focused test / typecheck は完了した。CI の最終結果は push 後に GitHub 側で確認が必要なため満点にはしていない。

## 未対応・制約・リスク

- full workspace test / build は未実施。今回の変更範囲が API / RAG 競合解決に限定されるため、focused API tests と API typecheck を優先した。
- CI の最終 green は push 後の GitHub Actions 結果に依存する。
