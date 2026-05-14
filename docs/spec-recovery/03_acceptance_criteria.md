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

## AC-QA-003: 回答不能・低評価からの問い合わせ診断は無害化される

- Task: TASK-003, TASK-H-SUPPORT-SEARCH-IMPROVEMENT
- Type: security_boundary
- Confidence: inferred
- Source: docs/spec/2026-chapter-spec.md 7A/7B, docs/spec/gap-phase-h.md

### Given
- `CHAT_USER` が回答不能または低評価から問い合わせを作成する
- 問い合わせには `chatRunId`、`messageId`、`ragRunId` または debug trace reference が関連付く

### When
- 問い合わせ担当者が ticket 詳細または診断情報を確認する

### Then
- 診断情報は `support_sanitized` 相当の allowlist に限定される
- 権限外文書名、権限外件数、ACL group、内部 policy、raw prompt、LLM の内部推論は含まれない
- 担当者が関連文書へ遷移する場合も担当者自身の resource permission が確認される

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

## AC-SRCH-003: 検索改善候補は人間 review 後にのみ公開される

- Task: TASK-004, TASK-H-SUPPORT-SEARCH-IMPROVEMENT
- Type: security_boundary
- Confidence: inferred
- Source: docs/spec/2026-chapter-spec.md 8, docs/spec/gap-phase-h.md

### Given
- 検索 0 件、低評価、問い合わせ、回答不能から検索改善候補が作成されている

### When
- AI または担当者が候補を作成し、検索に反映しようとする

### Then
- AI は候補を draft / review 待ちに置くだけで、自動公開しない
- 公開には review / publish 権限、検索結果差分確認、理由入力が必要である
- UI 文言では `alias` ではなく「検索改善」または「検索語対応づけ」を使う
- 検索改善ルールは ACL、resource permission、quality gate、search scope を拡張しない

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

## AC-AUTH-001: 許可された認証フローだけで利用開始できる

- Task: TASK-011
- Type: security
- Confidence: confirmed
- Source: FACT-017

### Given
- 未ログインユーザーまたは初回ログインユーザーがいる

### When
- login、new password required、self signup、password guidance を実行する

### Then
- 許可された Cognito flow だけが成功する
- 自己登録が許可される場合も最小 role に限定される
- 認証失敗や初回パスワード変更要求は UI で明示される

## AC-API-001: API 契約と request validation は実装と同期する

- Task: TASK-012, TASK-022
- Type: contract
- Confidence: confirmed
- Source: FACT-024

### Given
- API route または OpenAPI 定義を変更する

### When
- docs check、API contract test、access-control policy test を実行する

### Then
- request/response schema と route implementation が一致する
- 保護 route には認証境界と permission policy がある
- 不正 request は明示的な validation error になる

## AC-UI-001: Chat UI の基本操作は layout を崩さず動く

- Task: TASK-013
- Type: ui
- Confidence: confirmed
- Source: FACT-021

### Given
- `CHAT_USER` が chat 画面を開いている

### When
- 質問送信、回答 copy、根拠表示、scroll、loading、send shortcut を操作する

### Then
- 主要操作が keyboard/mouse で実行できる
- 回答、引用、debug panel、loading 表示が互いに重ならない
- copy/send 設定の状態が期待通りに反映される

## AC-HIST-002: 履歴検索・並び替え・通知は userId 境界を保つ

- Task: TASK-014
- Type: ui_data
- Confidence: confirmed
- Source: FACT-021

### Given
- ユーザーに複数の会話履歴、問い合わせ回答通知、お気に入りがある

### When
- 履歴検索、sort、favorite filter、通知確認を行う

### Then
- 自分の履歴だけが検索・表示される
- 同一時刻や短い substring でも安定した順序で表示される
- 問い合わせ回答の通知は本人の履歴から確認できる

## AC-DOC-003: PDF/OCR/大容量文書は非同期で安全に扱う

- Task: TASK-015
- Type: boundary_error_path
- Confidence: confirmed
- Source: FACT-022

### Given
- PDF、OCR が必要な文書、大容量文書、抽出不能文書のいずれかを処理する

### When
- upload、S3 handoff、async ingest、benchmark corpus seed を実行する

### Then
- size/quota 超過は明示エラーまたは skip として記録される
- OCR timeout は run 全体を不必要に fatal にしない
- ingest status、skip reason、artifact に追跡情報が残る

## AC-RAG-003: 回答可能性 policy は dataset 固有 hardcode なしで判定する

- Task: TASK-016
- Type: rag_quality
- Confidence: confirmed
- Source: FACT-018

### Given
- threshold、clause polarity、abbreviation、value mismatch を含む評価質問がある

### When
- answerability gate と support verifier を実行する

### Then
- dataset 固有の期待語句分岐ではなく、根拠・数値・言い換え・否定極性に基づき判定する
- 不十分または不支持の回答は拒否または確認質問に流れる
- 判定理由は trace に残る

## AC-SRCH-002: chunking と retrieval adoption gate は回答根拠を選別する

- Task: TASK-017
- Type: rag_retrieval
- Confidence: confirmed
- Source: FACT-019

### Given
- semantic chunking と hybrid retrieval が有効である

### When
- RAG graph が検索結果を評価する

### Then
- chunk、score、quality、nextAction が trace される
- 採用基準を満たす根拠だけが回答生成へ渡る
- 採用基準を満たさない場合は再検索、context expansion、または回答不能へ流れる

## AC-DBG-002: Debug trace artifact は redaction 済みで取得できる

- Task: TASK-018
- Type: security_operations
- Confidence: confirmed
- Source: FACT-020

### Given
- `SYSTEM_ADMIN` が debug run を調査している

### When
- timeline、sentence assessments、JSON/Markdown download を要求する

### Then
- redaction 済み artifact が取得できる
- finalEvidence と判定 step を時系列で追跡できる
- 通常ユーザーは artifact を取得できない

## AC-BENCH-002: dataset adapter は metrics と skipped rows を一貫生成する

- Task: TASK-019
- Type: benchmark_quality
- Confidence: confirmed
- Source: FACT-023

### Given
- Allganize、MMRAG DocQA、NeoAI などの dataset を benchmark へ投入する

### When
- dataset adapter と runner が評価を実行する

### Then
- corpus、expected answer、source context、skip reason が正規化される
- metrics と report artifact が dataset をまたいで比較可能な形で生成される
- dataset 固有値は product 実装へ hardcode されない

## AC-BENCH-003: Benchmark の timeout・cost・artifact は運用可能に追跡できる

- Task: TASK-020
- Type: operations
- Confidence: confirmed
- Source: FACT-023, FACT-024

### Given
- 長時間 benchmark run が実行されている

### When
- runner、CodeBuild、UI/API が進捗を更新する

### Then
- timeout、progress、metrics、raw results download が確認できる
- cost/anomaly/tag の運用 guard がある
- 失敗時も原因と未生成 artifact が区別される

## AC-ADM-002: 管理画面は role と全ユーザー一覧を権限内で扱う

- Task: TASK-021
- Type: admin_security
- Confidence: confirmed
- Source: FACT-017

### Given
- `USER_ADMIN` または `ACCESS_ADMIN` が管理画面を開く

### When
- 全ユーザー一覧、admin me permissions、role assignment を操作する

### Then
- 付与可能 role と操作対象は permission により制限される
- 自己昇格や権限外 role 付与は拒否される
- Cognito group sync と audit が残る

## AC-DOCS-001: 仕様 docs は implementation report と trace できる

- Task: TASK-023, TASK-024
- Type: documentation_traceability
- Confidence: confirmed
- Source: FACT-016, FACT-025, FACT-026

### Given
- 新しい作業レポートまたは既存 docs/tests の変更がある

### When
- spec recovery を更新する

### Then
- 各 report に `RPT-*` ID、分類、対象/対象外、関連 task が記録される
- product behavior に関係するものだけ task/fact/AC に取り込まれる
- commit/PR/merge only レポートは対象外として分類される
- 要件・仕様・E2E・gap から report source または task family へ逆引きできる

## Coverage gaps

- GAP-003: 対応 mime type の完全リスト、OCR timeout の本番閾値は未確定。ただし upload size validation と timeout/skip task は追加済み。
- GAP-004: prompt injection 文書を含む end-to-end 受け入れ条件は初版では仕様候補止まり。
- GAP-006: accessibility、latency SLO、cost SLO は SQ/NFR に存在するが、UI 操作単位の AC は代表ケースのみ復元。
