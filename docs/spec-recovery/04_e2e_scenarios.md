# E2E Scenarios

## E2E-DOC-001: 文書をアップロードし ingest 進捗を確認する

- Acceptance Criteria: AC-DOC-001, AC-DOC-002
- Target screen: ドキュメント管理画面
- Actor: `RAG_GROUP_MANAGER`
- Priority: high
- Confidence: inferred
- Source: TASK-001, FACT-002, FACT-014

### 前提条件
- ユーザーがログイン済みである
- ユーザーに `rag:doc:write:group` がある
- テスト用 PDF または Markdown 文書がある

### 画面操作
1. サイドナビの「ドキュメント」を開く
2. アップロード操作を開始する
3. ファイルを選択して登録する
4. ingest run の status または event 表示を確認する

### 期待値
- 登録要求が受け付けられる
- 文書一覧にファイル名と処理状態が表示される
- 失敗時はエラー状態と再試行/調査に必要な runId が分かる

### 非UI検証
- `POST /document-ingest-runs` が runId を返す
- `GET /document-ingest-runs/{runId}/events` が final/error まで追跡できる
- 権限なしユーザーでは write API が 403 になる

## E2E-CHAT-001: 根拠付き回答を streaming で受け取る

- Acceptance Criteria: AC-CHAT-001, AC-CHAT-003
- Target screen: チャット画面
- Actor: `CHAT_USER`
- Priority: high
- Confidence: confirmed
- Source: TASK-002, FACT-003

### 前提条件
- アクセス可能な文書に質問の答えが含まれている

### 画面操作
1. チャット画面を開く
2. 質問入力欄へ文書内容に関する質問を入力する
3. 送信する
4. 進捗表示と最終回答を待つ

### 期待値
- 送信後に queued / processing 相当の状態が表示される
- 最終回答に引用または参照元が表示される
- 回答本文が引用 chunk と矛盾しない

### 非UI検証
- `POST /chat-runs` が runId/eventsPath を返す
- SSE final event が `answer`、`citations`、必要に応じて `debugRunId` を返す

## E2E-CHAT-002: 根拠不足時に推測回答を避ける

- Acceptance Criteria: AC-CHAT-002
- Target screen: チャット画面
- Actor: `CHAT_USER`
- Priority: high
- Confidence: confirmed
- Source: TASK-002, FACT-004, FACT-005

### 前提条件
- アクセス可能な文書に質問への根拠がない

### 画面操作
1. チャット画面を開く
2. 根拠文書にない内容を質問する
3. 最終回答を確認する

### 期待値
- 回答不能理由または確認質問が表示される
- 架空の事実を断定しない
- 引用がない場合は根拠なしとして扱う

## E2E-QA-001: 問い合わせを作成し回答到着を履歴で確認する

- Acceptance Criteria: AC-QA-001, AC-QA-002
- Target screen: チャット画面 / 履歴画面 / 担当者対応画面
- Actor: `CHAT_USER`, `ANSWER_EDITOR`
- Priority: high
- Confidence: confirmed
- Source: TASK-003, FACT-009

### 前提条件
- 通常ユーザーが回答不能結果を受け取っている
- 担当者ユーザーに `answer:edit` と `answer:publish` がある

### 画面操作
1. 通常ユーザーが「担当者へ問い合わせ」相当の操作を行う
2. 担当者が担当者対応画面で問い合わせ一覧を開く
3. 担当者が回答を登録する
4. 通常ユーザーが履歴画面を開く

### 期待値
- 通常ユーザーでは `GET /questions` や `GET /debug-runs` の不要な 403 が発生しない
- 履歴に「返答あり」または同等の通知が表示される
- 通常ユーザー向け詳細に `internalMemo` は表示されない

## E2E-SRCH-001: 権限内文書だけを検索する

- Acceptance Criteria: AC-SRCH-001
- Target screen: 非UI検証 / Chat search path
- Actor: `CHAT_USER`
- Priority: high
- Confidence: confirmed
- Source: TASK-004, FACT-006, FACT-007

### 前提条件
- ユーザーがアクセスできる文書とアクセスできない文書がある
- 両方に同じ検索語が含まれる

### 画面操作
1. チャット画面で該当検索語を含む質問を送る
2. 必要に応じて search API を非UI検証する

### 期待値
- 回答と引用はアクセス可能な文書だけに基づく
- 権限外文書の fileName、chunk、metadata は表示されない

### 非UI検証
- `POST /search` の results に権限外 documentId が含まれない

## E2E-HIST-001: 履歴を保存しお気に入りで絞り込む

- Acceptance Criteria: AC-HIST-001
- Target screen: 履歴画面 / お気に入り画面
- Actor: `CHAT_USER`
- Priority: medium
- Confidence: confirmed
- Source: TASK-005, FACT-010

### 画面操作
1. チャットで回答を得る
2. 履歴画面を開く
3. 履歴 item をお気に入りにする
4. お気に入りビューへ切り替える
5. 履歴 item を削除する

### 期待値
- 保存した会話が履歴に表示される
- お気に入りにした item だけを絞り込める
- 削除後に同じ item は表示されない

## E2E-DBG-001: 管理者が debug trace を確認する

- Acceptance Criteria: AC-DBG-001
- Target screen: チャット画面 debug panel
- Actor: `SYSTEM_ADMIN`
- Priority: medium
- Confidence: confirmed
- Source: TASK-006, FACT-011

### 画面操作
1. 管理者としてログインする
2. debug mode を有効にして質問する
3. debug run を選択する
4. JSON download を作成する

### 期待値
- trace step、latency、検索/判定 summary を確認できる
- raw embeddings や不要な raw chunks は top-level output に露出しない
- 通常ユーザーでは同じ導線が表示または実行されない

## E2E-BENCH-001: Benchmark run を起動し結果を取得する

- Acceptance Criteria: AC-BENCH-001, AC-OPS-001
- Target screen: 性能テスト画面
- Actor: `BENCHMARK_OPERATOR`
- Priority: medium
- Confidence: confirmed
- Source: TASK-007, FACT-012, FACT-015

### 画面操作
1. 性能テスト画面を開く
2. suite と model/concurrency を選ぶ
3. run を起動する
4. run 詳細と download を確認する

### 期待値
- run が queued/running/succeeded/failed/cancelled のいずれかの状態で追跡できる
- 成功時は summary/results/report を取得できる
- OCR timeout などの corpus seed 問題は可能な限り skipped として記録される

## E2E-ADM-001: 管理者が role を付与し機能アクセスを有効化する

- Acceptance Criteria: AC-ADM-001
- Target screen: 管理者設定画面
- Actor: `ACCESS_ADMIN`, `SYSTEM_ADMIN`
- Priority: high
- Confidence: confirmed
- Source: TASK-008, FACT-008

### 画面操作
1. 管理者設定画面でユーザーを選択する
2. `ANSWER_EDITOR` または `BENCHMARK_OPERATOR` を付与する
3. 対象ユーザーで再ログインする
4. 担当者対応画面または性能テスト画面を開く

### 期待値
- Cognito group と JWT permission に role が反映される
- 対象画面が利用可能になる
- role 変更が audit log に残る

## E2E-AUTH-001: 初回ログインと自己登録制限を確認する

- Acceptance Criteria: AC-AUTH-001
- Target screen: Login / password guidance
- Actor: 未ログインユーザー, 初回ログインユーザー
- Priority: high
- Confidence: confirmed
- Source: TASK-011, FACT-017

### 画面操作
1. 初回パスワード変更が必要なユーザーでログインする
2. 新しいパスワードを設定する
3. 自己登録または許可されていない認証 flow を試す

### 期待値
- 初回パスワード変更後に通常ログインできる
- 許可されていない自己登録または auth flow は拒否される
- password guidance は利用者に分かる文言で表示される

## E2E-UI-001: チャット UI の copy/send/loading 操作を確認する

- Acceptance Criteria: AC-UI-001
- Target screen: Chat
- Actor: `CHAT_USER`
- Priority: medium
- Confidence: confirmed
- Source: TASK-013, FACT-021

### 画面操作
1. チャット画面で質問を入力する
2. 送信ショートカット設定を切り替える
3. 質問を送信し、loading と streaming 表示を確認する
4. 回答または prompt copy ボタンを押す

### 期待値
- send shortcut 設定どおりに送信される
- loading/streaming 表示中も主要 UI が重ならない
- copy 操作は対象テキストだけをコピーし、不要な feedback action は出ない

## E2E-HIST-002: 履歴検索と回答通知を確認する

- Acceptance Criteria: AC-HIST-002
- Target screen: History / question answer notification
- Actor: `CHAT_USER`
- Priority: medium
- Confidence: confirmed
- Source: TASK-014, FACT-021

### 画面操作
1. 複数の会話履歴を作成する
2. 短い substring または日本語語句で履歴検索する
3. sort と favorite filter を切り替える
4. 担当者回答後に履歴画面を開く

### 期待値
- 自分の履歴だけが検索対象になる
- 同一時刻や類似タイトルでも安定した順序で表示される
- 担当者回答通知が本人の履歴に表示される

## E2E-DOC-002: S3 upload と async OCR ingest を確認する

- Acceptance Criteria: AC-DOC-003
- Target screen: Documents / non-UI ingest verification
- Actor: `RAG_GROUP_MANAGER`
- Priority: high
- Confidence: confirmed
- Source: TASK-015, FACT-022

### 画面操作
1. 文書管理画面で PDF を選択する
2. S3 upload handoff または upload API を実行する
3. async ingest run を開始する
4. ingest status と events を確認する

### 期待値
- size/quota 超過時は明示エラーになる
- OCR が必要な文書は非同期処理として追跡できる
- timeout/抽出不能時は error または skipped reason が残る

## E2E-RAG-002: 回答可能性 policy の汎用判定を確認する

- Acceptance Criteria: AC-RAG-003
- Target screen: 非 UI RAG evaluation
- Actor: evaluator
- Priority: high
- Confidence: confirmed
- Source: TASK-016, FACT-018

### 非UI検証
1. threshold、clause polarity、abbreviation、value mismatch を含む評価 dataset を実行する
2. answerability gate、support verifier、trace を確認する

### 期待値
- dataset 固有 hardcode なしで判定される
- 根拠不足または不支持回答は拒否される
- 判定理由と根拠が trace に残る

## E2E-SRCH-002: chunking と retrieval adoption gate を確認する

- Acceptance Criteria: AC-SRCH-002
- Target screen: 非 UI RAG retrieval verification
- Actor: evaluator
- Priority: high
- Confidence: confirmed
- Source: TASK-017, FACT-019

### 非UI検証
1. semantic chunking が必要な文書を ingest する
2. hybrid retrieval と retrieval evaluator を実行する
3. adoption gate の quality/nextAction を確認する

### 期待値
- chunk と score が trace される
- 採用基準未満の根拠は回答生成へ渡らない
- 必要に応じて再検索、context expansion、回答不能へ流れる

## E2E-DBG-002: debug trace artifact を redaction 済みで取得する

- Acceptance Criteria: AC-DBG-002
- Target screen: Debug panel / artifact download
- Actor: `SYSTEM_ADMIN`
- Priority: medium
- Confidence: confirmed
- Source: TASK-018, FACT-020

### 画面操作
1. 管理者として debug run を開く
2. timeline と sentence assessments を確認する
3. JSON または Markdown artifact を download する

### 期待値
- finalEvidence と判定 step を時系列で追跡できる
- artifact は redaction 済みである
- 通常ユーザーでは download できない

## E2E-BENCH-002: dataset adapter と metrics を確認する

- Acceptance Criteria: AC-BENCH-002, AC-BENCH-003
- Target screen: Benchmark / report artifact
- Actor: `BENCHMARK_OPERATOR`, `BENCHMARK_RUNNER`
- Priority: medium
- Confidence: confirmed
- Source: TASK-019, TASK-020, FACT-023

### 画面操作
1. Allganize、MMRAG DocQA、NeoAI のいずれかの suite を選択する
2. benchmark run を起動する
3. run metrics、skipped rows、report artifact、raw results download を確認する

### 期待値
- dataset adapter が source context と expected answer を正規化する
- skipped rows と skip reason が report に残る
- timeout/cost/artifact の状態が UI/API で追跡できる

## E2E-DOCS-001: 作業レポートを仕様化対象と対象外に分類する

- Acceptance Criteria: AC-DOCS-001
- Target screen: 非 UI docs verification
- Actor: Codex agent, reviewer
- Priority: medium
- Confidence: confirmed
- Source: TASK-023, TASK-024, FACT-016, FACT-025, FACT-026

### 非UI検証
1. `reports/working/*.md` と `reports/bugs/*.md` の本文を全件読む
2. 各 report に `RPT-*` ID を付ける
3. commit/PR/merge only を task 化対象外へ分ける
4. product behavior に関係する category から task family を抽出する

### 期待値
- 対象外理由が inventory に残る
- 個別 `RPT-*` から関連 task へ trace できる
- 追加 task、AC、REQ/SPEC、gap が trace できる
- 代表抽出、ファイル名分類、本文精読の違いが明示される
