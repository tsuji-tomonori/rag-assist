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
- 本ファイルは上位インデックスとして扱い、詳細要件は分割ファイルを正とする。
- 機能要求の L0-L3 分類は `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md` を分類索引として扱う。
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

機能要求は、L0 を `rag-assist / MemoRAG MVP 機能要件`、L1 を 8 大カテゴリ、L2 をカテゴリ内の主機能群、L3 を個別の `FR-*` 要件として読む。

各 `FR-*` は L1 主分類と L2 主機能群をそれぞれ 1 つだけ持つ。複数カテゴリにまたがる要件は、主分類へ重複登録せず、関連カテゴリとしてトレーサビリティで補足する。

詳細な L1-L3 主分類マップは `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md` を参照する。

| L1 主カテゴリ | 主分類の FR | 主な L2 主機能群 |
| --- | --- | --- |
| 1. 文書・知識ベース管理 | `FR-001`, `FR-002`, `FR-007`, `FR-008`, `FR-020` | 文書登録、QA利用可能化、文書削除、多抽象度メモリ生成 |
| 2. チャットQA・根拠提示・回答不能制御 | `FR-003`, `FR-004`, `FR-005`, `FR-006`, `FR-009` | 質問入力、根拠提示、回答不能表示、回答挙動調整、統合チャットUI |
| 3. RAG検索品質制御 | `FR-016`, `FR-017`, `FR-018`, `FR-023`, `FR-026` | 検索計画・行動追跡、Hybrid retrieval、検索結果統合、検索結果評価、検索alias管理 |
| 4. 回答検証・ガードレール | `FR-014`, `FR-015` | 回答前ガード、回答後検証 |
| 5. 会話履歴・お気に入り | `FR-022`, `FR-028`, `FR-030` | 会話履歴管理、お気に入り管理、会話履歴検索 |
| 6. 問い合わせ・人手対応 | `FR-021` | 問い合わせ管理 |
| 7. 評価・debug・benchmark | `FR-010`, `FR-011`, `FR-012`, `FR-013`, `FR-019` | 実行履歴確認、実行結果ダウンロード、UI非依存評価、外部連携仕様、benchmark 指標 |
| 8. 認証・認可・管理・監査 | `FR-024`, `FR-025`, `FR-027` | 通常利用者セルフサインアップ、Phase 1 RAG運用管理、Phase 2 管理・監査 |

## 要件仕様ファイル

### プロジェクト要求

- `1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md` (`PRJ-001`)

### 機能要求

- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md`（L0-L3 分類索引）
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/01_文書登録/REQ_FUNCTIONAL_001.md` (`FR-001`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/02_文書のQA利用可能化/REQ_FUNCTIONAL_002.md` (`FR-002`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/01_質問入力・回答取得/REQ_FUNCTIONAL_003.md` (`FR-003`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/02_根拠提示/REQ_FUNCTIONAL_004.md` (`FR-004`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/03_回答不能表示/REQ_FUNCTIONAL_005.md` (`FR-005`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/04_回答挙動調整/REQ_FUNCTIONAL_006.md` (`FR-006`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/03_文書削除/REQ_FUNCTIONAL_007.md` (`FR-007`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/03_文書削除/REQ_FUNCTIONAL_008.md` (`FR-008`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/05_統合チャットUI/REQ_FUNCTIONAL_009.md` (`FR-009`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/01_実行履歴確認/REQ_FUNCTIONAL_010.md` (`FR-010`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/02_実行結果ダウンロード/REQ_FUNCTIONAL_011.md` (`FR-011`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/03_UI非依存評価/REQ_FUNCTIONAL_012.md` (`FR-012`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/04_外部連携仕様/REQ_FUNCTIONAL_013.md` (`FR-013`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/04_回答検証・ガードレール/01_回答前ガード/REQ_FUNCTIONAL_014.md` (`FR-014`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/04_回答検証・ガードレール/02_回答後検証/REQ_FUNCTIONAL_015.md` (`FR-015`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/03_RAG検索品質制御/04_検索結果評価/REQ_FUNCTIONAL_016.md` (`FR-016`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/03_RAG検索品質制御/01_検索計画・行動追跡/REQ_FUNCTIONAL_017.md` (`FR-017`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/03_RAG検索品質制御/03_検索結果統合/REQ_FUNCTIONAL_018.md` (`FR-018`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/05_benchmark指標/REQ_FUNCTIONAL_019.md` (`FR-019`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/05_多抽象度メモリ生成/REQ_FUNCTIONAL_020.md` (`FR-020`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/06_問い合わせ・人手対応/01_問い合わせ管理/REQ_FUNCTIONAL_021.md` (`FR-021`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/05_会話履歴・お気に入り/01_会話履歴管理/REQ_FUNCTIONAL_022.md` (`FR-022`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/03_RAG検索品質制御/05_検索alias管理/REQ_FUNCTIONAL_023.md` (`FR-023`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/02_Phase_1_RAG運用管理/REQ_FUNCTIONAL_024.md` (`FR-024`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/01_通常利用者セルフサインアップ/REQ_FUNCTIONAL_025.md` (`FR-025`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/03_RAG検索品質制御/02_Hybrid_retrieval/REQ_FUNCTIONAL_026.md` (`FR-026`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/03_Phase_2_管理・監査/REQ_FUNCTIONAL_027.md` (`FR-027`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/05_会話履歴・お気に入り/02_お気に入り管理/REQ_FUNCTIONAL_028.md` (`FR-028`)
- `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/05_会話履歴・お気に入り/03_会話履歴検索/REQ_FUNCTIONAL_030.md` (`FR-030`)

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
| `FR-030`, `NFR-011` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_API_001`, `DES_DATA_001` | `REQ_FUNCTIONAL_030` |
