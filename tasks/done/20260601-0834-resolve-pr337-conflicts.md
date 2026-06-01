# PR337 コンフリクト解消

状態: done

## 背景

PR #337 は `codex/async-agent-entry-disable` から `main` への PR で、非同期エージェント入口を API / Web / 権限から停止する変更を含む。PR 作成後に `main` が進み、GitHub 上の merge state が `DIRTY` になっている。

## 目的

PR #337 の意図である「非同期エージェント入口停止」を維持したまま、最新 `origin/main` を取り込んでコンフリクトを解消し、merge 可能な状態へ戻す。

## タスク種別

修正

## 軽量なぜなぜ分析

- 問題文: 2026-06-01 時点で PR #337 が `main` に対して conflict し、通常の PR merge ができない状態になっている。
- 確認済み事実:
  - `gh pr view 337` で `mergeStateStatus: DIRTY` と確認した。
  - PR #337 は API route、Web shell、generated docs、task/report を広く変更している。
  - `origin/main` は PR 作成時点から更新されている。
- 推定原因:
  - PR #337 と `main` 側の後続変更が同じ route、Web shell、generated docs、task/report 周辺を更新し、Git が自動統合できない差分が発生した。
- 根本原因:
  - 長期化または並行 PR により、PR branch が最新 `main` と同期されていない。
- 影響範囲:
  - PR #337 の変更ファイル、および `main` 取り込みで衝突したファイル。
  - 非同期エージェント入口停止の受け入れ条件。
- 対応方針:
  - `origin/main` を PR branch に merge し、衝突箇所ごとに `main` の最新構造と PR #337 の入口停止意図を両立させる。
  - 生成 docs / inventory が stale になった場合は再生成または check 結果に沿って更新する。

## 実装チェックリスト

- [x] PR #337 の branch に最新 `origin/main` を取り込む。
- [x] コンフリクトマーカーを全て解消する。
- [x] `/agents` 系 API route が active registration へ戻っていないことを確認する。
- [x] Web sidebar / app shell から `agents` view が復活していないことを確認する。
- [x] `agent:run` 等の入口 permission が active capability として復活していないことを確認する。
- [x] 生成 docs / inventory の整合性を確認する。
- [x] 最小十分な検証を実行し、結果を記録する。
- [x] 作業レポート、commit、push、PR コメント、セルフレビューを完了する。

## 受け入れ条件

- [x] PR #337 の branch が最新 `origin/main` を取り込み済みで、コンフリクトマーカーが残っていない。
- [x] Runtime OpenAPI または route 登録に `/agents` 系 endpoint が復活していない。
- [x] Web app shell / sidebar に `/agents` 導線が復活していない。
- [x] Web permission 判定で async agent capability が有効化されていない。
- [x] `ChatOrchestrationRun` と通常 RAG 回答関連の型・実装は削除していない。
- [x] 変更範囲に対する最小十分な検証結果を task / report / PR コメントに記録している。
- [x] PR #337 に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿している。

## 実行した検証

- `git diff --check`: pass
- `rg -n '^(<<<<<<<|=======|>>>>>>>)' apps docs tasks --glob '!reports/**'`: pass（該当なし）
- `npm run docs:web-inventory:check`: pass
- `npm run docs:openapi:check`: pass
- `npm run docs:hidden-unicode:check`: pass
- `../../node_modules/.bin/tsx --test src/security/access-control-policy.test.ts src/agent-routes.test.ts`（`apps/api` cwd）: pass（15 tests）。初回は root cwd で実行して `process.cwd()` 前提に合わず fail、次に sandbox 内の IPC pipe listen が `EPERM` になったため `require_escalated` で再実行。
- `npm run test -w @memorag-mvp/web -- src/app/hooks/usePermissions.test.ts src/app/hooks/useAppShellState.test.ts src/app/components/RailNav.test.tsx src/App.test.tsx`: pass（4 files / 51 tests）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass

## 検証計画

- `git diff --check`
- `rg '<<<<<<<|=======|>>>>>>>'`
- API route / authorization / access-control の targeted test
- Web app shell / permission の targeted test
- generated docs / inventory check
- 変更範囲が広い場合は API / Web typecheck を追加

## ドキュメント保守計画

今回の主目的は merge conflict 解消であり、恒久仕様の追加変更は行わない。生成 docs / inventory が最新 `main` 取り込み後に stale になる場合のみ、生成物を更新する。README / durable docs は挙動変更が新たに増えない限り更新不要と判断する。

## PR レビュー観点

- `main` 側の最新変更を落としていないこと。
- PR #337 の入口停止要件が維持されていること。
- generated docs / inventory が実装状態と同期していること。
- 未実施の検証を実施済みとして書いていないこと。

## リスク

- PR #337 は generated docs と Web inventory を含むため、コンフリクト解消後に再生成差分が広がる可能性がある。
- PR #337 の後続削除予定の残存コードは今回も範囲外であり、active route / UI 導線に戻らないことを重点確認する。
