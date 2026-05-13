# MemoRAG MVP 高レベル設計

- ファイル: `docs/3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- 種別: `DES_HLD`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

アーキテクチャで定義した RAG 構造を、要求カテゴリ、論理コンポーネント、処理フロー、詳細設計へ対応付ける。

HLD は詳細手順の正本ではなく、要求を実装可能なサブシステムへ分解する索引である。個別コンポーネントの入出力、処理手順、例外処理、テスト観点は `11_詳細設計_DLD/` の文書を正とする。

## 設計の読み方

この設計は次の階層で読む。

1. 要求カテゴリ: `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/` の大分類に対応する利用者価値または運用能力。
2. 論理コンポーネント: 要求カテゴリを実現するための実装単位。英語名はコードや API の責務名、日本語名は設計上の説明名とする。
3. カテゴリ別フロー: そのカテゴリで利用者または運用者がたどる主要な処理順序。
4. 詳細設計: 各コンポーネント群の入出力、判定、データ、例外、テスト観点を定義する DLD。

## 要求カテゴリと論理コンポーネント

| 要求カテゴリ | 関連要求 | 論理コンポーネント | 対応 DLD |
|---|---|---|---|
| 文書・知識ベース管理 | `FR-001`, `FR-002`, `FR-007`, `FR-008`, `FR-020` | Ingestion Handler、Memory Builder、Document Catalog、Index Lifecycle Manager | `DES_DLD_006` |
| チャット QA・根拠提示・回答不能制御 | `FR-003`, `FR-004`, `FR-005`, `FR-006`, `FR-009`, `FR-029` | Query Orchestrator、Answer Generator、Clarification Gate、Response Finalizer | `DES_DLD_001`, `DES_DLD_005` |
| RAG 検索品質制御 | `FR-016`, `FR-017`, `FR-018`, `FR-023`, `FR-026`, `TC-001` | Hybrid Retriever、Lightweight Lexical Retriever、Semantic Retriever、Retrieval Evaluator、Rank Fusion、Alias Manager | `DES_DLD_002`, `DES_DLD_003` |
| 回答検証・ガードレール | `FR-014`, `FR-015` | Answerability Gate、Citation Validator、Answer Support Verifier | `DES_DLD_001` |
| 会話履歴・お気に入り | `FR-022`, `FR-028`, `FR-030`, `NFR-005` | Conversation History Store、Favorite Store、Conversation Search Index | `DES_DLD_007` |
| 問い合わせ・人手対応 | `FR-021`, `NFR-011` | Human Question Store、Answer Draft Manager、Assignee Workflow | `DES_DLD_007` |
| 評価・debug・benchmark | `FR-010`, `FR-011`, `FR-012`, `FR-013`, `FR-019`, `SQ-001`, `NFR-005`, `NFR-006` | Debug Trace Store、Benchmark Runner、Benchmark Report Exporter | `DES_DLD_009` |
| 認証・認可・管理・監査 | `FR-024`, `FR-025`, `FR-027`, `NFR-010`, `NFR-011` | Authorization Layer、Identity Provisioning、Web Admin Workspace、Admin Ledger、Admin Audit Log | `DES_DLD_004`, `DES_DLD_008` |
| 利用量・コスト見積もり | `NFR-002`, `NFR-009` | Usage Meter、Pricing Catalog、Cost Estimator | `DES_DLD_010` |

## 論理コンポーネント一覧

| 英語名 | 日本語名 | 役割説明 | 入力 | 出力 | 責務境界 |
|---|---|---|---|---|---|
| Ingestion Handler | 文書取り込みハンドラ | アップロードされた文書を検証し、文書 ID、manifest、保存先を確定する入口。 | fileName、text、metadata、user context | documentId、manifest、source text reference | 文書本文の受け付けと保存準備までを扱い、検索順位や回答生成は行わない。 |
| Memory Builder | メモリ・根拠生成器 | source text と metadata から memory record と evidence chunk を生成する。 | source text、document metadata | memory record、evidence chunk、chunk manifest | chunk 化と memory/evidence 生成に集中し、利用者質問への回答は行わない。 |
| Document Catalog | 文書台帳 | 登録文書の状態、manifest、indexVersion、削除状態を保持する。 | documentId、manifest、lifecycle event | document list、document detail、lifecycle status | 文書状態の正本を扱い、検索 runtime の ranking logic は持たない。 |
| Index Lifecycle Manager | インデックスライフサイクル管理器 | stage、cutover、rollback により blue-green 再インデックスを管理する。 | staged index、current index、operation request | active indexVersion、rollback result | index の切り替えを扱い、個別 query の検索品質評価は行わない。 |
| Query Orchestrator | 質問応答制御器 | 質問受付から検索、判定、回答、拒否、trace 記録までの順序を制御する。 | question、settings、user context、conversation context | answer/refusal、citations、metadata、trace reference | workflow の順序制御に集中し、検索、生成、検証の内部ロジックを直接抱え込まない。 |
| Clarification Gate | 確認質問判定器 | 対象が曖昧な質問に対して grounded option を返すか通常検索へ進むかを判定する。 | question、memory cards、retrieved evidence、history | clarification response、missingSlots、reason | 選択肢生成と分岐判定を扱い、最終回答は生成しない。 |
| Hybrid Retriever | ハイブリッド検索器 | キーワード検索と意味検索を統合し、ACL guard 後の evidence 候補を返す。 | query/clue、embedding、filters、user context | fused candidate chunks、retrieval diagnostics | 候補取得、重複排除、RRF、ACL guard に集中し、回答文は作らない。 |
| Lightweight Lexical Retriever | 軽量語彙検索器 | BM25、CJK n-gram、prefix、ASCII fuzzy、alias expansion で語彙一致候補を返す。 | normalized query、alias map、metadata filters | lexical candidate chunks | alias 定義の作成や publish は行わず、publish 済み alias の適用だけを扱う。 |
| Semantic Retriever | 意味検索器 | embedding と vector store adapter を使い、意味的に近い evidence 候補を返す。 | query embedding、metadata filters | semantic candidate chunks | embedding 済み query の検索に集中し、再 embedding や回答生成を行わない。 |
| Rank Fusion | 順位統合器 | lexical、semantic、複数 clue の候補順位を RRF で統合する。 | ranked chunk lists | fused ranked chunks、score details | score 尺度の異なる候補を順位で統合し、回答可能性の最終判断はしない。 |
| Retrieval Evaluator | 検索結果評価器 | 必要事実が検索済み evidence で満たされているかを評価し、次 action を選ぶ。 | candidates、required facts、action history | retrievalQuality、missingFactIds、nextAction、reason | 検索継続、rerank、拒否候補の判断までを扱い、回答文は生成しない。 |
| Alias Manager | 検索別名管理器 | 検索 alias を scope、version、review、publish、audit log 付きで管理する。 | alias draft、scope、review request | aliasVersion、published alias artifact、audit log | alias 定義の lifecycle を扱い、検索 runtime では publish 済み artifact の参照に限定する。 |
| Answerability Gate | 回答可否判定器 | evidence だけで回答可能か、部分的か、回答不能かを判定する。 | question、evidence、computed facts | answerability label、reason | 回答してよいかを判定し、回答文の自然文化は行わない。 |
| Answer Generator | 回答生成器 | 支持済み evidence と computed facts だけを使って grounded answer を生成する。 | question、supported evidence、computed facts | grounded answer、usedChunkIds、usedComputedFactIds | 根拠外の推測を加えず、引用・支持検証を後段へ渡す。 |
| Citation Validator | 引用検証器 | 回答が実在する evidence chunk または computed fact を参照しているか検証する。 | answer、candidate chunks、computed facts | citation validation result、citations | 引用 ID の存在と対応を検証し、主張内容の支持判定は後段へ渡す。 |
| Answer Support Verifier | 回答支持検証器 | 回答文の主要文が引用 chunk または computed fact に支持されているか検証する。 | answer、cited evidence chunks、computed facts | supported/unsupported sentence、supportingChunkIds | 不支持文がある回答をそのまま返さず、拒否または修復へ落とす。 |
| Response Finalizer | 応答確定器 | 回答、拒否、確認質問、metadata、trace reference を API response として確定する。 | workflow state、validation result、trace reference | chat response、refusal response、clarification response | 最終 response の整形に集中し、新たな根拠生成や検索判断は行わない。 |
| Conversation History Store | 会話履歴ストア | userId ごとに会話 item を永続化し、履歴一覧と復元を提供する。 | userId、conversation item | user-scoped conversation list、conversation detail | user scope を超える履歴共有は行わず、schemaVersion を保持する。 |
| Favorite Store | お気に入りストア | 利用者が重要な会話または回答を保存、解除、一覧取得できるようにする。 | userId、favorite target | favorite list、favorite state | お気に入り状態だけを扱い、回答内容の再生成は行わない。 |
| Conversation Search Index | 会話履歴検索インデックス | userId 単位で会話履歴を検索できる軽量 index を提供する。 | userId、query、conversation summary | matching conversation summaries | 履歴検索に集中し、権限外 userId の会話や debug trace 本文を返さない。 |
| Human Question Store | 人手問い合わせストア | 回答不能時の問い合わせ ticket と回答状態を保存する。 | question ticket、answer draft、status update | ticket detail、担当者問い合わせ状態 | 担当者対応の状態管理に集中し、RAG 回答品質判定は行わない。 |
| Answer Draft Manager | 担当者回答案管理器 | 人手問い合わせに対する回答案、公開状態、解決状態を管理する。 | ticketId、draft answer、status、assignee user | updated draft、published answer、audit event | 担当者回答案の状態管理に集中し、RAG の自動回答生成とは分離する。 |
| Assignee Workflow | 担当者対応ワークフロー | 問い合わせの割り当て、回答、解決、再オープンの状態遷移を制御する。 | ticket status、assignee、operation request | next status、assignment result | 問い合わせ対応の状態遷移を扱い、通常利用者の履歴所有境界を変更しない。 |
| Debug Trace Store | debug trace ストア | workflow event、検索診断、判定理由を権限付きで保存・参照する。 | workflow events、diagnostics、decision reasons | run trace、download artifact | raw prompt、ACL metadata、過剰な chunk text を無権限に公開しない。 |
| Benchmark Runner | benchmark 実行器 | dataset case を UI 非依存で実行し、評価指標と report を出力する。 | dataset case、runtime profile | result、summary、report | `/chat` と同等の RAG path を評価し、dataset 固有の固定分岐を実装へ入れない。 |
| Benchmark Report Exporter | benchmark レポート出力器 | benchmark result から JSON summary と Markdown report を生成する。 | case results、runtime profile、metrics | summary JSON、Markdown report | 評価結果の集計と出力に集中し、runtime の回答品質を補正しない。 |
| Authorization Layer | 認可レイヤ | Cognito group から permission を算出し、API 実行可否を判定する。 | Cognito group、route permission、resource context | allow/deny、permission set | API 側の permission 判定を正とし、Web 側表示制御だけに依存しない。 |
| Identity Provisioning | ID 発行・初期権限付与 | self sign-up と確認コード検証後の `CHAT_USER` 付与を扱う。 | email、password、confirmation code、Cognito trigger event | self sign-up user、`CHAT_USER` group membership | 通常利用者作成に限定し、上位権限付与は管理 workflow に分離する。 |
| Web Admin Workspace | 管理ワークスペース | 文書、alias、問い合わせ、debug、benchmark、ユーザー、監査、コストの管理 view を提供する。 | permissions、admin resources | 管理 view、operation request | 表示と操作導線を提供し、API 側認可を迂回しない。 |
| Admin Ledger | 管理台帳 | 管理対象ユーザー、role group、操作履歴、利用状況、概算コストの API contract を提供する。 | user、group assignment、admin audit log、usage summary | Phase 2 管理台帳 | Cognito Admin API 連携は adapter に分離し、台帳 contract を安定させる。 |
| Admin Audit Log | 管理操作監査ログ | 管理操作の actor、target、operation、result、reason を保存する。 | admin operation event | audit log item、audit list | 監査に必要な要約を保存し、password、token、secret などの機微値は保持しない。 |
| Usage Meter | 利用量メーター | trace、manifest、DynamoDB item、Lambda metrics から料金算出用の使用量を集計する。 | trace、manifest、metrics | usage summary | 請求額の正本ではなく、見積もりに必要な集計値を作る。 |
| Pricing Catalog | 料金カタログ | service、region、unit ごとの単価を保持する。 | pricing source、version | pricing catalog entry | 単価未登録を 0 円扱いせず、見積もり不能として返す。 |
| Cost Estimator | コスト見積もり器 | 利用量に単価を適用し、service/component 別の概算料金を算出する。 | usage meter、pricing catalog、期間 | service/component 別の概算料金 | AWS 請求の正本ではなく、運用監視と予算逸脱検知向けの概算値を扱う。 |

## カテゴリ別主要フロー

### 文書登録・インデックス作成フロー

1. 文書管理担当者は `documents` view から fileName、text、metadata を送信する。
2. API は認可、入力検証、metadata schema validation を行う。
3. Ingestion Handler は documentId を採番し、source text と manifest の保存先を確定する。
4. Memory Builder は source text を chunk 化し、memory record と evidence chunk を生成する。
5. Index Lifecycle Manager は staged index を作り、検証後に active indexVersion へ cutover する。
6. Document Catalog は document status、manifest、indexVersion を更新する。
7. Debug Trace Store は取り込み結果と lifecycle event を運用者向け trace として保存する。

### 質問応答フロー

1. API は `/chat` の認可と入力検証を行う。
2. Query Orchestrator は質問、settings、user context、conversation context を正規化する。
3. Clarification Gate は対象が曖昧で grounded option を作れる場合に確認質問へ分岐する。
4. Query Orchestrator は clue と検索 query を生成する。
5. Hybrid Retriever は lexical retrieval と semantic retrieval から evidence 候補を取得する。
6. Rank Fusion は source と query をまたぐ複数候補を統合する。
7. Retrieval Evaluator は必要事実の充足を評価し、追加 evidence search、rerank、拒否のいずれかを選ぶ。
8. Answerability Gate は evidence と computed facts だけで回答可能かを判定する。
9. Answer Generator は回答可能な場合だけ grounded answer を生成する。
10. Citation Validator は回答が実在する evidence chunk または computed fact を引用しているか検証する。
11. Answer Support Verifier は回答文と引用根拠の支持関係を検証する。
12. Response Finalizer は回答または拒否結果、citations、trace metadata を返す。

### 検索品質制御フロー

1. Hybrid Retriever は query ごとに Lightweight Lexical Retriever と Semantic Retriever を呼び出す。
2. Lightweight Lexical Retriever は publish 済み alias を scope 内で展開し、BM25 / n-gram / prefix / fuzzy 候補を返す。
3. Semantic Retriever は embedding と metadata filter で vector 候補を返す。
4. Rank Fusion は lexical / semantic / cross-query の順位を RRF で統合する。
5. ACL guard は user context に合わない候補を除外する。
6. Retrieval Evaluator は required facts、typed claim conflict、action history を使って検索継続または停止を判断する。
7. diagnostics は indexVersion、aliasVersion、source count、score distribution を含め、alias 本文や ACL 詳細は通常 response に出さない。

### 回答検証・拒否フロー

1. Answerability Gate は evidence だけで主要 fact を満たせない場合に回答生成へ進めない。
2. Citation Validator は `usedChunkIds` と `usedComputedFactIds` が選択済み根拠に対応するか検証する。
3. Answer Support Verifier は主要文ごとの支持根拠を確認する。
4. 不支持文、存在しない引用、根拠不足がある場合は Response Finalizer が拒否または修復結果を返す。
5. Debug Trace Store は判定理由と拒否理由を保存する。

### 会話履歴・お気に入りフロー

1. Web UI は回答または拒否結果を `schemaVersion` 付き conversation item として保存 API に送る。
2. API は userId による所有者境界を検証する。
3. Conversation History Store は user-scoped conversation を保存する。
4. 利用者がお気に入り操作を行う場合、Favorite Store は対象 item の favorite state を更新する。
5. 会話履歴検索では Conversation Search Index が userId と検索語で候補を返す。

### 人手問い合わせフロー

1. 回答不能時に利用者が担当者問い合わせを作成する。
2. Human Question Store は ticket、元質問、関連 conversation、状態を保存する。
3. 担当者または管理者は permission に応じて問い合わせ一覧を取得する。
4. Answer Draft Manager は担当者回答案、公開状態、解決状態を更新する。
5. Web UI は作成済み ticket と回答状態を会話に紐づけて表示する。

### 管理・監査フロー

1. Web Admin Workspace は `GET /me` の permission に応じて文書、alias、問い合わせ、debug、benchmark、ユーザー、監査、利用量、コストの view を表示する。
2. Authorization Layer は各 API route で permission と resource scope を検証する。
3. 管理者は Admin Ledger を通じて管理対象ユーザー、role group、利用状況、概算コストを参照する。
4. アクセス管理者は Admin Audit Log で管理操作履歴を参照する。
5. 上位権限付与は self sign-up ではなく、管理者 workflow または AWS 管理手順で行う。

### benchmark 評価フロー

1. Benchmark Runner は dataset case と runtime profile を読み込む。
2. Benchmark Runner は UI を経由せず、`/chat` と同等の RAG path を実行する。
3. Debug Trace Store は検索、判定、生成、検証の trace を保存する。
4. Benchmark Report Exporter は result、summary、report を出力する。
5. 評価結果は retrieval recall、citation hit、faithfulness、answerability などの観点で確認する。

### 利用量・コスト見積もりフロー

1. Usage Meter は trace、document/vector manifest、DynamoDB item サイズ、Lambda 実行メトリクスから使用量を集計する。
2. Pricing Catalog は service、region、unit、version ごとの単価を提供する。
3. Cost Estimator は使用量に単価を適用し、期間別、service 別、component 別の概算料金を算出する。
4. 単価未登録または usage source が概算の場合は confidence を下げ、請求額として断定しない。

### self sign-up / 権限付与フロー

1. 未認証の通常利用者は Web UI でアカウント作成を行う。
2. Web UI は Cognito `SignUp` と `ConfirmSignUp` を使う。
3. Cognito post-confirmation trigger は確認済みユーザーに `CHAT_USER` のみを付与する。
4. `SYSTEM_ADMIN` などの上位権限は管理者 workflow または AWS 管理手順で明示的に付与する。
5. Authorization Layer は API 側で permission を再計算し、Web 側表示制御だけに依存しない。

## 詳細設計一覧

| DLD | 対象 |
|---|---|
| `DES_DLD_001` | RAG workflow、回答可能性判定、検索評価、回答生成、引用検証、回答支持検証、計算層との接続 |
| `DES_DLD_002` | `POST /search` と agent `search_evidence` が使う hybrid retrieval algorithm |
| `DES_DLD_003` | 検索 alias の lifecycle、scope、versioned artifact、監査、評価 |
| `DES_DLD_004` | Cognito self sign-up、確認コード、post-confirmation trigger、最小権限付与 |
| `DES_DLD_005` | Temporal / Computation Layer と computed facts |
| `DES_DLD_006` | 文書取り込み、memory/evidence 生成、文書台帳、index lifecycle |
| `DES_DLD_007` | 会話履歴、お気に入り、人手問い合わせ |
| `DES_DLD_008` | 認可レイヤ、管理ワークスペース、管理台帳、監査 |
| `DES_DLD_009` | debug trace、benchmark 実行、評価 report |
| `DES_DLD_010` | 利用量メーター、料金カタログ、コスト見積もり |

## アーキテクチャ判断との関係

- `ARC_ADR_001`: サーバレス RAG と guard 付き pipeline の採用。
- `ARC_QA_001`: 根拠性、不回答品質、検索品質、セキュリティを品質属性として扱う。
- `ARC_CAPABILITY_001`: 要求カテゴリを能力単位に分解し、設計コンポーネントへ対応付ける。
