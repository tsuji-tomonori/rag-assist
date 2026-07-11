# rag-assist 要求ベースライン 2026-07

- ファイル: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md`
- 種別: `REQ_PRODUCT_BASELINE`
- 作成日: 2026-07-11
- 状態: Draft（ステークホルダー承認前）
- 変更要求: `CHG-003`

## 目的

現行コードを正解そのものとはみなさず、利用者ニーズ、既存要件、実装・テスト、作業・障害レポート、『RAGエンジニアリングガイド』、SWEBOK v4.0a を相互照合し、権限、文書共有、RAG ライフサイクルの要求を再定義する。

この文書は要求集合の境界と読み方を定める索引である。規範的な要求文と受け入れ条件は、リンク先の 1 要件 1 ファイルを正とする。

## 要求定義方法

SWEBOK v4.0a Chapter 1 に従い、要求は次を満たす粒度にする。

- 1 要求は 1 つの検証可能な決定を表す。
- 要求と設計手段を分離し、BM25、HNSW、RRF、特定ベンダーは、真の制約でない限り要求へ固定しない。
- 各要求に識別子、根拠、源泉、actor/trigger、依存・衝突、受け入れ条件、優先度、安定性、履歴、妥当性確認、trace を持たせる。
- BDD 形式の受け入れ条件に加え、境界値、組合せ、否定試験を定義する。
- 要求から源泉への後方 trace と、設計・コード・テスト・運用への前方 trace を維持する。

根拠: SWEBOK v4.0a, Software Requirements, §3.1（印刷 p.1-8 / PDF p.50）、§4.3–4.5（印刷 pp.1-12–1-15 / PDF pp.54–57）、§5（印刷 pp.1-15–1-16 / PDF pp.57–58）、§7.3–7.4（印刷 pp.1-18–1-19 / PDF pp.60–61）。

## 判定ラベル

| ラベル | 意味 |
| --- | --- |
| `confirmed` | 参照先の本文・コード・テスト・レポートで直接確認した事実。 |
| `inferred` | confirmed な根拠から導いた製品要求候補。ステークホルダー承認前。 |
| `conflict` | 複数の信頼できる源泉または実装と文書が矛盾する。 |
| `open_question` | 業務責任者、セキュリティ、運用等の判断がなければ確定できない。 |

『RAGエンジニアリングガイド』の記載自体は `confirmed` でも、rag-assist の正式要求として採用する判断は原則 `inferred` とする。

## 入力ソース

| ID | ソース | 版・範囲 | 用途 | Confidence |
| --- | --- | --- | --- | --- |
| SRC-034 | `.workspace/rag-engineering-guide.pdf` | 2026年7月版、243ページ、SHA-256 `7f887309fc92ec2046e4f4b62ff0de2d3c6f2a61c790b397bca2b73c446e7103` | ACL、文書ライフサイクル、検索、生成、評価、運用 | confirmed |
| SRC-035 | `.workspace/swebok-v4.pdf` | SWEBOK v4.0a, September 2025, 411ページ、SHA-256 `b3cb8028fecb9607f757504c861947fa3bf423087ea8bf08c58020f0ba3596dc` | 要求獲得・分析・仕様化・妥当性確認・trace | confirmed |
| SRC-036 | `apps/api/src`, `apps/web/src`, `infra` | `origin/main` commit `e8ae57f6126aca802d85042a1697d07c836b3603` | 現行実装とテストの事実 | confirmed |
| SRC-037 | `docs/1_要求_REQ`, `docs/2_アーキテクチャ_ARC`, `docs/3_設計_DES` | 既存要求・ADR・設計 | 既存合意と矛盾の検出 | confirmed |
| SRC-038 | `reports/working`, `reports/bugs` の権限・共有・RAG 関連レポート | 2026-05-12–2026-05-22 を中心に本文確認 | 実装意図、既知制約、未検証事項 | confirmed |

主な PDF 根拠は、RAG ガイド §3.1–3.8（PDF pp.59–97）、§4–6（PDF pp.99–154）、§7（PDF pp.156–185）、§8.1–8.8（PDF pp.186–208）である。ページ対応は本文の印刷ページに 6 を加えた PDF ページを併記する。

## ステークホルダークラス

| クラス | 主なニーズ・責任 |
| --- | --- |
| 一般利用者 | 自分に許可された資料を発見し、根拠付き回答を得る。権限外資源の存在を推測させられない。 |
| 文書所有者・共有管理者 | 文書・フォルダーの共有範囲を確認し、安全に変更・解除する。 |
| テナント管理者 | テナント境界、アカウント状態、役割付与、例外アクセスを統制する。 |
| RAG 運用者 | 取り込み、索引、品質、失効、ロールバックを再現可能に運用する。 |
| セキュリティ・プライバシー担当 | 非漏えい、最小権限、データ分類、攻撃耐性を承認する。 |
| QA・評価担当 | 工程別指標、否定試験、回帰、公開ゲートを検証する。 |
| 監査担当 | 認可・共有・削除・公開判断を、本文を過剰保存せず追跡する。 |
| 文書管理責任者・業務責任者 | 正本性、施行期間、優先情報源、矛盾処理、品質閾値を決定する。 |

## 保護対象と信頼境界

保護対象は原文だけではない。チャンク、埋め込み、索引、引用、会話履歴、長期記憶、一時添付、キャッシュ、prompt、trace、評価データ、非同期ジョブも同じ認可・テナント・ライフサイクル境界に含める。

```text
未信頼: Web/API 入力・質問文・取得文書・ツール出力
        │
        ▼
検証済み認証文脈 ──► 決定的な認可サービス ──► 許可済み候補集合
                                  │                    │
                                  └─ deny ─────────────┤
                                                       ▼
                                rerank / prompt / LLM / citation / trace
```

クライアントが指定した tenant、role、group、ACL は強制条件の源泉にしない。LLM は認可判断を行わない。権限外本文は、回答表示時だけでなく、prompt、cache、trace、評価データへ到達させない。

## 要求集合

### 認証・認可

- `FR-056`: 検証済み認証文脈
- `FR-057`: fail-closed の多層認可
- `FR-058`: アカウント状態とセッション失効
- `FR-059`: 単一の資源認可サービスと break-glass 分離
- `FR-060`: テナント分離
- `FR-077`: 管理主体の不可侵 `full` 権限
- `FR-078`: 管理主体の移管整合性
- `FR-079`: canonical role catalog
- `FR-080`: role 付与・剥奪 guard
- `FR-090`: 長時間処理の current authorization 再評価
- `FR-091`: 権限外資源の存在最小化

### 文書共有・ライフサイクル

- `FR-061`: フォルダー実効権限と継承
- `FR-062`: 共有方針変更の actor・principal guard
- `FR-063`: 文書実効権限の優先順位付き合成
- `FR-064`: read-only 共有資源の発見・選択
- `FR-065`: 文書移動の両端認可
- `FR-066`: 共有解除・失効・削除の deny-first 伝播
- `FR-067`: 一時添付の所有者・会話・期限境界
- `FR-076`: 文書・フォルダー・resource group の操作別認可行列
- `FR-081`: resource group membership integrity
- `FR-085`: 共有 policy の optimistic concurrency と integrity
- `FR-086`: security mutation audit
- `FR-087`: 文書・フォルダー move state coherence

### 安全な RAG ライフサイクル

- `FR-068`: 情報源台帳・取り込み admission・隔離
- `FR-069`: 文書からチャンクへの強制属性継承
- `FR-070`: 全検索経路の evidence 前認可
- `FR-071`: 非信頼根拠と prompt injection 防御
- `FR-072`: 版管理索引の安全な切替・ロールバック
- `FR-073`: 正本性・時点・矛盾を保つ根拠集合
- `FR-074`: 再現可能な versioned trace
- `FR-075`: 工程別評価と公開ゲート
- `FR-082`: loss-aware extraction/normalization
- `FR-083`: idempotent staged ingest recovery
- `FR-084`: isolated benchmark evaluation subject
- `FR-088`: trace data minimization/redaction
- `FR-089`: safe degradation invariant
- `FR-092`: versioned 構造保持 chunking
- `FR-093`: 本番 RAG 品質・安全 monitoring control loop

### サービス品質

- `SQ-005`: 権限外 evidence 露出 0 件
- `SQ-006`: 権限剥奪・削除反映 SLO
- `SQ-007`: 原子的品質制約を束ねる RAG 品質プロファイル
- `SQ-008`: 応答時間 SLO
- `SQ-009`: 認可済み検索の回収品質
- `SQ-010`: 回答忠実性
- `SQ-011`: 引用品質
- `SQ-012`: 回答可能性判断品質
- `SQ-013`: 業務タスク達成品質
- `SQ-014`: 可用性・復旧 SLO
- `SQ-015`: 単位処理コスト上限

既存の `FR-004`, `FR-005`, `FR-014`–`FR-018`, `FR-026`, `FR-038`, `FR-045`, `FR-046` は、引用、回答保留、検索・回答検証、非同期取り込み、trace の既存要求として維持し、新要求を追加制約として適用する。

## 置換・互換方針

| 既存要求 | 扱い | 置換先・理由 |
| --- | --- | --- |
| `FR-041` | Superseded | group create/document register は `FR-001`, `FR-057`, `FR-060`, `FR-068`, `FR-076`, `FR-081`、共有・監査は `FR-062`, `FR-076`, `FR-081`, `FR-085`, `FR-086`、検索 scope は `FR-061`, `FR-063`, `FR-064`, `FR-070`、一時添付は `FR-067` へ分割する。旧 tenant/org audience は `OQ-RD-011` の決定まで採用しない。 |
| `FR-052` | Superseded | 3層認可が複合的かつ planning のため `FR-056`–`FR-060` へ分割する。 |
| `NFR-011` | Superseded | 31 個の API/UI/role 条件を 1 要求に集約しているため、既存個別 FR と `FR-056`–`FR-067`, `FR-076`–`FR-081`, `FR-084`, `FR-086` へ AC 単位で分割する。 |
| `SQ-001` | 維持・詳細化 | 横断的な品質観点として維持し、合否を原子的な `SQ-005`–`SQ-015` へ分離する。 |

互換のため古い ID と履歴は削除しない。新規実装・設計・テストの trace は置換先を優先する。

## 現行コードとの主要な不一致

| ID | 現状 | 要求上の扱い | Confidence |
| --- | --- | --- | --- |
| GAP-RD-001 | 管理台帳の suspend/delete が Cognito user/session を無効化しない。 | `FR-058`, `FR-090`, `SQ-006` に未達。 | confirmed |
| GAP-RD-002 | `AppUser` に tenant がなく、検索 filter の tenant は request 由来である。 | `FR-056`, `FR-060`, `FR-070` に未達。 | confirmed |
| GAP-RD-003 | legacy helper と `FolderPermissionService` が併存し、role/resource-group と userId/email の namespace も重なる。 | `FR-059`, `FR-061`, `FR-079`, `FR-081` に未達。ADR-0004 と conflict。 | conflict |
| GAP-RD-004 | `SYSTEM_ADMIN` が通常資源を無条件 bypass する経路がある。 | `FR-059` に未達。ADR-0004 と conflict。 | conflict |
| GAP-RD-006 | `CHAT_USER` は read を持つが Web の documents view は manage permission を要求する。 | `FR-064` に未達。 | confirmed |
| GAP-RD-008 | reader schema と error/count contract が principal、metadata、資源存在を過剰に示し得る。 | `FR-064`, `FR-091` に未達。 | confirmed |
| GAP-RD-009 | semantic vector query は resource permission を finite hit 取得後に確認する。 | `FR-070`, `SQ-005` に部分適合。 | confirmed |
| GAP-RD-010 | memory は legacy post-filter、context expansion は current permission を再確認しない。 | `FR-059`, `FR-070`, `SQ-005` に未達。 | confirmed |
| GAP-RD-011 | worker は submit 時 group snapshot を再利用し、開始・commit 前の current identity/resource state を復元しない。 | `FR-090`, `SQ-006` に未達。 | confirmed |
| GAP-RD-012 | quality metadata 欠損時に approved/verified/current/high/eligible を補い、classification/usage/quality の current reference を全派生物・利用目的で再評価しない。 | `FR-066`, `FR-068`–`FR-070`, `FR-075` と conflict。 | conflict |
| GAP-RD-013 | 取り込みは scoped idempotency、attempt fencing、winner-only reconciliation を持たず、抽出で silent truncation し、chunking の versioned 構造・品質 contract がない。 | `FR-082`, `FR-083`, `FR-092` に未達。 | confirmed |
| GAP-RD-014 | 構造 escape はあるが、untrusted instruction rule、detector/quarantine、attack corpus がない。 | `FR-071` に部分適合。 | confirmed |
| GAP-RD-016 | delete は物理削除中心で deny-first/reconciliation 契約がない。 | `FR-066`, `SQ-006` に未達。 | confirmed |
| GAP-RD-017 | cutover/rollback は exactly-one-active と current deny を保証しない。 | `FR-072`, `SQ-006` に未達。 | confirmed |
| GAP-RD-018 | debug trace の raw data と redaction 宣言が一致しない。 | `FR-088` と conflict。`FR-074` の再現情報にも部分適合。 | conflict |
| GAP-RD-019 | accepted evaluator profile 選択とは別に、product runtime に domain 固有語・regex と metadata 自動 policy 選択があり、expected-field 隔離と production equivalence の gate がない。 | `FR-075`, `SQ-007` に部分適合/conflict。 | conflict |
| GAP-RD-020 | CDK self-signup disabled と `FR-025`/Web が衝突し、post-confirmation handler は未接続である。 | `FR-025`, `OQ-RD-008` と conflict。 | conflict |
| GAP-RD-022 | backend/infra/Web の role catalog がずれ、role revoke/self/last-admin/audit guard が不足する。 | `FR-079`, `FR-080`, `FR-086` に未達。 | conflict |
| GAP-RD-023 | document move は manifest を先に更新して vector metadata 更新が optional、folder move は subtree path と配下文書/index/policy を一つの公開単位で更新しない。 | `FR-061`, `FR-065`, `FR-087`, `SQ-009` に未達。 | confirmed |
| GAP-RD-024 | trace と benchmark はあるが、本番 stage/slice 別の品質・安全 drift 検出、alert、safe action の control loop がない。 | `FR-093`, `SQ-005`–`SQ-015` に未達。 | confirmed |

詳細、コード行、レポート根拠、改善順序は `docs/spec-recovery/16_current_state_gap_analysis_202607.md` を正とする。

## 未確定判断

次は要求の欠落ではなく、責任者が値または方針を承認するまで `open_question` として管理する。

| ID | 未確定判断 |
| --- | --- |
| `OQ-RD-001` | 単一テナント固定か複数テナントか、authoritative tenant source は何か。 |
| `OQ-RD-002` | 文書直接 grant とフォルダー grant の max/min、非管理主体への通常 policy 明示 deny、親子 override の最終規則。mandatory deny と管理主体 invariant の優先順位は確定済み。 |
| `OQ-RD-003` | direct `full` が許可する share/move/delete/reindex 操作。 |
| `OQ-RD-004` | 権限剥奪、削除、索引更新、キャッシュ失効の SLO 値。 |
| `OQ-RD-005` | 業務スライス別の検索、忠実性、引用、回答可能性、業務達成の合格値。 |
| `OQ-RD-006` | chat/search/ingest の workload、p95/p99、可用性、費用上限。 |
| `OQ-RD-007` | break-glass の有無、承認者、期限、理由、監査、事後 review。 |
| `OQ-RD-008` | self-signup、invite、SSO、tenant-configurable の正式方針。 |
| `OQ-RD-009` | source/chunk/cache/trace/audit の retention、hard delete、legal hold。 |
| `OQ-RD-010` | 情報源 authority、施行期間、矛盾 escalation の責任者と規則。 |
| `OQ-RD-011` | 共有 audience として許可する principal 種別。 |
| `OQ-RD-012` | move に source container `full` を必須とするか。 |

既存の `Q-001`–`Q-012` との重複・関連は `docs/spec-recovery/10_open_questions.md` の crosswalk を正とする。

未確定値を仮の合格値として扱わず、対応する要求は Draft のままにする。

## 妥当性確認状況

| 観点 | 状態 | 根拠・制約 |
| --- | --- | --- |
| 原子性 | reviewed | 新規 FR/SQ は 1 つの主判断に分割した。 |
| 必要性 | reviewed | コード、既存 ADR/要件、障害・作業レポート、RAG ガイドから trace した。 |
| 内部整合 | reviewed | 旧複合要件を Superseded とし、置換先を明示した。 |
| 外部整合 | reviewed | RAG ガイドと SWEBOK の該当ページを記録した。 |
| 検証可能性 | reviewed | 各要件内に BDD/否定試験と検証方法を置いた。 |
| ステークホルダー合意 | pending | 未確定判断と SLO/品質閾値は未承認。 |
| 実装適合 | partial | 現行実装の適合・不適合は gap として分離し、実装済みとは扱わない。 |

## 関連文書

- `docs/spec-recovery/13_requirements_redefinition_202607.md`
- `docs/spec-recovery/14_authorization_sharing_matrix_202607.md`
- `docs/spec-recovery/15_rag_lifecycle_matrix_202607.md`
- `docs/spec-recovery/16_current_state_gap_analysis_202607.md`
- `docs/spec-recovery/17_traceability_matrix_202607.csv`
- `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_003.md`
