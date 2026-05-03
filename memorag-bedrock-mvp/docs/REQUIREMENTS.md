# MemoRAG MVP 要求仕様（SWEBOK-lite 索引）

- ファイル: `memorag-bedrock-mvp/docs/REQUIREMENTS.md`
- 種別: `REQ_PRODUCT`
- 作成日: 2026-05-01
- 状態: Draft

## 要件の位置づけ

MemoRAG MVP は、登録済み文書を対象に自然言語で質問し、根拠付き回答または回答不能理由を返す RAG 支援システムである。

本要求仕様は SWEBOK の Software Requirements に合わせ、要件抽出、要件分析、要件仕様、妥当性確認、要件管理を分けて扱う。

## 運用ルール

- すべての要件は **1要件1ファイル** で管理する。
- 各要件ファイルには、当該要件の **受け入れ条件** を同一ファイル内に必ず記載する。
- 本ファイルはインデックスとして扱い、詳細要件は分割ファイルを正とする。
- 実装手段に近い内容は `02_architecture` 相当の `2_アーキテクチャ_ARC/` または `03_design` 相当の `3_設計_DES/` に分離する。

## 要件の分類

| 分類 | 保存先 | 内容 |
| --- | --- | --- |
| プロジェクト要求 | `1_要求_REQ/01_プロジェクト要求_PROJECT/` | 目的、スコープ、ロードマップ、優先順位 |
| 機能要求 | `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/` | 文書登録、質問応答、根拠提示、担当者問い合わせ、会話履歴、お気に入り、debug trace、benchmark |
| 非機能要求 | `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/` | ローカル検証、運用コスト、追跡性、保持期間、認証・認可 |
| 技術制約 | `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/01_技術制約_TECHNICAL_CONSTRAINT/` | Lambda、TypeScript、S3 Vectors、軽量 lexical retrieval など |
| サービス品質制約 | `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/11_サービス品質制約_SERVICE_QUALITY/` | 不回答性能、根拠性、検索再現率、権限外漏えい、レイテンシ |
| 受入基準 | `1_要求_REQ/21_受入基準_ACCEPTANCE/` | 横断的な完了条件、BDD シナリオ、評価観点 |
| 変更管理 | `1_要求_REQ/31_変更管理_CHANGE/` | トレーサビリティ、変更影響、要求管理手順 |

## 要件源とステークホルダー

| 種別 | 主な関心事 |
| --- | --- |
| 利用者 | 登録文書に基づく回答、根拠確認、回答不能時の説明 |
| 評価担当者 | benchmark API、評価データセット、品質メトリクス |
| 運用担当者 | debug trace、監視、コスト、障害調査 |
| セキュリティ管理者 | 認可、権限外情報の露出防止、監査性 |
| 開発者 | ローカル検証、保守性、設計判断の追跡 |

要件源は、既存 MVP の実装、RAG 品質強化ロードマップ、ユーザーから提示された SWEBOK 整理方針、`memorag-bedrock-mvp/docs/DOCS_STRUCTURE.md` の構成方針である。

## 要件分析

| 論点 | 衝突 | 管理方法 |
| --- | --- | --- |
| 根拠性 vs 回答率 | 根拠不足時に答えると幻覚リスクが上がる | `FR-005`, `FR-014`, `FR-015` を ASR として扱い、拒否を許容する |
| 検索品質 vs レイテンシ | clue 生成、hybrid retrieval、RRF、再検索は品質を上げるが遅延を増やす | `SQ-001` で品質指標を継続測定し、trace diagnostics により段階的に調整する |
| 実装速度 vs 検索基盤の汎用性 | OpenSearch 互換を目指すと MVP の焦点がぼやける | `TC-001` により S3 Vectors と軽量 retriever に制約する |
| 調査性 vs 情報露出 | debug trace は便利だが文書内容を含み得る | `NFR-010` と認可設計で本番アクセスを制限する |
| 担当者対応 vs 最小権限 | 問い合わせ送信後に担当者一覧や debug trace を読むと通常利用者に不要な権限が必要になる | `FR-021` と `NFR-011` により、送信は利用者導線、一覧・回答は担当者導線に分離する |

## 機能要求の L0-L3 分類

機能要求は、L0 を `rag-assist / MemoRAG MVP 機能要件`、L1 を 8 大カテゴリ、L2 を機能群、L3 を個別の `FR-*` 要求として読む。

主分類は 1 つに固定し、複数カテゴリにまたがる要件は関連カテゴリをトレーサビリティで補足する。

```text
L0. rag-assist / MemoRAG MVP 機能要件
├─ 1. 文書・知識ベース管理
├─ 2. チャットQA・根拠提示・回答不能制御
├─ 3. RAG検索品質制御
├─ 4. 回答検証・ガードレール
├─ 5. 会話履歴・お気に入り
├─ 6. 問い合わせ・人手対応
├─ 7. 評価・debug・benchmark
└─ 8. 認証・認可・管理・監査
```

### 1. 文書・知識ベース管理

RAG の入力資産である文書を登録し、検索可能な知識ベースへ変換し、不要になった文書を整合的に削除する領域である。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 1.1 文書登録 | `FR-001` | 利用者は文書をアップロードできる。 |
| 1.2 文書のQA利用可能化 | `FR-002` | アップロード文書は質問回答に使える状態になる。 |
| 1.3 文書削除 | `FR-007` | 利用者は文書を識別子単位で削除できる。 |
| 1.3 文書削除 | `FR-008` | 文書削除時に紐づく管理情報も削除される。 |
| 1.4 文書管理UI | `FR-024` | documents view で文書一覧、アップロード、削除を実行できる。 |
| 1.5 多抽象度メモリ生成 | `FR-020` | raw chunk とは別に section / document / concept memory を生成できる。 |

### 2. チャットQA・根拠提示・回答不能制御

利用者が直接触る QA 体験を扱う。質問入力、回答表示、引用表示、回答不能時のメッセージ、UI 上の一連操作をまとめる。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 2.1 質問入力・回答取得 | `FR-003` | 利用者は質問を入力して回答を受け取れる。 |
| 2.2 根拠提示 | `FR-004` | 回答には根拠として使った文書箇所を表示できる。 |
| 2.3 回答不能表示 | `FR-005` | 根拠不足時は回答できない旨を明示する。 |
| 2.4 回答挙動の調整 | `FR-006` | 利用者は回答精度調整に関わる設定値を指定できる。 |
| 2.5 統合チャットUI | `FR-009` | 画面上で文書アップロード、質問、回答確認を一連で行える。 |

### 3. RAG検索品質制御

RAG の回答品質を左右する検索制御を扱う。検索計画、hybrid retrieval、RRF、検索品質評価、alias 管理、多抽象度 memory を含む。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 3.1 検索計画 | `FR-017` | `SearchPlan` と `SearchAction` を state に保持し、実行履歴と観測結果を追跡する。 |
| 3.2 検索実行 | `FR-026` | lightweight lexical retrieval、S3 Vectors semantic search、RRF を統合した hybrid retriever を使う。 |
| 3.3 検索結果統合 | `FR-018` | 複数 query / clue の検索結果を順位融合で統合する。 |
| 3.4 検索結果評価 | `FR-016` | 検索結果品質を評価し、次の検索行動または拒否判断を選ぶ。 |
| 3.5 検索補助メモリ | `FR-020` | section / document / concept memory を検索補助に使える。 |
| 3.6 検索alias管理 | `FR-023` | tenant / source / docType / ACL scope を持つ versioned alias artifact を管理できる。 |

### 4. 回答検証・ガードレール

誤回答や根拠外回答を抑えるための制御層を扱う。回答生成前の十分性判定、回答生成後の支持関係検証、strict grounded 制御を含む。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 4.1 回答前ガード | `FR-014` | 検索済みチャンクだけで質問に回答可能かを `ANSWERABLE` / `PARTIAL` / `UNANSWERABLE` で判定する。 |
| 4.2 回答不能制御 | `FR-005` | 根拠不足時は回答できないことを明示する。 |
| 4.3 回答後検証 | `FR-015` | 回答文の各主要文が引用対象チャンクで支持されているか検証する。 |
| 4.4 strict grounded 制御 | `FR-015` | unsupported sentence がある場合、拒否または再生成へ送れる。 |

### 5. 会話履歴・お気に入り

利用者が過去のやり取りを再利用するための機能群を扱う。会話履歴の保存、一覧、削除、スキーマ互換性、お気に入り抽出を含む。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 5.1 会話履歴保存 | `FR-022` | 利用者は自分の会話履歴を永続的に保存できる。 |
| 5.2 会話履歴再表示 | `FR-022` | `userId` 単位で会話履歴を一覧取得できる。 |
| 5.3 会話履歴削除 | `FR-022` | `userId` 単位で会話履歴を削除できる。 |
| 5.4 履歴スキーマ管理 | `FR-022` | 会話履歴 item は `schemaVersion` を持つ。 |
| 5.5 お気に入り | `FR-028` | 会話履歴をお気に入り登録・解除できる。 |
| 5.5 お気に入り | `FR-028` | お気に入り状態を保存できる。 |
| 5.5 お気に入り | `FR-028` | お気に入り会話を優先表示できる。 |
| 5.5 お気に入り | `FR-028` | お気に入りのみを抽出表示できる。 |

### 6. 問い合わせ・人手対応

RAG が回答できなかった場合に利用者を行き止まりにしないための業務フローを扱う。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 6.1 問い合わせ登録 | `FR-021` | 利用者は回答不能な質問を担当者向け問い合わせとして登録できる。 |
| 6.2 問い合わせ属性 | `FR-021` | タイトル、質問本文、依頼者情報、担当部署、優先度を送信できる。 |
| 6.3 問い合わせ状態管理 | `FR-021` | open / answered / resolved の状態で管理できる。 |
| 6.4 担当者回答 | `FR-021` | 担当者は回答本文と内部メモを保存できる。 |
| 6.5 通常利用者導線 | `FR-021` | 通常利用者は担当者一覧や debug trace に依存せず送信完了を確認できる。 |

### 7. 評価・debug・benchmark

RAG の品質を測定し、改善サイクルを回すための機能群を扱う。debug trace、UI 非依存評価、外部連携仕様、benchmark 指標を含む。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 7.1 実行履歴確認 | `FR-010` | 画面上で過去の実行結果詳細を確認できる。 |
| 7.2 実行結果ダウンロード | `FR-011` | 実行結果の詳細をダウンロードできる。 |
| 7.3 UI非依存評価 | `FR-012` | 評価担当者は画面を使わずに同等の質問評価を実行できる。 |
| 7.4 外部連携仕様 | `FR-013` | 外部連携向けの仕様情報を参照できる。 |
| 7.5 benchmark 指標 | `FR-019` | fact coverage、faithfulness、context relevance、refusal precision / recall を評価できる。 |
| 7.6 評価レポート | `FR-019` | 既存の answerable、citation、expected file 指標を維持する。 |

### 8. 認証・認可・管理・監査

利用者作成、最小権限、管理者権限、操作監査、利用状況、コスト監査をまとめる。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 8.1 通常利用者アカウント作成 | `FR-025` | 未認証利用者はログイン画面から Cognito アカウントを作成できる。 |
| 8.2 最小権限付与 | `FR-025` | self sign-up 後は `CHAT_USER` のみを付与する。 |
| 8.3 上位権限付与 | `FR-025` | 上位権限は管理ユーザーが GitHub Actions または AWS 管理手順で後から付与する。 |
| 8.4 Phase 1 RAG運用管理 | `FR-024` | 管理画面から文書管理、問い合わせ対応、debug/評価、性能テストへ遷移できる。 |
| 8.5 Phase 2 ユーザー管理 | `FR-027` | ユーザー作成、一覧参照、停止、再開、削除状態管理を実行できる。 |
| 8.6 Phase 2 ロール管理 | `FR-027` | role / permission 対応参照、role group 付与ができる。 |
| 8.7 監査 | `FR-023` | alias 追加、review、disable、publish を audit log に記録できる。 |
| 8.7 監査 | `FR-027` | 管理操作履歴を参照できる。 |
| 8.8 利用状況・コスト監査 | `FR-027` | 全ユーザー利用状況と service / component 別の概算コストを参照できる。 |

### 関連カテゴリを持つ要件

| 要件 | 主カテゴリ | 関連カテゴリ |
| --- | --- | --- |
| `FR-005` 回答不能明示 | 2. チャットQA・根拠提示・回答不能制御 | 4. 回答検証・ガードレール |
| `FR-020` 多抽象度memory | 1. 文書・知識ベース管理 | 3. RAG検索品質制御 |
| `FR-023` alias管理 | 3. RAG検索品質制御 | 8. 認証・認可・管理・監査 |
| `FR-024` 管理画面 | 8. 認証・認可・管理・監査 | 1. 文書・知識ベース管理、6. 問い合わせ・人手対応、7. 評価・debug・benchmark |
| `FR-027` 管理者機能 | 8. 認証・認可・管理・監査 | 7. 評価・debug・benchmark |

## 要件仕様ファイル

### プロジェクト要求

- `1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md` (`PRJ-001`)

### 機能要求

- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_001.md` (`FR-001`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_002.md` (`FR-002`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_003.md` (`FR-003`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_004.md` (`FR-004`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_005.md` (`FR-005`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_006.md` (`FR-006`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_007.md` (`FR-007`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_008.md` (`FR-008`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_009.md` (`FR-009`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_010.md` (`FR-010`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_011.md` (`FR-011`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_012.md` (`FR-012`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_013.md` (`FR-013`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_014.md` (`FR-014`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_015.md` (`FR-015`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_016.md` (`FR-016`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_017.md` (`FR-017`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_018.md` (`FR-018`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_019.md` (`FR-019`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_020.md` (`FR-020`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_021.md` (`FR-021`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_022.md` (`FR-022`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_023.md` (`FR-023`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_024.md` (`FR-024`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_025.md` (`FR-025`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_026.md` (`FR-026`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_027.md` (`FR-027`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_028.md` (`FR-028`)

### 非機能要求

- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_001.md` (`NFR-001`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_002.md` (`NFR-002`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_003.md` (`NFR-003`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_004.md` (`NFR-004`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_005.md` (`NFR-005`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_006.md` (`NFR-006`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_007.md` (`NFR-007`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_008.md` (`NFR-008`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_009.md` (`NFR-009`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_010.md` (`NFR-010`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_011.md` (`NFR-011`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_012.md` (`NFR-012`)

### 技術制約とサービス品質制約

- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/01_技術制約_TECHNICAL_CONSTRAINT/REQ_TECHNICAL_CONSTRAINT_001.md` (`TC-001`)
- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/11_サービス品質制約_SERVICE_QUALITY/REQ_SERVICE_QUALITY_001.md` (`SQ-001`)

## 妥当性確認

横断的な受入観点は `1_要求_REQ/21_受入基準_ACCEPTANCE/REQ_ACCEPTANCE_001.md` に集約する。

各要件ファイルの受け入れ条件は、その要件だけを検証できる粒度を維持する。

## 要件管理とトレーサビリティ

要求変更手順と要求から設計までの対応は `1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md` を正とする。

主な対応関係は次の通り。

| 要求 | ASR | ADR | 設計 | 評価 |
| --- | --- | --- | --- | --- |
| `FR-003`, `FR-004`, `FR-005` | `ASR-TRUST-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_001`, `DES_API_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `FR-014`, `FR-015` | `ASR-GUARD-001` | `ARC_ADR_001` | `DES_DLD_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `FR-016`, `FR-017`, `FR-018`, `FR-026` | `ASR-RETRIEVAL-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_001`, `DES_DLD_002`, `DES_DATA_001` | `SQ-001` |
| `FR-019`, `SQ-001` | `ASR-EVAL-001` | `ARC_ADR_001` | `DES_DATA_001`, `DES_API_001` | `REQ_ACCEPTANCE_001` |
| `FR-023`, `NFR-012` | `ASR-SEC-001`, `ASR-RETRIEVAL-001` | `ARC_ADR_001` | `DES_DLD_002`, `DES_DLD_003`, `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `NFR-010` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001` |
| `FR-021`, `NFR-011` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001` |
| `FR-022` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001` |
| `FR-024`, `NFR-011` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_API_001` | `REQ_ACCEPTANCE_001` |
| `FR-025`, `NFR-011` | `ASR-SEC-002` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_004`, `DES_API_001` | `REQ_FUNCTIONAL_025` |
| `FR-027`, `NFR-011` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001` |
| `FR-028`, `NFR-011` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_API_001`, `DES_DATA_001` | `REQ_FUNCTIONAL_028` |
