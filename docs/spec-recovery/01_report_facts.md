# Report Facts

| ID | Source | 原文/根拠要約 | 抽出事実 | 対象 | 信頼度 | 備考 |
|---|---|---|---|---|---|---|
| FACT-001 | SRC-001 | MemoRAG MVP は登録済み文書を対象に質問し、根拠付き回答または回答不能理由を返す。 | システムの中核目的は、登録文書に基づく自然言語 QA と根拠提示/回答不能制御である。 | RAG QA | confirmed | REQ/ASR の上位根拠。 |
| FACT-002 | SRC-003, SRC-004 | `POST /documents`、upload handoff、`POST /document-ingest-runs`、events が定義されている。 | 文書登録は同期 API と非同期 ingest run の両経路を持ち、通常運用では非同期 ingest run を使う。 | 文書管理 | confirmed | 大きな PDF/OCR を考慮。 |
| FACT-003 | SRC-003, SRC-011 | `POST /chat-runs` と `GET /chat-runs/{runId}/events` は queued/status/final/error/timeout を SSE で返す。 | Chat は非同期 run と event stream により進捗・最終回答を返し、`/chat` は後方互換同期 API として残る。 | Chat run | confirmed | Web は fetch stream を使う。 |
| FACT-004 | SRC-009 | `answerability_gate` の後段に `sufficient_context_gate` を置き、PARTIAL/UNANSWERABLE は回答生成へ進めない。 | 回答生成前に根拠十分性を判定し、不十分なら拒否へ流す。 | RAG guard | confirmed | LLM judge 品質は要調整。 |
| FACT-005 | SRC-010 | `verify_answer_support` が回答後に不支持文を検出し、unsupported answer を拒否する。 | 回答生成後も引用支持関係を検証し、根拠を超えた回答を返さない。 | RAG guard | confirmed | 自動縮退回答は未実装。 |
| FACT-006 | SRC-008, SRC-016 | Hybrid search は lexical/vector/RRF/ACL metadata filter を使い、retrieval evaluator は quality と nextAction を trace/state に残す。 | 検索は hybrid retrieval と評価ノードにより品質を制御する。 | Search | confirmed | query rewrite/expand context は未実装。 |
| FACT-007 | SRC-005, SRC-006 | protected routes と permission policy が静的テストで列挙されている。 | API は route-level permission と user/requester/run/benchmark seed 例外を静的に検査している。 | Access control | confirmed | route 追加時に policy 更新が必要。 |
| FACT-008 | SRC-007, SRC-019 | RBAC は Cognito groups 由来であり、管理 role 変更は Cognito group 同期が必要。 | 管理画面の role 付与は認可源泉である Cognito group と同期される必要がある。 | Admin/RBAC | confirmed | 既存環境 role 付け替えは open question。 |
| FACT-009 | SRC-018, SRC-014 | 通常ユーザーは問い合わせ作成後に list/debug を事前取得せず、本人の ticket 詳細だけ確認できる。 | 回答不能時の人手問い合わせは、通常ユーザー本人と担当者権限の境界を分ける。 | Human escalation | confirmed | `internalMemo` は本人向けレスポンスから除外。 |
| FACT-010 | SRC-012, SRC-013 | 会話履歴は DB 保存され、`isFavorite` は既存履歴 item 内 boolean として扱う。 | 会話履歴とお気に入りは userId 境界内で保存・一覧・削除される。 | History/Favorite | confirmed | item size/pagination はリスク。 |
| FACT-011 | SRC-015 | `/chat` includeDebug は admin permission を要求し、trace output から機微フィールドを除外する。 | Debug trace は管理者限定かつ redaction された出力で扱う。 | Debug trace | confirmed | `detail` 側の追加 sanitize は余地あり。 |
| FACT-012 | SRC-017, SRC-020, SRC-021 | Benchmark は runner service user、CodeBuild、corpus seed、CDK context、download を含む。 | Benchmark は API 認可、runner 認証、corpus seed 隔離、artifact 生成を必要とする運用機能である。 | Benchmark/Ops | confirmed | 実 AWS の一部挙動は未検証。 |
| FACT-013 | SRC-002 | ASR-TRUST/GUARD/RETRIEVAL/EVAL/SEC/OPER が主要 driver。 | RAG 根拠性、guard、検索品質、評価可能性、認可、運用追跡性が主要品質要求である。 | Quality attributes | confirmed | 要件分類の横断軸。 |
| FACT-014 | SRC-022 | RailNav/AppRoutes は chat/history/favorites/benchmark/documents/admin を permission に応じて表示する。 | Web UI は権限に応じて性能テスト、文書管理、管理者設定を出し分ける。 | Web UI | inferred | UI 文言/詳細操作はコードからの推定。 |
| FACT-015 | SRC-020 | Textract timeout は benchmark seed で skipped_unextractable として扱う修正済み。 | OCR 失敗は benchmark 全体を fatal にせず、対象 row を skip できる必要がある。 | Benchmark corpus | confirmed | AWS rerun は未確認。 |
