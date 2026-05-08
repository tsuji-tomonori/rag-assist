# Tasks

## TASK-001: 文書を登録し QA 利用可能化する

- Actor: `RAG_GROUP_MANAGER` または `SYSTEM_ADMIN`
- Intent: 文書をナレッジベースへ登録し、検索・回答生成の対象にする
- Outcome: 文書 manifest、chunk、embedding、ingest status が作成される
- Component: Documents API / Document ingest run / RAG index
- Source: FACT-002, FACT-013
- Confidence: confirmed

## TASK-002: 登録文書に基づいて質問し回答を得る

- Actor: `CHAT_USER`
- Intent: 登録済み文書に対して自然言語で質問する
- Outcome: 根拠付き回答、回答不能、または確認質問が返る
- Component: Chat UI / `/chat-runs` / RAG graph
- Source: FACT-001, FACT-003, FACT-004, FACT-005
- Confidence: confirmed

## TASK-003: 根拠不足または回答不能時に人手へ問い合わせる

- Actor: `CHAT_USER`, `ANSWER_EDITOR`
- Intent: RAG で回答できない質問を担当者へ送り、回答後に本人が確認する
- Outcome: ticket 作成、担当者回答、本人向け回答確認、履歴通知が行われる
- Component: Questions API / History UI
- Source: FACT-009
- Confidence: confirmed

## TASK-004: Hybrid search で関連根拠を取得する

- Actor: `CHAT_USER` または RAG graph
- Intent: lexical/vector/RRF/ACL filter により関連 chunk を取得する
- Outcome: 権限内の関連 chunk と retrieval diagnostics が得られる
- Component: `/search` / Hybrid retriever / Retrieval evaluator
- Source: FACT-006
- Confidence: confirmed

## TASK-005: 会話履歴とお気に入りを管理する

- Actor: `CHAT_USER`
- Intent: 自分の会話履歴を保存・検索・削除し、重要な履歴をお気に入り化する
- Outcome: userId 境界内の履歴一覧、削除、お気に入り絞り込みができる
- Component: Conversation history API / History UI
- Source: FACT-010
- Confidence: confirmed

## TASK-006: Debug trace を調査・ダウンロードする

- Actor: `SYSTEM_ADMIN`
- Intent: RAG 実行履歴、各 step、判定、検索品質を調査する
- Outcome: redaction 済み trace の一覧/詳細/JSON download ができる
- Component: Debug routes / Debug panel
- Source: FACT-011, FACT-013
- Confidence: confirmed

## TASK-007: Benchmark を実行し品質を継続評価する

- Actor: `BENCHMARK_OPERATOR`, `BENCHMARK_RUNNER`, `SYSTEM_ADMIN`
- Intent: RAG/search 品質を dataset/corpus に対して評価する
- Outcome: run 起動、進捗、summary/results/report artifact、download が得られる
- Component: Benchmark API / CodeBuild runner / corpus seed
- Source: FACT-012, FACT-015
- Confidence: confirmed

## TASK-008: ユーザーと role を管理し認可境界を維持する

- Actor: `USER_ADMIN`, `ACCESS_ADMIN`, `SYSTEM_ADMIN`
- Intent: ユーザー作成、停止、role 付与、audit を管理する
- Outcome: 管理台帳と Cognito group が同期し、JWT permission に反映される
- Component: Admin API / Cognito / RBAC
- Source: FACT-007, FACT-008
- Confidence: confirmed

## TASK-009: 検索 alias と再インデックスを管理する

- Actor: `RAG_GROUP_MANAGER`, `SYSTEM_ADMIN`
- Intent: 検索設定や index の切替を安全に運用する
- Outcome: alias draft/review/publish と staged reindex/cutover/rollback ができる
- Component: Admin alias routes / Reindex migration routes
- Source: FACT-002, FACT-006, SRC-003
- Confidence: inferred

## TASK-010: UI ナビゲーションを権限に応じて出し分ける

- Actor: 認証済みユーザー
- Intent: 自分の権限で利用できる機能だけにアクセスする
- Outcome: chat/history/favorites は通常導線、benchmark/documents/admin は permission に応じて表示される
- Component: Web AppRoutes / RailNav / usePermissions
- Source: FACT-014
- Confidence: inferred
