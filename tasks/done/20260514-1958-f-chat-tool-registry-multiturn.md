# F-chat-tool-registry-multiturn

状態: done
タスク種別: 機能追加
作成日: 2026-05-14
branch: `codex/phase-f-chat-tool-registry-multiturn`
worktree: `.worktrees/phase-f-chat-tool-registry-multiturn`

## 背景

仕様 4A/4B と `docs/spec/gap-phase-f.md` では、既存 `chat-orchestration` graph node と仕様上の `ChatToolDefinition` / `ChatToolInvocation` / multi-turn state が未接続であることが整理されている。

## 目的

既存 ChatRAG の検索・rerank・回答生成・citation 検証・support 検証の挙動を変えずに、後続 phase が参照できる chat tool registry と multi-turn optional state の基盤を追加する。

## Scope

- `packages/contract/src/schemas/` と API schema に `ChatToolDefinition` / `ChatToolInvocation` / `ChatOrchestrationMode` / multi-turn state の型を追加する。
- `apps/api/src/chat-orchestration/` 配下に tool registry と既存 graph node / trace label との対応を追加する。
- `apps/api/src/adapters/*conversation-history-store*` と関連 schema に `decontextualizedQuery`, `rollingSummary`, `queryFocusedSummary`, `citationMemory`, `taskState` などの optional state を互換的に追加する。
- document / drawing / support / benchmark / debug / external / quality / parse 系の後続 phase 依存 tool は disabled / placeholder metadata に留め、実行可能とは扱わない。
- 仕様・設計 doc、テスト、作業レポートを必要範囲で更新する。

## Scope Out

- H/J1 所有領域である `question-routes`、alias/search improvement の本実装、OpenAPI runtime source/gate の変更。
- ChatRAG follow-up 軽量化、required fact planning 汎化、policy computation 汎化、`verify-answer-support` 閾値、minScore filter、diversity、context budget の変更。
- UI に未実装 tool を操作可能に見せる表示や mock/demo fallback。

## 実装計画

1. 仕様 4A/4B、`gap-phase-f.md`、既存 contract / API / conversation history / chat-orchestration を確認する。
2. contract と API 側に backward compatible な zod schema / 型を追加する。
3. RAG 系 toolId と既存 node / trace label の対応を持つ registry を追加し、disabled tool は metadata のみで公開実行可能にしない。
4. conversation history item の optional multi-turn state を保存・取得できるよう store と tests を更新する。
5. 関連 docs と作業レポートを更新する。
6. 選定した検証を実行し、PR 作成・コメント・task done 更新まで行う。

## ドキュメントメンテナンス計画

- 挙動・型追加により `docs/spec/gap-phase-f.md` と `CHAPTER_TO_REQ_MAP.md` の Phase F 実装結果を更新する。
- README / 運用手順は public route や利用手順を増やさないため、必要性を確認して不要ならレポートに理由を残す。

## 受け入れ条件

- [x] `ChatToolDefinition` は `toolId`、入出力 schema 参照、必要 feature permission、必要 resource permission、承認要否、監査要否、有効状態を schema / 型で表現できる。
- [x] `ChatToolInvocation` は `invocationId`、`toolId`、実行者、入出力概要、状態、承認、時刻、結果を監査可能な optional schema / 型として表現できる。
- [x] RAG 系 toolId は既存 `chat-orchestration` graph node / trace label との対応が registry と tests で固定され、既存 RAG 挙動・閾値・budget を変更しない。
- [x] 後続 phase 依存 tool は disabled metadata として区別され、実行可能な本番 UI/API fallback として扱われない。
- [x] conversation history store は既存 `messages` 互換を保ったまま、`decontextualizedQuery`, `rollingSummary`, `queryFocusedSummary`, `citationMemory`, `taskState` などの multi-turn optional state を保存・取得できる。
- [x] H/J1 所有領域の主実装ファイルを不要に変更していない。
- [x] 変更範囲に見合う検証が実行され、未実施検証がある場合は理由を PR 本文・コメント・レポートに明記する。
- [x] PR 作成後に日本語の受け入れ条件コメントとセルフレビューコメントを投稿し、その後 task md を `tasks/done/` に移動して状態 `done` の commit/push を行う。

## 検証計画

- `npm run typecheck -w @memorag-mvp/api`
- contract schema / router に触れた場合は関連 typecheck/test
- chat-orchestration / conversation-history 関連 unit tests
- API schema/OpenAPI 影響がある場合は `npm run docs:openapi:check`
- `git diff --check`

## PR レビュー観点

- registry metadata と graph node / trace label の粒度を混同していないこと。
- disabled tool を実行可能または利用者向け機能のように露出していないこと。
- multi-turn state が optional で、既存 history item と後方互換であること。
- RAG の根拠性・認可境界・品質 gate を弱めていないこと。

## リスク

- 4B の toolId 全体は後続 phase 依存が多いため、本 PR では metadata 基盤に留める判断が必要。
- conversation history の永続サイズ制限との整合は、保存内容の optional / summary 中心設計で緩和する。
