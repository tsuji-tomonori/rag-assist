# MemoRAG MVP 機能要求分類索引

- ファイル: `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md`
- 種別: `REQ_FUNCTIONAL_INDEX`
- 作成日: 2026-05-04
- 状態: Draft

## 目的

この索引は、1要件1ファイルで管理する `FR-*` を L0-L3 の機能分類で整理し、主分類と関連カテゴリを追跡しやすくするための文書である。
個別 `REQ_FUNCTIONAL_*` ファイルの要求文と受け入れ条件を正とし、本索引は分類、探索、レビュー、変更影響確認の入口として使う。

## 分類ルール

- L0 は `rag-assist / MemoRAG MVP 機能要件` とする。
- L1 は 9 大カテゴリとする。
- L2 はカテゴリ内の **主機能群** とする。
- L3 は個別の `FR-*` 要件とする。
- 各 `FR-*` は L1 主分類と L2 主機能群をそれぞれ 1 つだけ持つ。
- 個別 `REQ_FUNCTIONAL_*` ファイルは、主分類に対応する `L1/L2/` ディレクトリ配下に配置する。
- 1 つの `FR-*` が複数の操作や受け入れ条件を含む場合でも、L3 主分類表には 1 行だけ登録する。
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
├─ 8. 認証・認可・管理・監査
└─ 9. UI/UX 基盤
```

## ディレクトリ構成

機能要求ディレクトリ直下の `README.md` を分類索引とし、個別要件は次のように L1 主分類、L2 主機能群の順で配置する。

```text
01_機能要求_FUNCTIONAL/
├─ README.md
├─ 01_文書・知識ベース管理/
│  ├─ 01_文書登録/
│  ├─ 02_文書のQA利用可能化/
│  ├─ 03_文書削除/
│  ├─ 05_多抽象度メモリ生成/
│  ├─ 06_非同期文書取り込み/
│  ├─ 07_スコープ付き資料グループ管理/
│  └─ 08_権限付き共有・ライフサイクル/
├─ 02_チャットQA・根拠提示・回答不能制御/
│  └─ 06_確認質問・曖昧性解消/
│  └─ 07_チャットUI操作性/
├─ 03_RAG検索品質制御/
│  └─ 07_安全なRAGライフサイクル/
├─ 04_回答検証・ガードレール/
├─ 05_会話履歴・お気に入り/
├─ 06_問い合わせ・人手対応/
├─ 07_評価・debug・benchmark/
├─ 08_認証・認可・管理・監査/
│  └─ 07_信頼済み認証文脈と資源認可/
└─ 09_UI_UX基盤/
   ├─ 01_アプリケーションナビゲーション/
   ├─ 02_共通状態契約/
   ├─ 03_高影響操作フィードバック/
   ├─ 04_ワークスペース状態保持/
   └─ 05_高密度UI情報設計/
```

## L1-L3 主分類マップ

### 1. 文書・知識ベース管理

| L2主機能群 | L3要件 | 要旨 |
| --- | --- | --- |
| 1.1 文書登録 | [`FR-001`](01_文書・知識ベース管理/01_文書登録/REQ_FUNCTIONAL_001.md) | 利用者が文書をアップロードできる。 |
| 1.2 文書のQA利用可能化 | [`FR-002`](01_文書・知識ベース管理/02_文書のQA利用可能化/REQ_FUNCTIONAL_002.md) | アップロード文書を質問回答に使える状態へ変換する。 |
| 1.3 文書削除 | [`FR-007`](01_文書・知識ベース管理/03_文書削除/REQ_FUNCTIONAL_007.md) | 利用者が文書を識別子単位で削除できる。 |
| 1.3 文書削除 | [`FR-008`](01_文書・知識ベース管理/03_文書削除/REQ_FUNCTIONAL_008.md) | 文書削除時に紐づく管理情報も削除する。 |
| 1.5 多抽象度メモリ生成 | [`FR-020`](01_文書・知識ベース管理/05_多抽象度メモリ生成/REQ_FUNCTIONAL_020.md) | raw chunk とは別に section / document / concept memory を生成する。 |
| 1.6 非同期文書取り込み | [`FR-038`](01_文書・知識ベース管理/06_非同期文書取り込み/REQ_FUNCTIONAL_038.md) | 長時間の文書取り込みを非同期 run として追跡する。 |
| 1.7 スコープ付き資料グループ管理 | [`FR-041`](01_文書・知識ベース管理/07_スコープ付き資料グループ管理/REQ_FUNCTIONAL_041.md) | Superseded。互換 trace のため保持し、AC disposition table の置換先を正とする。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-061`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_061.md) | フォルダー実効権限と継承を一意に算出する。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-062`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_062.md) | 共有変更へ feature/full と active same-tenant principal 検証を要求する。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-063`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_063.md) | 文書 direct/folder/deny の実効権限を一つの規則で合成する。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-064`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_064.md) | read-only 共有資源を発見・閲覧・chat scope 選択できる。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-065`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_065.md) | 文書移動へ移動元と移動先の full を要求する。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-066`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_066.md) | revoke/delete を deny-first で全派生経路へ伝播する。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-067`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_067.md) | 一時添付を owner/tenant/chat/expiry に限定する。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-076`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_076.md) | 文書・folder・resource group の resource type × operation 認可行列を強制する。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-081`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_081.md) | resource group membership の tenant、principal、cycle integrity を守る。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-085`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_085.md) | 共有 policy を expected version で atomic に更新する。 |
| 1.8 権限付き共有・ライフサイクル | [`FR-086`](01_文書・知識ベース管理/08_権限付き共有・ライフサイクル/REQ_FUNCTIONAL_086.md) | security mutation の actor/before/after/reason/result/version を監査する。 |

### 2. チャットQA・根拠提示・回答不能制御

| L2主機能群 | L3要件 | 要旨 |
| --- | --- | --- |
| 2.1 質問入力・回答取得 | [`FR-003`](02_チャットQA・根拠提示・回答不能制御/01_質問入力・回答取得/REQ_FUNCTIONAL_003.md) | 利用者が質問を入力して回答を受け取れる。 |
| 2.2 根拠提示 | [`FR-004`](02_チャットQA・根拠提示・回答不能制御/02_根拠提示/REQ_FUNCTIONAL_004.md) | 回答に根拠として使った文書箇所を表示する。 |
| 2.3 回答不能表示 | [`FR-005`](02_チャットQA・根拠提示・回答不能制御/03_回答不能表示/REQ_FUNCTIONAL_005.md) | 根拠不足時は回答できない旨を明示する。 |
| 2.4 回答挙動調整 | [`FR-006`](02_チャットQA・根拠提示・回答不能制御/04_回答挙動調整/REQ_FUNCTIONAL_006.md) | 回答精度調整に関わる設定値を指定できる。 |
| 2.5 統合チャットUI | [`FR-009`](02_チャットQA・根拠提示・回答不能制御/05_統合チャットUI/REQ_FUNCTIONAL_009.md) | 文書アップロード、質問、回答確認を画面上で一連実行する。 |
| 2.6 確認質問・曖昧性解消 | [`FR-029`](02_チャットQA・根拠提示・回答不能制御/06_確認質問・曖昧性解消/REQ_FUNCTIONAL_029.md) | 曖昧な質問に対し、grounded な候補がある場合だけ回答前に確認質問を返す。 |
| 2.7 チャットUI操作性 | [`FR-042`](02_チャットQA・根拠提示・回答不能制御/07_チャットUI操作性/REQ_FUNCTIONAL_042.md) | キーボードから質問送信を実行する。 |
| 2.7 チャットUI操作性 | [`FR-043`](02_チャットQA・根拠提示・回答不能制御/07_チャットUI操作性/REQ_FUNCTIONAL_043.md) | 回答本文を対象としてコピーする。 |
| 2.8 チャット内オーケストレーション | [`FR-049`](02_チャットQA・根拠提示・回答不能制御/08_チャット内オーケストレーション/REQ_FUNCTIONAL_049.md) | 同期チャット内の RAG とツール実行を ChatOrchestrationRun として扱う。 |

### 3. RAG検索品質制御

| L2主機能群 | L3要件 | 要旨 |
| --- | --- | --- |
| 3.1 検索計画・行動追跡 | [`FR-017`](03_RAG検索品質制御/01_検索計画・行動追跡/REQ_FUNCTIONAL_017.md) | SearchPlan / SearchAction / observation を state と trace で追跡する。 |
| 3.2 Hybrid retrieval | [`FR-026`](03_RAG検索品質制御/02_Hybrid_retrieval/REQ_FUNCTIONAL_026.md) | 軽量 lexical retrieval、S3 Vectors semantic search、RRF を統合した retriever を使う。 |
| 3.3 検索結果統合 | [`FR-018`](03_RAG検索品質制御/03_検索結果統合/REQ_FUNCTIONAL_018.md) | 複数 query / clue の検索結果を順位融合で統合する。 |
| 3.4 検索結果評価 | [`FR-016`](03_RAG検索品質制御/04_検索結果評価/REQ_FUNCTIONAL_016.md) | 検索結果品質を評価し、追加検索または拒否判断を選ぶ。 |
| 3.5 検索alias管理 | [`FR-023`](03_RAG検索品質制御/05_検索alias管理/REQ_FUNCTIONAL_023.md) | tenant / source / docType / ACL scope を持つ versioned alias artifact を管理する。 |
| 3.6 retrieval adoption gate | [`FR-045`](03_RAG検索品質制御/06_retrieval_adoption_gate/REQ_FUNCTIONAL_045.md) | 採用基準を満たす検索根拠だけを回答生成へ渡す。 |
| 3.7 安全な RAG ライフサイクル | [`FR-068`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_068.md) | source provenance/owner/ACL/quality を検査し、公開可だけを normal RAG に使う。 |
| 3.7 安全な RAG ライフサイクル | [`FR-069`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_069.md) | 文書の security/lifecycle/provenance を全派生 record へ継承する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-070`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_070.md) | 全 retrieval path で evidence 前認可を強制する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-071`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_071.md) | 取得文書を非信頼データとして prompt injection を防ぐ。 |
| 3.7 安全な RAG ライフサイクル | [`FR-072`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_072.md) | versioned index の切替・rollback 中も current deny/delete を維持する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-073`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_073.md) | 正本性・時点・矛盾・source span を evidence set に保持する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-074`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_074.md) | versioned decision を相関できる再現可能 trace を残す。 |
| 3.7 安全な RAG ライフサイクル | [`FR-075`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_075.md) | stage/slice/security gate の論理積で公開可否を判定する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-082`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_082.md) | 抽出範囲・span・warning を保持し silent truncation を禁止する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-083`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_083.md) | stage checkpoint と idempotency/reconciliation で取り込みを復旧する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-084`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_084.md) | benchmark simulated subject を runner と isolated scope に限定する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-087`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_087.md) | move 時の manifest/chunk/vector/index/path/grant を整合させる。 |
| 3.7 安全な RAG ライフサイクル | [`FR-088`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_088.md) | trace を field-level allowlist/redaction で最小化する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-089`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_089.md) | 縮退時も認可・分類・grounding・citation guard を維持する。 |
| 3.7 安全な RAG ライフサイクル | [`FR-092`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_092.md) | versioned policy で構造・budget・overlap・locator を保つ決定的 chunking を行う。 |
| 3.7 安全な RAG ライフサイクル | [`FR-093`](03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_093.md) | 本番 RAG の品質・安全 drift を監視し、通知と安全な対応を行う。 |

### 4. 回答検証・ガードレール

| L2主機能群 | L3要件 | 要旨 |
| --- | --- | --- |
| 4.1 回答前ガード | [`FR-014`](04_回答検証・ガードレール/01_回答前ガード/REQ_FUNCTIONAL_014.md) | 検索済みチャンクだけで回答可能かを 3 値で判定する。 |
| 4.2 回答後検証 | [`FR-015`](04_回答検証・ガードレール/02_回答後検証/REQ_FUNCTIONAL_015.md) | 回答文の主要文が引用対象チャンクで支持されているか検証する。 |

### 5. 会話履歴・お気に入り

| L2主機能群 | L3要件 | 要旨 |
| --- | --- | --- |
| 5.1 会話履歴管理 | [`FR-022`](05_会話履歴・お気に入り/01_会話履歴管理/REQ_FUNCTIONAL_022.md) | 自分の会話履歴を保存、再表示、削除し、schemaVersion を管理する。 |
| 5.2 お気に入り管理 | [`FR-028`](05_会話履歴・お気に入り/02_お気に入り管理/REQ_FUNCTIONAL_028.md) | 会話履歴のお気に入り登録、優先表示、抽出表示を行う。 |
| 5.3 会話履歴検索 | [`FR-030`](05_会話履歴・お気に入り/03_会話履歴検索/REQ_FUNCTIONAL_030.md) | 取得済みの自分の会話履歴を表記ゆれや軽い typo を吸収して検索する。 |
| 5.4 履歴表示順 | [`FR-044`](05_会話履歴・お気に入り/04_履歴表示順/REQ_FUNCTIONAL_044.md) | 同一時刻の履歴 item を安定した順序で表示する。 |

### 6. 問い合わせ・人手対応

| L2主機能群 | L3要件 | 要旨 |
| --- | --- | --- |
| 6.1 問い合わせ管理 | [`FR-021`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_021.md) | 回答不能質問を担当者向け問い合わせとして登録する。 |
| 6.1 問い合わせ管理 | [`FR-031`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_031.md) | 担当者が問い合わせをカンバン形式で状態別に確認する。 |
| 6.1 問い合わせ管理 | [`FR-032`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_032.md) | 担当者が問い合わせを検索または状態で絞り込む。 |
| 6.1 問い合わせ管理 | [`FR-033`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_033.md) | 担当者が回答本文、下書き、内部メモ、通知希望を登録する。 |
| 6.1 問い合わせ管理 | [`FR-034`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_034.md) | 通常利用者が自身の問い合わせ回答を確認する。 |
| 6.1 問い合わせ管理 | [`FR-035`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_035.md) | 会話履歴が問い合わせ結果の状態を利用者に通知する。 |
| 6.1 問い合わせ管理 | [`FR-036`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_036.md) | 通常利用者が回答済みの自身の問い合わせを解決済みにする。 |
| 6.1 問い合わせ管理 | [`FR-037`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_037.md) | 問い合わせ対応結果を HITL 改善候補として分類する。 |

### 7. 評価・debug・benchmark

| L2主機能群 | L3要件 | 要旨 |
| --- | --- | --- |
| 7.1 実行履歴確認 | [`FR-010`](07_評価・debug・benchmark/01_実行履歴確認/REQ_FUNCTIONAL_010.md) | 過去の実行結果詳細を確認できる。 |
| 7.2 実行結果ダウンロード | [`FR-011`](07_評価・debug・benchmark/02_実行結果ダウンロード/REQ_FUNCTIONAL_011.md) | 実行結果詳細をダウンロードできる。 |
| 7.3 UI非依存評価 | [`FR-012`](07_評価・debug・benchmark/03_UI非依存評価/REQ_FUNCTIONAL_012.md) | 画面を使わず同等の質問評価を実行できる。 |
| 7.4 外部連携仕様 | [`FR-013`](07_評価・debug・benchmark/04_外部連携仕様/REQ_FUNCTIONAL_013.md) | 外部連携向け仕様情報を参照できる。 |
| 7.5 benchmark 指標 | [`FR-019`](07_評価・debug・benchmark/05_benchmark指標/REQ_FUNCTIONAL_019.md) | fact coverage、faithfulness、context relevance、不回答精度を評価する。 |
| 7.6 benchmark corpus seed | [`FR-039`](07_評価・debug・benchmark/06_benchmark_corpus_seed/REQ_FUNCTIONAL_039.md) | 評価前に corpus を取り込み、抽出不能や OCR timeout を分類する。 |
| 7.7 benchmark corpus 隔離 | [`FR-040`](07_評価・debug・benchmark/07_benchmark_corpus隔離/REQ_FUNCTIONAL_040.md) | benchmark corpus と通常文書を混在させず scope を強制する。 |
| 7.8 debug trace artifact | [`FR-046`](07_評価・debug・benchmark/08_debug_trace_artifact/REQ_FUNCTIONAL_046.md) | 管理者が debug trace を時系列 artifact として取得する。 |
| 7.9 dataset adapter | [`FR-047`](07_評価・debug・benchmark/09_dataset_adapter/REQ_FUNCTIONAL_047.md) | dataset ごとの入力を共通評価形式へ正規化する。 |
| 7.10 benchmark 実行追跡 | [`FR-048`](07_評価・debug・benchmark/10_benchmark実行追跡/REQ_FUNCTIONAL_048.md) | benchmark run の進捗と成果物生成状態を確認する。 |
| 7.11 API契約・品質ゲート | [`FR-053`](07_評価・debug・benchmark/11_API契約・品質ゲート/REQ_FUNCTIONAL_053.md) | OpenAPI を runtime source of truth として API drift と docs quality を検出する。 |
| 7.11 API契約・品質ゲート | [`FR-054`](07_評価・debug・benchmark/11_API契約・品質ゲート/REQ_FUNCTIONAL_054.md) | GitHub Actions、OIDC、CDK を使う deploy / release 運用を追跡する。 |
| 7.11 API契約・品質ゲート | [`FR-055`](07_評価・debug・benchmark/11_API契約・品質ゲート/REQ_FUNCTIONAL_055.md) | API 共通 middleware と非同期 worker の runId 契約を管理する。 |

### 8. 認証・認可・管理・監査

| L2主機能群 | L3要件 | 要旨 |
| --- | --- | --- |
| 8.1 通常利用者セルフサインアップ | [`FR-025`](08_認証・認可・管理・監査/01_通常利用者セルフサインアップ/REQ_FUNCTIONAL_025.md) | 未認証利用者が Cognito アカウントを作成し、CHAT_USER のみ付与される。 |
| 8.2 Phase 1 RAG運用管理 | [`FR-024`](08_認証・認可・管理・監査/02_Phase_1_RAG運用管理/REQ_FUNCTIONAL_024.md) | 管理画面から文書管理、問い合わせ対応、debug/評価、性能テストへ遷移できる。 |
| 8.3 Phase 2 管理・監査 | [`FR-027`](08_認証・認可・管理・監査/03_Phase_2_管理・監査/REQ_FUNCTIONAL_027.md) | ユーザー、ロール、管理操作履歴、利用状況、コスト監査を扱う。 |
| 8.4 非同期エージェント実行 | [`FR-050`](08_認証・認可・管理・監査/04_非同期エージェント実行/REQ_FUNCTIONAL_050.md) | provider を選択して非同期エージェント実行と writeback 承認を管理する。 |
| 8.5 個人設定 | [`FR-051`](08_認証・認可・管理・監査/05_個人設定/REQ_FUNCTIONAL_051.md) | 利用者本人の既定モデル、回答範囲、通知、表示設定を保存する。 |
| 8.6 3層認可モデル | [`FR-052`](08_認証・認可・管理・監査/06_3層認可モデル/REQ_FUNCTIONAL_052.md) | Superseded。互換 trace のため保持し、FR-056–FR-060 を正とする。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-056`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_056.md) | 認可文脈を verified identity/server data から構築する。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-057`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_057.md) | account/feature/tenant/resource の論理積を fail closed で評価する。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-058`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_058.md) | suspend/delete を identity/session/worker に反映する。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-059`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_059.md) | 資源認可を単一 contract にし break-glass を通常経路から分離する。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-060`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_060.md) | tenant を全 storage/search/session/cache/trace/worker の強制 partition にする。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-077`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_077.md) | active same-tenant administrative principal の `full` を通常 policy で剥奪させない。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-078`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_078.md) | 管理主体の削除・離脱前に全資源を後継へ移管する。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-079`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_079.md) | identity/API/Web/infra/worker で canonical role catalog version を共有する。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-080`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_080.md) | role 付与・剥奪へ same-tenant/self/last-admin guard と authoritative role set 確定を要求する。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-090`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_090.md) | queued/long-running 処理を開始・保護対象読取・副作用・commit 前に再認可する。 |
| 8.7 信頼済み認証文脈と資源認可 | [`FR-091`](08_認証・認可・管理・監査/07_信頼済み認証文脈と資源認可/REQ_FUNCTIONAL_091.md) | 権限外 caller への response を非列挙・最小開示 contract に制限する。 |

### 9. UI/UX 基盤

| L2主機能群 | L3要件 | 要旨 |
| --- | --- | --- |
| 9.1 アプリケーションナビゲーション | [`FR-094`](09_UI_UX基盤/01_アプリケーションナビゲーション/REQ_FUNCTIONAL_094.md) | 権限、URL、history、viewport に応じて許可済み画面へ到達・復元する。 |
| 9.2 共通状態契約 | [`FR-095`](09_UI_UX基盤/02_共通状態契約/REQ_FUNCTIONAL_095.md) | loading、empty、error、permission、partial、stale、retry を区別して回復可能に示す。 |
| 9.3 高影響操作フィードバック | [`FR-096`](09_UI_UX基盤/03_高影響操作フィードバック/REQ_FUNCTIONAL_096.md) | 高影響操作の対象、影響、回復可否、進行、結果を対象 context に関連付ける。 |
| 9.4 ワークスペース状態保持 | [`FR-097`](09_UI_UX基盤/04_ワークスペース状態保持/REQ_FUNCTIONAL_097.md) | search、filter、sort、selection、detail context を予測可能に復元する。 |
| 9.5 高密度 UI 情報設計 | [`FR-098`](09_UI_UX基盤/05_高密度UI情報設計/REQ_FUNCTIONAL_098.md) | 主要、詳細、高影響操作を優先度と利用者語彙で段階化する。 |

## 関連カテゴリ

| 要件 | 主カテゴリ | 関連カテゴリ |
| --- | --- | --- |
| [`FR-005`](02_チャットQA・根拠提示・回答不能制御/03_回答不能表示/REQ_FUNCTIONAL_005.md) | 2. チャットQA・根拠提示・回答不能制御 | 4. 回答検証・ガードレール |
| [`FR-020`](01_文書・知識ベース管理/05_多抽象度メモリ生成/REQ_FUNCTIONAL_020.md) | 1. 文書・知識ベース管理 | 3. RAG検索品質制御 |
| [`FR-023`](03_RAG検索品質制御/05_検索alias管理/REQ_FUNCTIONAL_023.md) | 3. RAG検索品質制御 | 8. 認証・認可・管理・監査 |
| [`FR-024`](08_認証・認可・管理・監査/02_Phase_1_RAG運用管理/REQ_FUNCTIONAL_024.md) | 8. 認証・認可・管理・監査 | 1. 文書・知識ベース管理、6. 問い合わせ・人手対応、7. 評価・debug・benchmark |
| [`FR-027`](08_認証・認可・管理・監査/03_Phase_2_管理・監査/REQ_FUNCTIONAL_027.md) | 8. 認証・認可・管理・監査 | 7. 評価・debug・benchmark |
| [`FR-029`](02_チャットQA・根拠提示・回答不能制御/06_確認質問・曖昧性解消/REQ_FUNCTIONAL_029.md) | 2. チャットQA・根拠提示・回答不能制御 | 3. RAG検索品質制御、4. 回答検証・ガードレール、7. 評価・debug・benchmark |
| [`FR-031`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_031.md) | 6. 問い合わせ・人手対応 | 8. 認証・認可・管理・監査 |
| [`FR-032`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_032.md) | 6. 問い合わせ・人手対応 | 8. 認証・認可・管理・監査 |
| [`FR-033`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_033.md) | 6. 問い合わせ・人手対応 | 8. 認証・認可・管理・監査 |
| [`FR-034`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_034.md) | 6. 問い合わせ・人手対応 | 5. 会話履歴・お気に入り |
| [`FR-035`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_035.md) | 6. 問い合わせ・人手対応 | 5. 会話履歴・お気に入り |
| [`FR-036`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_036.md) | 6. 問い合わせ・人手対応 | 8. 認証・認可・管理・監査 |
| [`FR-037`](06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_037.md) | 6. 問い合わせ・人手対応 | 1. 文書・知識ベース管理、3. RAG検索品質制御、7. 評価・debug・benchmark、8. 認証・認可・管理・監査 |
| [`FR-038`](01_文書・知識ベース管理/06_非同期文書取り込み/REQ_FUNCTIONAL_038.md) | 1. 文書・知識ベース管理 | 7. 評価・debug・benchmark |
| [`FR-039`](07_評価・debug・benchmark/06_benchmark_corpus_seed/REQ_FUNCTIONAL_039.md) | 7. 評価・debug・benchmark | 1. 文書・知識ベース管理 |
| [`FR-040`](07_評価・debug・benchmark/07_benchmark_corpus隔離/REQ_FUNCTIONAL_040.md) | 7. 評価・debug・benchmark | 3. RAG検索品質制御、8. 認証・認可・管理・監査 |
| [`FR-041`](01_文書・知識ベース管理/07_スコープ付き資料グループ管理/REQ_FUNCTIONAL_041.md) | 1. 文書・知識ベース管理 | 2. チャットQA・根拠提示・回答不能制御、3. RAG検索品質制御、8. 認証・認可・管理・監査 |
| [`FR-045`](03_RAG検索品質制御/06_retrieval_adoption_gate/REQ_FUNCTIONAL_045.md) | 3. RAG検索品質制御 | 4. 回答検証・ガードレール、7. 評価・debug・benchmark |
| [`FR-046`](07_評価・debug・benchmark/08_debug_trace_artifact/REQ_FUNCTIONAL_046.md) | 7. 評価・debug・benchmark | 8. 認証・認可・管理・監査 |
| [`FR-048`](07_評価・debug・benchmark/10_benchmark実行追跡/REQ_FUNCTIONAL_048.md) | 7. 評価・debug・benchmark | 運用 |
| [`FR-049`](02_チャットQA・根拠提示・回答不能制御/08_チャット内オーケストレーション/REQ_FUNCTIONAL_049.md) | 2. チャットQA・根拠提示・回答不能制御 | 3. RAG検索品質制御、8. 認証・認可・管理・監査 |
| [`FR-050`](08_認証・認可・管理・監査/04_非同期エージェント実行/REQ_FUNCTIONAL_050.md) | 8. 認証・認可・管理・監査 | 1. 文書・知識ベース管理、7. 評価・debug・benchmark |
| [`FR-051`](08_認証・認可・管理・監査/05_個人設定/REQ_FUNCTIONAL_051.md) | 8. 認証・認可・管理・監査 | 2. チャットQA・根拠提示・回答不能制御 |
| [`FR-052`](08_認証・認可・管理・監査/06_3層認可モデル/REQ_FUNCTIONAL_052.md) | 8. 認証・認可・管理・監査 | 1. 文書・知識ベース管理、3. RAG検索品質制御、7. 評価・debug・benchmark |
| [`FR-053`](07_評価・debug・benchmark/11_API契約・品質ゲート/REQ_FUNCTIONAL_053.md) | 7. 評価・debug・benchmark | API、運用 |
| [`FR-054`](07_評価・debug・benchmark/11_API契約・品質ゲート/REQ_FUNCTIONAL_054.md) | 7. 評価・debug・benchmark | 運用、インフラ |
| [`FR-055`](07_評価・debug・benchmark/11_API契約・品質ゲート/REQ_FUNCTIONAL_055.md) | 7. 評価・debug・benchmark | API、運用 |
| [`FR-094`](09_UI_UX基盤/01_アプリケーションナビゲーション/REQ_FUNCTIONAL_094.md) | 9. UI/UX 基盤 | 1. 文書・知識ベース管理、8. 認証・認可・管理・監査 |
| [`FR-095`](09_UI_UX基盤/02_共通状態契約/REQ_FUNCTIONAL_095.md) | 9. UI/UX 基盤 | 1〜8 の全機能カテゴリ |
| [`FR-096`](09_UI_UX基盤/03_高影響操作フィードバック/REQ_FUNCTIONAL_096.md) | 9. UI/UX 基盤 | 1. 文書・知識ベース管理、6. 問い合わせ・人手対応、7. 評価・debug・benchmark、8. 認証・認可・管理・監査 |
| [`FR-097`](09_UI_UX基盤/04_ワークスペース状態保持/REQ_FUNCTIONAL_097.md) | 9. UI/UX 基盤 | 1. 文書・知識ベース管理、6. 問い合わせ・人手対応、8. 認証・認可・管理・監査 |
| [`FR-098`](09_UI_UX基盤/05_高密度UI情報設計/REQ_FUNCTIONAL_098.md) | 9. UI/UX 基盤 | 1. 文書・知識ベース管理、6. 問い合わせ・人手対応、8. 認証・認可・管理・監査 |

## 網羅性チェック

- 主分類マップには配置済みの各 `FR-*` 要件を各 1 回だけ登録する。
- 関連カテゴリ表は横断的な読み替え・影響確認のための補助であり、主分類の重複登録ではない。
- 新しい `FR-*` を追加する場合は、本索引、該当 `REQ_FUNCTIONAL_*` の配置先、`REQ_CHANGE_001.md` の機能分類トレーサビリティを同時に更新する。
