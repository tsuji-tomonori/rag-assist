# H-support-search-improvement

状態: done
タスク種別: 機能追加
発注元 wave: Wave 4
branch: `codex/phase-h-support-search-improvement`
worktree: `.worktrees/phase-h-support-search-improvement`
base: `origin/main`

## 背景

仕様 7 / 7A / 7B / 8 と H-pre-gap の調査結果に基づき、既存 `/questions` / `HumanQuestion` 互換を維持したまま、SupportTicket 相当の optional field と検索改善 human review loop の基盤を実装する。

## 目的

- 回答不能、低評価、手動エスカレーションを SupportTicket source として保存できる。
- 担当者向け trace は `support_sanitized` allowlist に限定し、権限外文書名・件数・ACL group・内部 policy・raw prompt を返さない。
- 検索改善 AI suggest は候補作成までに留め、human review なしで publish しない。
- 既存 `/questions`、`HumanQuestion`、alias draft/review/publish 互換を壊さない。

## スコープ

- `apps/api/src/routes/question-routes.ts` と question support adapter/type/schema の最小拡張。
- 検索改善候補作成 API / service / store 基盤の最小実装。
- route 追加に伴う `apps/api/src/security/access-control-policy.test.ts` 更新。
- 必要な contract / docs 更新。

## 含まない

- `/admin/aliases` API path や永続 alias artifact の全面 rename。
- debug trace 4 tier の全面実装。
- SLA 通知、外部 ticket system 連携。
- 文書検証、再解析、RAG 除外、benchmark case 登録 action の完全実装。
- F 所有の chat tool registry / multiturn、J1 所有の OpenAPI runtime source / gate。

## 実装前チェックリスト

- [x] 必読 skill を確認した。
- [x] `origin/main` から専用 worktree / branch を作成した。
- [x] H-pre-gap の `docs/spec/gap-phase-h.md` を参照した。
- [x] 既存 `/questions` と `HumanQuestion` 互換を維持して optional field を追加する。
- [x] `support_sanitized` diagnostics allowlist を実装し、requester / support の read surface を分ける。
- [x] 検索改善候補は draft / pending review のみに保存し、自動 publish しない。
- [x] route 追加・変更に応じて access-control policy test を更新する。
- [x] 最小十分な test / docs check / diff check を実行する。
- [x] PR 作成後に受け入れ条件コメントとセルフレビューコメントを投稿する。
- [x] PR コメント後に task md を `tasks/done/` に移動し、状態 `done` として同 branch に commit / push する。

## 受け入れ条件

- [x] `HumanQuestion` / `/questions` の既存 required field と status 互換が維持され、SupportTicket 相当の `source`, `messageId`, `ragRunId`, `answerUnavailableEventId`, `answerUnavailableReason`, `sanitizedDiagnostics`, assignee user/group, SLA/quality cause が optional field として保存・返却できる。
- [x] requester 本人向け response では `internalMemo` と担当者向け `sanitizedDiagnostics` が返らず、本人以外の通常ユーザーには generic 404 が維持される。
- [x] 担当者向け `sanitizedDiagnostics` は `support_sanitized` allowlist に限定され、権限外文書名・件数・ACL group・内部 policy・raw prompt・LLM 内部推論を含めない test がある。
- [x] 低評価または回答不能由来の検索改善候補を作成でき、候補は `pending_review` / draft に留まり、publish 前の理由・影響・diff metadata を記録できる。
- [x] 検索改善 API/UI 文言でエンドユーザーに alias 語を露出せず、既存 alias artifact / review / publish 互換を壊さない。
- [x] route 追加・変更は `apps/api/src/security/access-control-policy.test.ts` に反映され、API route-level permission が維持される。
- [x] 関連 docs / 作業レポートが更新され、実行した検証と未実施事項が PR 本文・コメントに記録される。

## 検証計画

- `npm run typecheck -w @memorag-mvp/api`
- `npm exec -w @memorag-mvp/api -- tsx --test src/questions-access.test.ts src/security/access-control-policy.test.ts src/contract/api-contract.test.ts`
- support/search improvement 関連 unit tests
- contract/OpenAPI 影響がある場合 `npm run docs:openapi:check`
- `git diff --check`

## PR レビュー観点

- docs と実装の同期。
- 変更範囲に見合う test。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと。
- 本番 UI/API に mock/demo fallback を入れていないこと。

## リスク

- H-pre-gap PR が main へ未 merge の場合、gap doc 本体は参照に留め、実装 PR で同じ docs file を不要に重複変更しない。
- 全面的な support workflow / debug tier は後続 J 系 task と調整が必要なため、今回は互換 optional field と基盤 API に絞る。
