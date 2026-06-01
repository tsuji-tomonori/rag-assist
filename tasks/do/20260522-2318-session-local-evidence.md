# Session-local evidence を RAG 検索範囲へ継続合流する

- 状態: in_progress
- タスク種別: 修正
- ブランチ: `codex/session-local-evidence`

## 背景

一時添付つきで初回質問した後、次ターンで `searchScope` が `all` のみに戻ると、同一 ChatSession の一時添付や前回 citation anchor が検索入力から外れる可能性がある。仕様上、一時添付は通常フォルダ文書へ混ぜず、同一 session の session-local evidence として TTL 内だけ参照する。

## 軽量なぜなぜ分析

- 問題文: 同一 ChatSession の 2 ターン目で「RAGの定義は」のような follow-up を送ると、前ターンで使った一時添付または citation anchor が検索対象から外れうる。
- 確認済み事実:
  - `SearchScope` は `includeTemporary` と単一 `temporaryScopeId` を持つ。
  - Web hook は添付付き送信時だけ `includeTemporary` / `temporaryScopeId` を設定している。
  - `buildConversationState()` は previous citation を収集し、rerank で soft boost している。
  - `search-evidence` は `state.searchScope` を retriever に渡すが、session context と合成する normalize step は見当たらない。
- 推定原因:
  - 一時添付を session-local state として保持し、毎ターン search scope に合流する正規化責務がない。
  - previous citation は query string と rerank prior には使われるが、retriever input の明示 anchor として扱う型がない。
- 根本原因:
  - RAG pipeline の入力正規化が、ユーザー選択 scope と session-local evidence の合成を独立した責務として持っていない。
- 対策:
  - `SessionDocumentContext` と `normalizeSearchScope()` を追加し、active temporary scope と previous citation anchor を毎ターン合流する。
  - conversation state / decontextualized query / retriever input に anchor を明示的に渡す。
  - TTL、removed、session mismatch を unit test で固定する。

## CI 失敗の軽量なぜなぜ分析

- 問題文: PR #338 の MemoRAG CI で `npm run docs:web-inventory:check` と `npm exec -w @memorag-mvp/web -- vitest run --coverage` が失敗した。
- 確認済み事実:
  - `docs:web-inventory:check` は `docs/generated/web-overview.md`、`docs/generated/web-features.md`、`docs/generated/web-accessibility.md`、`docs/generated/web-ui-inventory.json`、`docs/generated/web-features/chat.md` が最新でないとして失敗した。
  - Web test は `src/App.test.tsx` の `keeps the chat request payload unchanged` で、実 payload に `sessionDocumentContext` と `removedTemporaryScopeIds` が追加された一方、期待値が旧 payload のままだったため失敗した。
- 推定原因:
  - Web の chat payload 仕様変更に対して、生成 inventory と最上位 App test の契約期待値が更新されていなかった。
- 根本原因:
  - session-local evidence の API/UI contract 追加に伴う web 側派生成物・統合テスト expectation の追随が漏れた。
- 対策:
  - Web inventory を generator で再生成する。
  - App test の chat request payload expectation を、新しい session-local evidence fields を検証する形へ更新する。

## main 追従競合の軽量なぜなぜ分析

- 問題文: PR #338 が `origin/main` に対して `mergeStateStatus: DIRTY` となり、merge 時に `docs/generated/web-overview.md` が競合した。
- 確認済み事実:
  - `docs/generated/web-overview.md` は Web inventory generator の出力で、PR 側と main 側で UI 操作要素数が異なっていた。
  - `origin/main` には document share / move UI と document permission service の変更が含まれていた。
  - auto-merge 後、`manifestMatchesScopeForUser()` は main 側の folder permission scope filter と PR 側の複数 `temporaryScopeIds` 対応が同じ関数に合流していた。
- 推定原因:
  - generated docs は両ブランチの UI 変更を同時に反映する必要があり、静的な行単位 merge では正しい件数を決められなかった。
  - 権限付き scope filter 追加と session-local temporary scope 複数 ID 対応が近接領域で交差した。
- 根本原因:
  - main 追従により generated inventory と RAG retriever scope filtering の両方で、手動解決または意味的確認が必要な変更が重なった。
- 対策:
  - Web inventory を generator で再生成し、両ブランチの UI を含む generated docs に更新する。
  - `manifestMatchesScopeForUser()` でも `temporaryScopeIds` を見るよう修正し、複数 temporary scope の retrieval を維持する。

## 作業範囲

- API の RAG orchestration state / conversation state / search scope 正規化。
- Hybrid retriever の temporary scope 複数 ID 対応。
- Web composer の一時添付継続表示は既存 hook 構造を確認し、実装可能範囲を追加する。
- 永続化 API や TTL cleanup worker の本格実装は今回の unit test 範囲外なら task/report に未対応として残す。

## 受け入れ条件

- MT-TEMP-001 から MT-TEMP-006 の単体テストが通る。
- MT-CONTEXT-001 から MT-CONTEXT-006 の単体テストが通る、または既存同等テストに不足分を追加する。
- MT-RETRIEVE-001 から MT-RETRIEVE-006 の単体テストが通る、または現行 architecture で同等に検証する。
- MT-ANSWER-001 から MT-ANSWER-004 の単体テストが通る、または orchestration の unit/integration test として検証する。
- MT-TRACE-001 から MT-TRACE-003 の単体テストが通る。
- MT-UI-001 から MT-UI-004 は実装可能な既存 UI state に対してテストし、実装外の項目は未達として明記する。
- `npm run test -w @memorag-mvp/api` または変更範囲に対するより狭い API test が pass する。
- Web を変更した場合は `npm run test -w @memorag-mvp/web` または対象 test が pass する。
- `npm run docs:web-inventory:check` が pass する。
- `npm exec -w @memorag-mvp/web -- vitest run --coverage` の CI 失敗が再現しない。
- `origin/main` merge 後に conflict marker が残っていない。
- `temporaryScopeIds` 複数指定が folder permission scope filter 経由でも失われない。
- `git diff --check` が pass する。

## 検証計画

- API: `npm run test -w @memorag-mvp/api -- chat-orchestration/nodes/node-units.test.ts`
- 必要に応じて retriever / contract の targeted test。
- Web 変更時: `npm run test -w @memorag-mvp/web -- useChatSession.test.tsx`
- 仕上げ: `git diff --check`

## ドキュメント保守計画

RAG の多ターン evidence 挙動に関係する既存 docs を検索済み。コード変更後、 durable docs に反映が必要な場合は最小範囲で更新する。テストのみで仕様が十分に表現できる場合は作業レポートに docs 未更新理由を残す。

## PR レビュー観点

- 一時添付を通常 Document/Folder 一覧へ混ぜていないこと。
- previous citation は assistant 本文ではなく source chunk anchor として扱うこと。
- TTL / removed / session mismatch が検索範囲から除外されること。
- 権限外 citation の名称や内部 policy を user-safe trace へ出さないこと。
