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

## TASK-011: 認証・初回パスワード・自己登録を制御する

- Actor: 未ログインユーザー, 認証済みユーザー, `USER_ADMIN`
- Intent: 許可された認証フローだけでログインし、初回パスワード変更や自己登録制限を安全に扱う
- Outcome: Cognito login、新パスワード要求、自己登録の最小 role、password guidance が期待通りに動く
- Component: Auth UI / Cognito / Admin user workflow
- Source: FACT-017
- Confidence: confirmed

## TASK-012: API 契約と CORS/request validation を維持する

- Actor: API consumer, browser client, system
- Intent: Web/API 間の契約を破壊せず、preflight と request validation を安定させる
- Outcome: OpenAPI/API examples と実装が同期し、不正 request は明示的に拒否される
- Component: API routes / OpenAPI / APIGateway / contract tests
- Source: FACT-024
- Confidence: confirmed

## TASK-013: チャット UI の操作性を維持する

- Actor: `CHAT_USER`
- Intent: 回答閲覧、コピー、送信ショートカット、scroll/loading を迷わず扱う
- Outcome: 回答・根拠・debug panel の表示が崩れず、copy/send/loading 操作が期待通りに動く
- Component: Chat UI / Web components
- Source: FACT-021
- Confidence: confirmed

## TASK-014: 履歴を検索・並び替え・通知確認する

- Actor: `CHAT_USER`
- Intent: 過去の会話、問い合わせ回答通知、お気に入り履歴を効率よく見つける
- Outcome: fuzzy/substring search、sort tiebreak、回答通知、favorite filter が userId 境界内で動く
- Component: History API / History UI / Notification state
- Source: FACT-010, FACT-021
- Confidence: confirmed

## TASK-015: PDF/OCR/大容量文書を安全に ingest する

- Actor: `RAG_GROUP_MANAGER`, `BENCHMARK_RUNNER`
- Intent: PDF や OCR が必要な文書を、timeout や quota を考慮して登録・評価に使う
- Outcome: upload size validation、S3 handoff、async OCR/ingest、fallback/skip が追跡可能に動く
- Component: Upload API / S3 / Textract / Document ingest run / Benchmark corpus seed
- Source: FACT-022, FACT-015
- Confidence: confirmed

## TASK-016: RAG 回答可能性 policy を調整・評価する

- Actor: system, `SYSTEM_ADMIN`, evaluator
- Intent: threshold、clause polarity、abbreviation、value mismatch などの回答可能性判定を改善する
- Outcome: 根拠十分性と不支持回答拒否が dataset 固有 hardcode なしで安定する
- Component: Answerability gate / Support verifier / LLM judge / Policy profiles
- Source: FACT-018, FACT-013
- Confidence: confirmed

## TASK-017: chunking と retrieval adoption gate を管理する

- Actor: system, `RAG_GROUP_MANAGER`, evaluator
- Intent: semantic chunking、search cycle、retrieval evaluator の結果を使って採用可能な根拠だけを回答に渡す
- Outcome: query/context に応じた chunk と retrieval result が trace され、低品質 retrieval は改善 action または拒否に流れる
- Component: Chunker / Search cycle graph / Retrieval evaluator / RAG graph
- Source: FACT-019
- Confidence: confirmed

## TASK-018: Debug trace を時系列で再現し artifact として取得する

- Actor: `SYSTEM_ADMIN`
- Intent: RAG 実行の判定・文単位評価・timeline を調査し、必要に応じて JSON/Markdown artifact を取得する
- Outcome: trace timeline、sentence assessments、finalEvidence、download artifact が redaction 済みで取得できる
- Component: Debug routes / Trace serializer / S3 or direct download
- Source: FACT-020
- Confidence: confirmed

## TASK-019: Benchmark dataset adapter と metrics を管理する

- Actor: `BENCHMARK_OPERATOR`, `BENCHMARK_RUNNER`
- Intent: Allganize、MMRAG DocQA、NeoAI などの dataset を評価可能な corpus/run に変換する
- Outcome: dataset 固有値を実装へ hardcode せず、metrics、skipped rows、report artifact を一貫して生成する
- Component: Benchmark adapters / Metrics / Report artifacts
- Source: FACT-023
- Confidence: confirmed

## TASK-020: Benchmark 実行の timeout・cost・artifact を制御する

- Actor: `BENCHMARK_OPERATOR`, Ops
- Intent: 長時間 benchmark を止めずに追跡し、費用と artifact を管理する
- Outcome: timeout 延長、progress/metrics、raw results download、cost/anomaly/tag の運用 guard がある
- Component: Benchmark UI/API / CodeBuild / Infra cost guard
- Source: FACT-023, FACT-024
- Confidence: confirmed

## TASK-021: 管理画面でユーザー・role・全ユーザー一覧を扱う

- Actor: `USER_ADMIN`, `ACCESS_ADMIN`, `SYSTEM_ADMIN`
- Intent: 管理対象ユーザーを確認し、role を付与・削除し、必要な管理情報を表示する
- Outcome: all users view、admin me permissions、role assignment、Cognito group sync が認可境界内で動く
- Component: Admin UI / Admin API / Cognito
- Source: FACT-017
- Confidence: confirmed

## TASK-022: API route を領域別に分割して仕様同期を維持する

- Actor: API maintainer, system
- Intent: OpenAPI と route 実装の競合・巨大化を抑え、保護 route の policy 更新漏れを防ぐ
- Outcome: domain route split 後も OpenAPI、access-control policy、API docs check が同期する
- Component: API routes / OpenAPI docs / access-control-policy.test
- Source: FACT-024, FACT-025
- Confidence: confirmed

## TASK-023: 仕様・要件 docs の coverage を継続管理する

- Actor: Tech writer, Codex agent, reviewer
- Intent: 実装レポートから要件・仕様・受け入れ条件を継続的に同期する
- Outcome: 1 要件 1 ファイル、SWEBOK-lite、coverage test、traceability が保たれる
- Component: `memorag-bedrock-mvp/docs` / `docs/spec-recovery` / validation scripts
- Source: FACT-025
- Confidence: confirmed

## TASK-024: 作業レポートを仕様化対象と対象外に分類する

- Actor: Codex agent, reviewer
- Intent: 作業レポート全量から product behavior に関係する情報だけを仕様復元に使う
- Outcome: commit/PR/merge only レポートを task 化せず、機能・品質・運用レポートから task family を抽出する
- Component: Spec recovery process / Report inventory
- Source: FACT-016
- Confidence: confirmed
