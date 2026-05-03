# MemoRAG MVP 機能要求分類索引

- ファイル: `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md`
- 種別: `REQ_FUNCTIONAL_INDEX`
- 作成日: 2026-05-04
- 状態: Draft

## 目的

この索引は、1要件1ファイルで管理する `FR-*` を L0-L3 の機能分類で再構成し、主分類と関連カテゴリを追跡しやすくするための文書である。

各 `REQ_FUNCTIONAL_*` ファイルの要求文と受け入れ条件を正とし、本索引は分類、探索、レビュー、影響確認の入口として使う。

## 分類ルール

- L0 は `rag-assist / MemoRAG MVP 機能要件` とする。
- L1 は 8 大カテゴリとする。
- L2 はカテゴリ内の機能群とする。
- L3 は個別の `FR-*` 要件とする。
- 各 `FR-*` は主分類の L1 を 1 つだけ持つ。
- 複数カテゴリにまたがる要件は `関連カテゴリ` として扱い、主分類には重複登録しない。

## L0-L1 ツリー

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

## L1-L3 主分類マップ

### 1. 文書・知識ベース管理

RAG の入力資産である文書を登録し、検索可能な知識ベースへ変換し、不要になった文書を整合的に削除する領域である。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 1.1 文書登録 | [`FR-001`](REQ_FUNCTIONAL_001.md) | 利用者は文書をアップロードできる。 |
| 1.2 文書のQA利用可能化 | [`FR-002`](REQ_FUNCTIONAL_002.md) | アップロード文書は質問回答に使える状態になる。 |
| 1.3 文書削除 | [`FR-007`](REQ_FUNCTIONAL_007.md) | 利用者は文書を識別子単位で削除できる。 |
| 1.3 文書削除 | [`FR-008`](REQ_FUNCTIONAL_008.md) | 文書削除時に紐づく管理情報も削除される。 |
| 1.5 多抽象度メモリ生成 | [`FR-020`](REQ_FUNCTIONAL_020.md) | raw chunk とは別に section / document / concept memory を生成できる。 |

### 2. チャットQA・根拠提示・回答不能制御

利用者が直接触る QA 体験を扱う。質問入力、回答表示、引用表示、回答不能時のメッセージ、UI 上の一連操作をまとめる。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 2.1 質問入力・回答取得 | [`FR-003`](REQ_FUNCTIONAL_003.md) | 利用者は質問を入力して回答を受け取れる。 |
| 2.2 根拠提示 | [`FR-004`](REQ_FUNCTIONAL_004.md) | 回答には根拠として使った文書箇所を表示できる。 |
| 2.3 回答不能表示 | [`FR-005`](REQ_FUNCTIONAL_005.md) | 根拠不足時は回答できない旨を明示する。 |
| 2.4 回答挙動の調整 | [`FR-006`](REQ_FUNCTIONAL_006.md) | 利用者は回答精度調整に関わる設定値を指定できる。 |
| 2.5 統合チャットUI | [`FR-009`](REQ_FUNCTIONAL_009.md) | 画面上で文書アップロード、質問、回答確認を一連で行える。 |

### 3. RAG検索品質制御

RAG の回答品質を左右する検索制御を扱う。検索計画、hybrid retrieval、RRF、検索品質評価、alias 管理を含む。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 3.1 検索計画 | [`FR-017`](REQ_FUNCTIONAL_017.md) | `SearchPlan` と `SearchAction` を state に保持し、実行履歴と観測結果を追跡する。 |
| 3.2 検索実行 | [`FR-026`](REQ_FUNCTIONAL_026.md) | lexical retrieval、S3 Vectors semantic search、RRF を統合した hybrid retriever を使う。 |
| 3.3 検索結果統合 | [`FR-018`](REQ_FUNCTIONAL_018.md) | 複数 query / clue の検索結果を順位融合で統合する。 |
| 3.4 検索結果評価 | [`FR-016`](REQ_FUNCTIONAL_016.md) | 検索結果品質を評価し、次の検索行動または拒否判断を選ぶ。 |
| 3.6 検索alias管理 | [`FR-023`](REQ_FUNCTIONAL_023.md) | tenant / source / docType / ACL scope を持つ versioned alias artifact を管理できる。 |

### 4. 回答検証・ガードレール

誤回答や根拠外回答を抑えるための制御層を扱う。回答生成前の十分性判定、回答生成後の支持関係検証、strict grounded 制御を含む。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 4.1 回答前ガード | [`FR-014`](REQ_FUNCTIONAL_014.md) | 検索済みチャンクだけで質問に回答可能かを `ANSWERABLE` / `PARTIAL` / `UNANSWERABLE` で判定する。 |
| 4.3 回答後検証 | [`FR-015`](REQ_FUNCTIONAL_015.md) | 回答文の各主要文が引用対象チャンクで支持されているか検証する。 |
| 4.4 strict grounded 制御 | [`FR-015`](REQ_FUNCTIONAL_015.md) | unsupported sentence がある場合、拒否または再生成へ送れる。 |

### 5. 会話履歴・お気に入り

利用者が過去のやり取りを再利用するための機能群を扱う。会話履歴の保存、一覧、削除、スキーマ互換性、お気に入り抽出を含む。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 5.1 会話履歴保存 | [`FR-022`](REQ_FUNCTIONAL_022.md) | 利用者は自分の会話履歴を永続的に保存できる。 |
| 5.2 会話履歴再表示 | [`FR-022`](REQ_FUNCTIONAL_022.md) | `userId` 単位で会話履歴を一覧取得できる。 |
| 5.3 会話履歴削除 | [`FR-022`](REQ_FUNCTIONAL_022.md) | `userId` 単位で会話履歴を削除できる。 |
| 5.4 履歴スキーマ管理 | [`FR-022`](REQ_FUNCTIONAL_022.md) | 会話履歴 item は `schemaVersion` を持つ。 |
| 5.5 お気に入り | [`FR-028`](REQ_FUNCTIONAL_028.md) | 会話履歴をお気に入り登録・解除し、お気に入りのみを抽出表示できる。 |

### 6. 問い合わせ・人手対応

RAG が回答できなかった場合に利用者を行き止まりにしないための業務フローを扱う。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 6.1 問い合わせ登録 | [`FR-021`](REQ_FUNCTIONAL_021.md) | 利用者は回答不能な質問を担当者向け問い合わせとして登録できる。 |
| 6.2 問い合わせ属性 | [`FR-021`](REQ_FUNCTIONAL_021.md) | タイトル、質問本文、依頼者情報、担当部署、優先度を送信できる。 |
| 6.3 問い合わせ状態管理 | [`FR-021`](REQ_FUNCTIONAL_021.md) | open / answered / resolved の状態で管理できる。 |
| 6.4 担当者回答 | [`FR-021`](REQ_FUNCTIONAL_021.md) | 担当者は回答本文と内部メモを保存できる。 |
| 6.5 通常利用者導線 | [`FR-021`](REQ_FUNCTIONAL_021.md) | 通常利用者は担当者一覧や debug trace に依存せず送信完了を確認できる。 |

### 7. 評価・debug・benchmark

RAG の品質を測定し、改善サイクルを回すための機能群を扱う。debug trace、UI 非依存評価、外部連携仕様、benchmark 指標を含む。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 7.1 実行履歴確認 | [`FR-010`](REQ_FUNCTIONAL_010.md) | 画面上で過去の実行結果詳細を確認できる。 |
| 7.2 実行結果ダウンロード | [`FR-011`](REQ_FUNCTIONAL_011.md) | 実行結果の詳細をダウンロードできる。 |
| 7.3 UI非依存評価 | [`FR-012`](REQ_FUNCTIONAL_012.md) | 評価担当者は画面を使わずに同等の質問評価を実行できる。 |
| 7.4 外部連携仕様 | [`FR-013`](REQ_FUNCTIONAL_013.md) | 外部連携向けの仕様情報を参照できる。 |
| 7.5 benchmark 指標 | [`FR-019`](REQ_FUNCTIONAL_019.md) | fact coverage、faithfulness、context relevance、refusal precision / recall を評価できる。 |
| 7.6 評価レポート | [`FR-019`](REQ_FUNCTIONAL_019.md) | 既存の answerable、citation、expected file 指標を維持する。 |

### 8. 認証・認可・管理・監査

利用者作成、最小権限、管理者権限、操作監査、利用状況、コスト監査をまとめる。

| L2 | L3 要求 | 要旨 |
| --- | --- | --- |
| 8.1 通常利用者アカウント作成 | [`FR-025`](REQ_FUNCTIONAL_025.md) | 未認証利用者はログイン画面から Cognito アカウントを作成できる。 |
| 8.2 最小権限付与 | [`FR-025`](REQ_FUNCTIONAL_025.md) | self sign-up 後は `CHAT_USER` のみを付与する。 |
| 8.3 上位権限付与 | [`FR-025`](REQ_FUNCTIONAL_025.md) | 上位権限は管理ユーザーが GitHub Actions または AWS 管理手順で後から付与する。 |
| 8.4 Phase 1 RAG運用管理 | [`FR-024`](REQ_FUNCTIONAL_024.md) | 管理画面から文書管理、問い合わせ対応、debug/評価、性能テストへ遷移できる。 |
| 8.5 Phase 2 ユーザー管理 | [`FR-027`](REQ_FUNCTIONAL_027.md) | ユーザー作成、一覧参照、停止、再開、削除状態管理を実行できる。 |
| 8.6 Phase 2 ロール管理 | [`FR-027`](REQ_FUNCTIONAL_027.md) | role / permission 対応参照、role group 付与ができる。 |
| 8.7 監査 | [`FR-027`](REQ_FUNCTIONAL_027.md) | 管理操作履歴を参照できる。 |
| 8.8 利用状況・コスト監査 | [`FR-027`](REQ_FUNCTIONAL_027.md) | 全ユーザー利用状況と service / component 別の概算コストを参照できる。 |

## 関連カテゴリ

| 要件 | 主カテゴリ | 関連カテゴリ |
| --- | --- | --- |
| [`FR-005`](REQ_FUNCTIONAL_005.md) | 2. チャットQA・根拠提示・回答不能制御 | 4. 回答検証・ガードレール |
| [`FR-020`](REQ_FUNCTIONAL_020.md) | 1. 文書・知識ベース管理 | 3. RAG検索品質制御 |
| [`FR-023`](REQ_FUNCTIONAL_023.md) | 3. RAG検索品質制御 | 8. 認証・認可・管理・監査 |
| [`FR-024`](REQ_FUNCTIONAL_024.md) | 8. 認証・認可・管理・監査 | 1. 文書・知識ベース管理、6. 問い合わせ・人手対応、7. 評価・debug・benchmark |
| [`FR-027`](REQ_FUNCTIONAL_027.md) | 8. 認証・認可・管理・監査 | 7. 評価・debug・benchmark |
