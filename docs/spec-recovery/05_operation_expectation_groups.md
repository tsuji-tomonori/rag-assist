# Operation / Expectation Groups

## Group: ドキュメント管理

### Operations

| OP ID | E2E | 画面 | 操作種別 | 操作対象 | 操作内容 | 入力データ | 備考 |
|---|---|---|---|---|---|---|---|
| OP-001 | E2E-DOC-001 | ドキュメント管理 | navigate | サイドナビ | ドキュメント画面を開く | - | permission gated |
| OP-002 | E2E-DOC-001 | ドキュメント管理 | upload | ファイル入力 | 文書を選択して登録する | PDF/Markdown | mime type は Q-001 |
| OP-003 | E2E-DOC-001 | ドキュメント管理 | observe | ingest status | run event を確認する | runId | 非同期 ingest |

### Expectations

| EXP ID | E2E | 種別 | 期待値 | 対象 | 検証方法 | 備考 |
|---|---|---|---|---|---|---|
| EXP-001 | E2E-DOC-001 | UI表示 | 文書名と処理状態が表示される | 文書一覧 | UI/API | SPEC-DOC-001 |
| EXP-002 | E2E-DOC-001 | データ永続化 | runId と ingest event が記録される | ingest run | API/store | SPEC-DOC-002 |
| EXP-003 | E2E-DOC-001 | 権限制御 | write permission がないユーザーは登録できない | documents routes | API test | SPEC-SEC-001 |

### Derived specification candidates

- SPEC-DOC-001: ドキュメント管理画面は文書登録と処理状態確認を提供する。
- SPEC-DOC-002: 文書 ingest は run/event として追跡できる。

## Group: チャット QA / RAG guard

### Operations

| OP ID | E2E | 画面 | 操作種別 | 操作対象 | 操作内容 | 入力データ | 備考 |
|---|---|---|---|---|---|---|---|
| OP-010 | E2E-CHAT-001 | チャット | input | 質問欄 | 質問を入力する | question | - |
| OP-011 | E2E-CHAT-001 | チャット | submit | 送信ボタン | chat run を開始する | question/model | `POST /chat-runs` |
| OP-012 | E2E-CHAT-001 | チャット | observe | 進捗表示 | SSE event を読む | runId | fetch stream |
| OP-013 | E2E-CHAT-002 | チャット | submit | 送信ボタン | 根拠なし質問を送る | question | no-answer case |

### Expectations

| EXP ID | E2E | 種別 | 期待値 | 対象 | 検証方法 | 備考 |
|---|---|---|---|---|---|---|
| EXP-010 | E2E-CHAT-001 | RAG回答内容 | 回答が引用 chunk に支持される | answer/citations | support verifier | SPEC-RAG-001 |
| EXP-011 | E2E-CHAT-001 | UI表示 | 進捗と最終回答が表示される | chat UI | UI/E2E | SPEC-CHAT-001 |
| EXP-012 | E2E-CHAT-002 | RAG品質 | 根拠不足時は推測回答しない | responseType | API/test | SPEC-RAG-002 |
| EXP-013 | E2E-CHAT-001 | 回復性 | Last-Event-ID で再接続できる | SSE stream | contract/E2E | SPEC-CHAT-002 |

### Derived specification candidates

- SPEC-CHAT-001: チャット UI は非同期 run の進捗と最終回答を表示する。
- SPEC-CHAT-002: Chat run stream は reconnect と timeout/error event を扱う。
- SPEC-RAG-001: 回答は final evidence/citation に支持される。
- SPEC-RAG-002: 根拠不足時は回答不能または確認質問にする。

## Group: 問い合わせ / 履歴 / お気に入り

### Operations

| OP ID | E2E | 画面 | 操作種別 | 操作対象 | 操作内容 | 入力データ | 備考 |
|---|---|---|---|---|---|---|---|
| OP-020 | E2E-QA-001 | チャット | create | 問い合わせ | 回答不能質問を担当者へ送る | question | `POST /questions` |
| OP-021 | E2E-QA-001 | 担当者対応 | answer | 回答フォーム | 回答を登録する | answer | `answer:publish` |
| OP-022 | E2E-QA-001 | 履歴 | sync | ticket badge | 回答到着を確認する | questionId | targeted GET |
| OP-023 | E2E-HIST-001 | 履歴 | favorite | 履歴 item | お気に入りにする | isFavorite | - |
| OP-024 | E2E-HIST-001 | 履歴 | delete | 履歴 item | 削除する | id | owner boundary |

### Expectations

| EXP ID | E2E | 種別 | 期待値 | 対象 | 検証方法 | 備考 |
|---|---|---|---|---|---|---|
| EXP-020 | E2E-QA-001 | 権限制御 | 通常ユーザーは本人 ticket だけ詳細確認できる | questions API | API test | SPEC-QA-001 |
| EXP-021 | E2E-QA-001 | セキュリティ | `internalMemo` は本人向けに返らない | response schema | API test | SPEC-SEC-002 |
| EXP-022 | E2E-HIST-001 | データ永続化 | 履歴は userId 境界内で保存される | history store | API/store test | SPEC-HIST-001 |
| EXP-023 | E2E-HIST-001 | UI表示 | favorite only view が表示できる | history UI | UI test | SPEC-HIST-002 |

## Group: 検索 / Benchmark / Debug / Admin

### Operations

| OP ID | E2E | 画面 | 操作種別 | 操作対象 | 操作内容 | 入力データ | 備考 |
|---|---|---|---|---|---|---|---|
| OP-030 | E2E-SRCH-001 | 非UI/Chat | search | `/search` | hybrid search を実行する | query/filter | ACL filter |
| OP-031 | E2E-DBG-001 | Debug panel | select | debug run | trace を開く | runId | admin only |
| OP-032 | E2E-BENCH-001 | 性能テスト | create | benchmark run | run を起動する | suite/model | operator |
| OP-033 | E2E-ADM-001 | 管理者設定 | assign | role | role を付与する | role/user | Cognito sync |

### Expectations

| EXP ID | E2E | 種別 | 期待値 | 対象 | 検証方法 | 備考 |
|---|---|---|---|---|---|---|
| EXP-030 | E2E-SRCH-001 | 検索品質 | lexical/vector/RRF の結果が統合される | search results | API/test | SPEC-SRCH-001 |
| EXP-031 | E2E-SRCH-001 | 権限制御 | 権限外文書が結果に出ない | results | API/test | SPEC-SEC-003 |
| EXP-032 | E2E-DBG-001 | セキュリティ | debug trace は admin only かつ redaction 済み | debug routes | policy test | SPEC-DBG-001 |
| EXP-033 | E2E-BENCH-001 | 評価 | benchmark run と artifact を追跡できる | benchmark run | API/CI | SPEC-BENCH-001 |
| EXP-034 | E2E-ADM-001 | 認可 | role 付与が Cognito group/JWT に反映される | admin/Cognito | API/infra test | SPEC-ADM-001 |
