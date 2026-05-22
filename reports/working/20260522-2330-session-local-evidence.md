# Session-local evidence 対応 作業レポート

## 指示

一時添付を 1 ターンだけの入力ではなく、同一 ChatSession 内の session-local evidence として保持し、毎ターンの RAG 検索範囲正規化へ合流させる。前回 citation anchor を follow-up 検索に使い、assistant の過去回答本文を根拠にしない。単体テストベースの完了条件を満たす。

## 要件整理

- 一時添付は通常 Document / Folder に混ぜず、同一 session の temporary evidence として扱う。
- `normalizeSearchScope()` で active temporary scope、removed、TTL、session mismatch を評価する。
- `buildConversationState()` と `decontextualizeQuery()` で previous citation anchor を retrieval input に反映する。
- retriever input は `temporaryScopeIds` と previous citation anchor を扱える。
- UI composer は一時添付チップを次ターン以降も表示し、削除操作を session context に反映する。
- 未実施の検証や未実装範囲を実施済みとして書かない。

## 実施作業

- `SessionDocumentContext`、`PreviousCitationAnchor`、`NormalizedSearchScope` を API runtime / contract / schema に追加した。
- `search_scope_normalize` node と `normalizeSearchScope()` を追加し、RAG graph の `build_conversation_state` 後に実行するようにした。
- active temporary scope の継承、全フォルダ scope との合成、削除済み除外、TTL 除外、session mismatch 除外を実装した。
- `buildConversationState()` が previous citation anchor を明示的に持つようにし、短い follow-up の retrieval query に `fileName chunkId page` anchor を含めた。
- hybrid retriever と memory retriever で `temporaryScopeIds` 複数指定を扱えるようにした。
- debug trace に `search_scope_normalize` の base scope、temporary count、previous citation anchor count を出すようにした。
- Web hook に `activeTemporaryAttachments` と削除済み temporary scope state を追加し、次ターン以降も `sessionDocumentContext` と `temporaryScopeIds` を送るようにした。
- Composer に active temporary attachment chip と削除ボタンを追加した。
- API / Web / contract / OpenAPI / design docs を更新した。

## 成果物

- `apps/api/src/chat-orchestration/nodes/search-scope-normalize.ts`
- `apps/api/src/chat-orchestration/nodes/build-conversation-state.ts`
- `apps/api/src/rag/orchestration/chat-rag-orchestrator.ts`
- `apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts`
- `apps/web/src/features/chat/hooks/useChatSession.ts`
- `apps/web/src/features/chat/components/ChatComposer.tsx`
- `packages/contract/src/schemas/chat.ts`
- `docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md`
- `docs/3_設計_DES/41_API_API/DES_API_001.md`
- `docs/generated/openapi/`

## 検証

- `npm ci`: pass
- `./node_modules/.bin/tsx --test apps/api/src/chat-orchestration/nodes/node-units.test.ts apps/api/src/chat-orchestration/graph.test.ts apps/api/src/chat-orchestration/tool-registry.test.ts`: pass
- `../../node_modules/.bin/vitest --run src/features/chat/hooks/useChatSession.test.ts src/features/chat/components/ChatView.test.tsx src/app/hooks/useAppShellState.test.ts` in `apps/web`: pass
- `./node_modules/.bin/tsx --test apps/api/src/chat-orchestration/nodes/node-units.test.ts apps/api/src/chat-orchestration/graph.test.ts apps/api/src/chat-orchestration/tool-registry.test.ts apps/api/src/search/hybrid-search.test.ts apps/api/src/contract/schemas.test.ts packages/contract/src/rag-contract-public-export.test.ts`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/contract`: pass
- `npm test -w @memorag-mvp/contract`: pass
- `npm run docs:openapi:check -w @memorag-mvp/api`: fail -> `npm run docs:openapi -w @memorag-mvp/api` 実行後 pass
- `git diff --check`: pass

## Fit 評価

総合fit: 4.0 / 5.0（約80%）

理由: backend の session-local temporary scope 正規化、previous citation anchor、retriever input、trace、composer 継続表示は実装・検証した。一方で、提示された単体テスト ID のうち、履歴再開時の active temporary attachment 復元と回答カードの補助表示は完全には実装していない。永続化 API、TTL cleanup、readOnly 保存拒否は既存仕様・既存経路との関係が大きく、今回の中核修正からは未対応。

## 未対応・制約・リスク

- MT-UI-004 `historyResume_restoresActiveTemporaryAttachmentUntilTTL`: 未実装。現行 conversation history は active temporary attachment context を保存していないため、履歴再開時に復元するには history schema / store / UI selection flow の追加変更が必要。
- MT-UI-003 `answerCard_showsReferencedTemporaryAttachment`: citation の `fileName` 表示は既存 UI で出るが、「参照した一時添付」という明示補助表示は未実装。
- MT-TEMP-007 / MT-TEMP-008: 一時添付の通常文書一覧非表示と readOnly 保存拒否は今回の normalize / multi-turn 直接修正では新規テストを追加していない。
- 既存 API は `temporaryScopeId` 単一指定と互換を維持しつつ `temporaryScopeIds` を追加した。古い client 互換は保つ想定。
