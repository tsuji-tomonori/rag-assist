# PR338 conflict resolution report

## 指示

- PR #338 の競合を解消する。
- リポジトリルールに従い、task md、検証、作業レポート、PR コメントへ反映する。

## 要件整理

- `origin/main` を PR branch へ取り込み、GitHub の `mergeStateStatus: DIRTY` を解消する。
- 競合マーカーを残さない。
- generated docs は手編集でなく generator の出力に揃える。
- RAG の session-local evidence と main 側の document permission 変更を両立させる。
- 実行した検証のみを pass として記録する。

## 検討・判断

- `docs/generated/web-overview.md` の競合は Web UI inventory の件数差だったため、`npm run docs:web-inventory` で再生成して解消した。
- auto-merge 後に `manifestMatchesScopeForUser()` を確認し、main 側の folder permission scope filter が単一 `temporaryScopeId` だけを見る状態になっていたため、PR 側の複数 `temporaryScopeIds` 対応を同関数にも反映した。
- main 取り込みにより OpenAPI / Web inventory / document permission 関連の大きな差分が入ったため、API/Web typecheck と関連 targeted tests を実行した。

## 実施作業

- `origin/main` を `codex/session-local-evidence` に merge した。
- `docs/generated/web-overview.md` の conflict を Web inventory generator で解消した。
- `apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts` の `manifestMatchesScopeForUser()` を複数 `temporaryScopeIds` 対応に修正した。
- `tasks/do/20260522-2318-session-local-evidence.md` に競合 RCA と追加受け入れ条件を追記した。

## 成果物

- merge commit 予定差分一式
- `apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts`
- `tasks/do/20260522-2318-session-local-evidence.md`
- `reports/working/20260601-0905-pr338-conflict-resolution.md`

## 実行した検証

- `rg -n "^(<<<<<<<|=======|>>>>>>>)" apps docs packages tasks .github --glob '!reports/**'`: pass（該当なし）
- `npm run docs:web-inventory:check`: pass
- `./node_modules/.bin/tsx --test apps/api/src/search/hybrid-search.test.ts apps/api/src/chat-orchestration/nodes/node-units.test.ts apps/api/src/chat-orchestration/graph.test.ts apps/api/src/contract/schemas.test.ts`: pass
- `../../node_modules/.bin/vitest --run src/features/chat/hooks/useChatSession.test.ts src/features/chat/components/ChatView.test.tsx src/App.test.tsx` in `apps/web`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run docs:openapi:check`: pass
- `git diff --check`: pass

## 未対応・制約・リスク

- GitHub Actions の再実行結果は push 後に確認が必要。
- full workspace test / build は未実施。理由: 今回の手動解決点は generated Web inventory と RAG scope filtering であり、対象 test と typecheck を優先したため。
- PR #338 の既存 partial 項目（履歴再開時の temporary attachment 復元など）は本作業では未解消。

## Fit 評価

- 総合fit: 4.7 / 5.0
- 理由: 競合を解消し、意味的競合も 1 件修正して関連検証は pass した。GitHub Actions の post-push 結果と full workspace 検証は未確認のため満点ではない。
