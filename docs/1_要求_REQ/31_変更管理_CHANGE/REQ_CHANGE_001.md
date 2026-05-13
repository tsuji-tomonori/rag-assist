# MemoRAG MVP 要件変更管理とトレーサビリティ

- ファイル: `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`
- 種別: `REQ_CHANGE`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

要求変更の扱い、影響確認、要求からアーキテクチャ、設計、評価までの対応関係を管理する。

## 変更管理手順

1. 変更要求を登録する。
2. 変更対象の `REQ_*`、`ARC_*`、`DES_*`、テストまたは評価指標を特定する。
3. 要件の原子性を確認し、複合条件は分割する。
4. アーキテクチャ上重要な要求に該当する場合は ASR と ADR への影響を確認する。
5. 設計、API、データ、運用、benchmark への影響を確認する。
6. 更新後にトレーサビリティ表を改訂する。

## トレーサビリティ

| 要求 | ASR | ADR | HLD/DLD/API/Data | 受入・評価 |
| --- | --- | --- | --- | --- |
| `FR-001`, `FR-002`, `FR-038` | `ASR-OPER-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DATA_001`, `DES_API_001` | 各要求の受け入れ条件 |
| `FR-041` | `ASR-SEC-001`, `ASR-RETRIEVAL-001` | `ARC_ADR_001` | `DES_DATA_001`, `DES_API_001` | `REQ_FUNCTIONAL_041` |
| `FR-003`, `FR-004`, `FR-005`, `FR-029` | `ASR-TRUST-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_001`, `DES_API_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `FR-014`, `FR-015` | `ASR-GUARD-001` | `ARC_ADR_001` | `DES_DLD_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `FR-016`, `FR-017`, `FR-018`, `FR-026` | `ASR-RETRIEVAL-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_001`, `DES_DLD_002`, `DES_DATA_001` | `SQ-001` |
| `FR-019`, `FR-020`, `FR-039`, `FR-040`, `SQ-002` | `ASR-EVAL-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DATA_001`, `DES_API_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `NFR-010` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001` |
| `FR-021`, `FR-031`, `FR-032`, `FR-033`, `FR-034`, `FR-035`, `FR-036`, `FR-037`, `FR-024`, `NFR-011`, `NFR-013` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_007`, `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001` |
| `FR-025`, `NFR-011` | `ASR-SEC-002` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_004`, `DES_API_001` | `REQ_FUNCTIONAL_025` |
| `FR-023`, `NFR-012` | `ASR-SEC-001`, `ASR-RETRIEVAL-001` | `ARC_ADR_001` | `DES_DLD_002`, `DES_DLD_003`, `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `FR-042`, `FR-043`, `FR-044`, `SQ-004` | `ASR-TRUST-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_API_001` | 各要求の受け入れ条件 |
| `FR-045`, `SQ-003` | `ASR-RETRIEVAL-001`, `ASR-GUARD-001` | `ARC_ADR_001` | `DES_DLD_001`, `DES_DLD_002`, `DES_DATA_001` | `SQ-001`, 各要求の受け入れ条件 |
| `FR-046`, `NFR-015` | `ASR-SEC-001`, `ASR-EVAL-001` | `ARC_ADR_001` | `DES_API_001`, `DES_DATA_001` | `REQ_FUNCTIONAL_046`, `REQ_NON_FUNCTIONAL_015` |
| `FR-047`, `FR-048`, `SQ-002` | `ASR-EVAL-001` | `ARC_ADR_001` | `DES_DATA_001`, `DES_API_001` | `REQ_FUNCTIONAL_047`, `REQ_FUNCTIONAL_048`, `SQ-002` |
| `NFR-014` | `ASR-OPER-001` | `ARC_ADR_001` | `DES_DATA_001`, `DES_API_001` | `REQ_NON_FUNCTIONAL_014` |
| `TC-001` | `ASR-RETRIEVAL-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_001` | `SQ-001` |
| `TC-002` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_API_001` | 各要求の受け入れ条件 |

## 機能分類トレーサビリティ

L0-L3 の機能分類は `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md` を分類索引として扱う。
個別 `REQ_FUNCTIONAL_*` ファイルは、L1 主分類と L2 主機能群に対応するディレクトリ配下に配置する。

各 `REQ_FUNCTIONAL_*` ファイルの `分類（L0-L3）` セクションは、次の主分類と関連カテゴリに合わせて更新する。

| L1 主カテゴリ | 主分類の要求 | 主な L2 主機能群 | 関連カテゴリを持つ要求 |
| --- | --- | --- | --- |
| 1. 文書・知識ベース管理 | `FR-001`, `FR-002`, `FR-007`, `FR-008`, `FR-020`, `FR-038`, `FR-041` | 文書登録、QA利用可能化、文書削除、多抽象度メモリ生成、非同期文書取り込み、スコープ付き資料グループ管理 | `FR-024` は管理導線として関連する。`FR-020` は検索補助メモリとして検索品質制御にも関連する。`FR-038` は benchmark seed の前処理にも関連する。`FR-041` はチャットQA、検索品質制御、認可境界にも関連する。 |
| 2. チャットQA・根拠提示・回答不能制御 | `FR-003`, `FR-004`, `FR-005`, `FR-006`, `FR-009`, `FR-029`, `FR-042`, `FR-043` | 質問入力、根拠提示、回答不能表示、回答挙動調整、統合チャットUI、確認質問・曖昧性解消、チャットUI操作性 | `FR-005` はガードレールにも関連する。`FR-029` は検索候補、回答前ガード、benchmark 指標にも関連する。`FR-043` は機微情報非表示にも関連する。 |
| 3. RAG検索品質制御 | `FR-016`, `FR-017`, `FR-018`, `FR-023`, `FR-026`, `FR-045` | 検索計画・行動追跡、Hybrid retrieval、検索結果統合、検索結果評価、検索alias管理、retrieval adoption gate | `FR-020` は検索補助メモリとして関連する。`FR-023` は監査にも関連する。`FR-029` は検索候補から確認質問 option を作るため関連する。`FR-045` は回答検証と benchmark 診断にも関連する。 |
| 4. 回答検証・ガードレール | `FR-014`, `FR-015` | 回答前ガード、回答後検証 | `FR-005` は回答不能制御として関連する。`FR-029` は回答生成前の分岐として関連する。 |
| 5. 会話履歴・お気に入り | `FR-022`, `FR-028`, `FR-030`, `FR-044` | 会話履歴管理、お気に入り管理、会話履歴検索、履歴表示順 | なし。 |
| 6. 問い合わせ・人手対応 | `FR-021`, `FR-031`, `FR-032`, `FR-033`, `FR-034`, `FR-035`, `FR-036`, `FR-037` | 問い合わせ管理 | `FR-024` は管理導線として関連する。`FR-034` と `FR-035` は会話履歴・お気に入りにも関連する。`FR-031`, `FR-032`, `FR-033`, `FR-036`, `FR-037` は認証・認可・管理・監査にも関連する。`FR-037` は文書・知識ベース管理、RAG検索品質制御、評価・debug・benchmark にも関連する。 |
| 7. 評価・debug・benchmark | `FR-010`, `FR-011`, `FR-012`, `FR-013`, `FR-019`, `FR-039`, `FR-040`, `FR-046`, `FR-047`, `FR-048` | 実行履歴確認、実行結果ダウンロード、UI非依存評価、外部連携仕様、benchmark 指標、benchmark corpus seed、benchmark corpus 隔離、debug trace artifact、dataset adapter、benchmark 実行追跡 | `FR-024` は管理導線として関連する。`FR-027` は利用状況・コスト監査として関連する。`FR-029` は確認質問指標として関連する。`FR-039` は文書取り込みにも関連する。`FR-040` は検索品質制御と認可境界にも関連する。`FR-046` は認可境界にも関連する。 |
| 8. 認証・認可・管理・監査 | `FR-024`, `FR-025`, `FR-027` | 通常利用者セルフサインアップ、Phase 1 RAG運用管理、Phase 2 管理・監査 | `FR-023` は alias audit として関連する。 |

### 分類更新時の追加確認

- 主分類マップで同じ `FR-*` を複数の L1 または L2 主機能群へ重複登録していないこと。
- 関連カテゴリは主分類ではなく影響確認用の補助として記載していること。
- 個別 `REQ_FUNCTIONAL_*` の分類セクション、配置先ディレクトリ、機能要求分類索引、本ファイルの分類トレーサビリティが一致していること。

## 影響確認チェック

- 要求文が 1 条件で検証可能か。
- 受け入れ条件が同一ファイルまたは横断受入基準に紐づいているか。
- ASR に影響する場合、`ARC_QA_001.md` と `ARC_ADR_001.md` を更新したか。
- API contract に影響する場合、`DES_API_001.md` を更新したか。
- データ保持、trace、評価指標に影響する場合、`DES_DATA_001.md` と benchmark 文書を更新したか。
- 未実施のテストや確認を実施済みとして記録していないか。

## 未決事項

- benchmark 合格閾値の初期値。
- LLM judge の modelId と回答生成 modelId を分けるか。
- debug trace の本番マスキング対象項目。
