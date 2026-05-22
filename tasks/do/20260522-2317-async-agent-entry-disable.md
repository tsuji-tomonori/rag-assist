# 非同期エージェント入口停止

状態: do

## 背景

ユーザー方針として、非同期エージェント実行だけを削除対象とし、チャット内オーケストレーションは通常チャットの中核として残すことが示された。巨大な一括削除ではなく、まず PR1 として feature flag / UI 導線停止を行い、利用不能だがコードは残る状態を作る。

## 目的

`/agents` 系の画面・API・権限入口を閉じ、既存の `ChatOrchestrationRun` と RAG 回答経路を壊さずに非同期エージェントの利用開始を防ぐ。

## タスク種別

修正

## 軽量なぜなぜ分析

- 問題文: 2026-05-22 時点の `origin/main` では、非同期エージェント実行を今後削除対象とする方針にもかかわらず、`/agents` 系 UI/API と `agent:*` permission 判定が active path として残っている。
- 確認済み事実:
  - `apps/api` に `/agents/runs`、provider、artifact、writeback 系の route と service method が存在する。
  - `apps/web` に `AsyncAgentWorkspace`、`useAsyncAgentRuns`、`/agents` route、sidebar 導線が存在する。
  - `apps/web/src/shared/types/common.ts` と API 側 seed に `agent:*`、`skill:*`、`agent_profile:*`、`agent_preset:*` が存在する。
  - `apps/api/src/chat-orchestration` と `ChatOrchestrationRun` は別ディレクトリ/型として存在する。
- 推定原因:
  - 旧エージェント機能からチャット内オーケストレーションへの名称整理後も、長時間・成果物生成型の非同期エージェント機能が active route として実装されたままになっている。
- 根本原因:
  - 廃止予定の非同期エージェント機能に対し、段階的に入口を閉じるガードがまだ入っていない。
- 影響範囲:
  - API route、RBAC permission、Web shell/sidebar、agent run hook、関連テスト。
  - `ChatOrchestrationRun`、RAG 検索、回答生成、問い合わせ作成は対象外。
- 対応方針:
  - PR1 では `/agents` 系の入口と導線を無効化し、contract/schema の大規模削除は後続 PR に残す。

## 実装チェックリスト

- [x] `/agents` 系 UI 導線を非表示または到達不能にする。
- [x] `/agents` 系 API を 404 または 410 にする。
- [x] Web 側 permission 判定で `agent:run` が true にならないようにする。
- [x] ロール seed から async agent / skill profile 系 permission を外す、または入口に効かない状態にする。
- [x] `asyncAgent` 初期化・参照が画面起動時に走らないようにする。
- [x] `ChatOrchestrationRun` / RAG answer path を削らない。
- [x] 最小十分なテストと差分チェックを実行する。
- [x] 作業レポートを `reports/working/` に残す。
- [ ] commit / push / PR 作成 / 受け入れ条件コメント / セルフレビューコメントを行う。

## 受け入れ条件

- [x] `userHasPermission("agent:run")` 相当の Web permission 判定が常に false になる。
- [x] Sidebar または app shell に `/agents` へのリンクが含まれない。
- [x] `GET /agents/runs` が 404 または 410 を返す。
- [x] `POST /agents/runs` が 404 または 410 を返す。
- [x] 画面初期化時に async agent run / provider API が呼ばれない。
- [x] `ChatOrchestrationRun` と通常 RAG 回答関連の型・実装は削除していない。
- [x] 変更範囲に対する lint/typecheck/test/docs check のうち最小十分な検証結果を記録する。

## 検証計画

- `git diff --check`
- API route policy / app route の targeted test
- Web app shell / permission の targeted test
- RAG または chat orchestration の既存 targeted test が実行可能なら実行
- 変更範囲が広がる場合は workspace typecheck / test を追加

## ドキュメント保守計画

PR1 は一時的な入口停止であり、仕様からの完全削除は後続 PR6 の対象にする。ただし生成 docs や UI inventory が変更対象に含まれる場合は実行結果に合わせて更新する。README / durable docs は、今回の feature flag 的停止では原則更新しない。

## PR レビュー観点

- 非同期エージェントだけを止め、チャット内オーケストレーションを誤って削っていないこと。
- API が 404/410 になり、権限だけに依存した閉塞になっていないこと。
- Web 初期化で agent API を呼ばないこと。
- 未実施検証を実施済みとして PR 本文/コメントに書かないこと。

## リスク

- async agent 実装が広範囲に残るため、PR1 完了後も contract/schema/docs には active 記述が残る。
- 既存テストの多くが async agent availability を前提にしている場合、テスト期待値更新が必要になる。
