# Acceptance Criteria

## AC-DOC-001: 文書登録は非同期 ingest として追跡できる

- Task: TASK-001
- Type: normal_path
- Confidence: confirmed
- Source: FACT-002

### Given
- `RAG_GROUP_MANAGER` が認証済みである
- 対応 mime type の文書 upload が完了している

### When
- ユーザーが `POST /document-ingest-runs` を実行する

### Then
- runId と events path が返る
- run status と event stream で queued / processing / final または error を追跡できる
- 登録文書は同一ユーザーまたは許可 group の検索対象になる

## AC-DOC-002: 文書登録権限がない場合は登録できない

- Task: TASK-001
- Type: permission
- Confidence: confirmed
- Source: FACT-007

### Given
- `CHAT_USER` が認証済みである

### When
- `POST /documents` または `POST /document-ingest-runs` を実行する

### Then
- `rag:doc:write:group` 不足として拒否される
- 文書 manifest、upload session、embedding は作成されない

## AC-CHAT-001: 根拠付き回答は引用を含む

- Task: TASK-002
- Type: rag_answer_faithfulness
- Confidence: confirmed
- Source: FACT-001, FACT-003, FACT-005

### Given
- `CHAT_USER` が認証済みである
- アクセス可能な文書に質問への根拠が存在する

### When
- ユーザーが `POST /chat-runs` で質問し、SSE final event を受け取る

### Then
- `responseType=answer` または同等の回答が返る
- 回答には引用または参照元が含まれる
- 回答内容は `finalEvidence` または citation の chunk により支持される

## AC-CHAT-002: 根拠不足時は推測で答えない

- Task: TASK-002
- Type: rag_no_answer
- Confidence: confirmed
- Source: FACT-004, FACT-005

### Given
- アクセス可能な文書に質問の根拠がない、または context が partial / unanswerable と判定される

### When
- ユーザーが質問を送信する

### Then
- 回答生成に進まず、回答不能理由または確認質問が返る
- 根拠のない断定は返らない

## AC-CHAT-003: 非同期 chat stream は再接続可能である

- Task: TASK-002
- Type: retry_or_recovery
- Confidence: confirmed
- Source: FACT-003

### Given
- chat run が作成済みである

### When
- SSE 接続が切断され、クライアントが `Last-Event-ID` を付けて再接続する

### Then
- final または error まで event を継続取得できる
- timeout/failure 時は error または timeout event と run status が記録される

## AC-QA-001: 回答不能質問を担当者へ送信できる

- Task: TASK-003
- Type: normal_path
- Confidence: confirmed
- Source: FACT-009

### Given
- `CHAT_USER` が回答不能結果を受け取っている

### When
- ユーザーが担当者へ問い合わせを作成する

### Then
- ticket が作成される
- 通常ユーザーは担当者一覧 API を読まずに送信完了を確認できる
- ticket は requesterUserId に紐づく

## AC-QA-002: 本人以外は問い合わせ詳細を読めない

- Task: TASK-003
- Type: permission
- Confidence: confirmed
- Source: FACT-009

### Given
- ある `CHAT_USER` が作成した ticket が存在する

### When
- 別の通常ユーザーが `GET /questions/{questionId}` を実行する

### Then
- 本人でも `ANSWER_EDITOR` でもないため拒否される
- `internalMemo` は通常ユーザー本人向け response に含まれない

## AC-SRCH-001: 検索結果は権限と metadata で絞り込まれる

- Task: TASK-004
- Type: security_boundary
- Confidence: confirmed
- Source: FACT-006, FACT-007

### Given
- 複数 group / tenant の文書が登録されている

### When
- `CHAT_USER` が `POST /search` を実行する

### Then
- ユーザーがアクセスできない文書 chunk は結果に含まれない
- response metadata は allowlist 済みで、ACL group や内部 alias 定義を露出しない

## AC-HIST-001: 会話履歴は userId ごとに保存・削除される

- Task: TASK-005
- Type: data_persistence
- Confidence: confirmed
- Source: FACT-010

### Given
- `CHAT_USER` が回答を受け取っている

### When
- 会話履歴を保存し、一覧取得または削除する

### Then
- 自分の履歴だけが一覧に表示される
- 他ユーザーの履歴は取得/削除できない
- `isFavorite` 未指定の既存 item は `false` として扱われる

## AC-DBG-001: Debug trace は管理者だけが読める

- Task: TASK-006
- Type: security
- Confidence: confirmed
- Source: FACT-011

### Given
- `CHAT_USER` が認証済みである

### When
- `GET /debug-runs` または `includeDebug=true` の chat を実行する

### Then
- `chat:admin:read_all` 不足として拒否される
- UI は通常ユーザーで debug 一覧を事前取得しない

## AC-BENCH-001: Benchmark operator は run を起動できる

- Task: TASK-007
- Type: normal_path
- Confidence: confirmed
- Source: FACT-012

### Given
- `BENCHMARK_OPERATOR` が認証済みである

### When
- benchmark suite を選択し、`POST /benchmark-runs` を実行する

### Then
- benchmark run が作成される
- runner は service user token を自動取得して本番 API を評価する
- summary/results/report の artifact を後で取得できる

## AC-ADM-001: Role 付与は Cognito group に反映される

- Task: TASK-008
- Type: permission
- Confidence: confirmed
- Source: FACT-008

### Given
- `ACCESS_ADMIN` が管理対象ユーザーへ role を付与する

### When
- role 更新 API を実行する

### Then
- 管理台帳だけでなく Cognito group が更新される
- 対象ユーザーの次回 token/permission に role が反映される
- role 変更は audit に残る

## AC-OPS-001: OCR timeout は benchmark 全体を fatal にしない

- Task: TASK-007
- Type: error_path
- Confidence: confirmed
- Source: FACT-015

### Given
- benchmark corpus seed 中に Textract OCR が timeout する PDF がある

### When
- corpus seed が対象 PDF を処理する

### Then
- 対象 corpus は `skipped_unextractable` として記録される
- 対応 dataset row は skippedRows として扱われる
- benchmark runner 全体は可能な限り結果 artifact を生成する

## Coverage gaps

- GAP-003: ファイルサイズ上限、対応 mime type の完全リスト、OCR timeout の運用閾値は未確定。
- GAP-004: prompt injection 文書を含む end-to-end 受け入れ条件は初版では仕様候補止まり。
- GAP-006: accessibility、latency SLO、cost SLO は SQ/NFR に存在するが、UI 操作単位の AC までは未復元。
