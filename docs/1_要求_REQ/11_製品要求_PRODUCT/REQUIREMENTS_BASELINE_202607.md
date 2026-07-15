# rag-assist 要求ベースライン 2026-07

- ファイル: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md`
- 種別: `REQ_PRODUCT_BASELINE`
- 作成日: 2026-07-11
- 最終更新: 2026-07-14
- 状態: Draft（ステークホルダー承認前）
- 変更要求: `CHG-003`

## 目的

現行コードを正解そのものとはみなさず、利用者ニーズ、既存要件、実装・テスト、作業・障害レポート、『RAGエンジニアリングガイド』、SWEBOK v4.0a を相互照合し、権限、文書共有、RAG ライフサイクル、UI/UX 品質基盤の要求を再定義する。

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
| SRC-036 | `apps/api/src`, `apps/web/src`, `infra` | `origin/main` commit `9cd904d3c5203caf2400eb2ff654096d63f9d8fb` と本 task の read-only audit | 現行実装とテストの事実 | confirmed |
| SRC-037 | `docs/1_要求_REQ`, `docs/2_アーキテクチャ_ARC`, `docs/3_設計_DES` | 既存要求・ADR・設計 | 既存合意と矛盾の検出 | confirmed |
| SRC-038 | `reports/working`, `reports/bugs` の権限・共有・RAG 関連レポート | 2026-05-12–2026-05-22 を中心に本文確認 | 実装意図、既知制約、未検証事項 | confirmed |
| SRC-039 | GitHub Issue #345、PR #341〜#344、現行 Web source/test/inventory | 2026-07-14、`origin/main` `b9fb39b` | UI/UX、a11y、responsive、状態、文書・実装同期 | confirmed |

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
| Web 利用者・回答担当者・管理 UI 利用者 | 権限、viewport、zoom、入力手段にかかわらず許可済み主要 job を予測可能に完了する。 |
| UI 実装者・reviewer | production view、正規要件、AC、検証、生成 inventory の不整合を merge 前に検出する。 |

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

### 横断不変条件

| 境界 | 必須条件 |
| --- | --- |
| Identity | account、tenant、role、group は検証済み server-side context から取得し、request body/query の自己申告値を認可根拠にしない。 |
| Authorization | account state → tenant → route permission → resource/owner/effective grant → mandatory deny の順で評価し、欠損・矛盾は deny にする。 |
| Sharing | actor と principal の双方を検証し、管理主体 invariant、同一 tenant、version conflict、存在秘匿を維持する。 |
| Retrieval | permission、classification、usage、quality、validity を evidence 選択前に評価し、memory/context/cache でも current state を再確認する。 |
| Ingestion/index | admission、属性継承、version、attempt fencing、winner-only publish、exactly-one-active index を追跡する。 |
| Generation/citation | 取得本文と tool output を未信頼 data とし、支持 span のない claim を citation 自動補完で正当化しない。 |
| Revocation/delete | まず新規利用を deny し、その後に cache/index/derived artifact を reconcile する。 |
| Async/trace | 長時間処理は開始・commit 前に再認可し、trace は本文・credential を最小化しつつ version/provenance を残す。 |

これらは target invariant であり、次節の gap が残る間は実装済みとみなさない。

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

### UI/UX 品質基盤

- `FR-094`: 権限対応の addressable navigation と安全な復帰
- `FR-095`: loading/empty/error/permission/partial/stale/retry の共通状態契約
- `FR-096`: 高影響操作の対象・影響・回復可否・結果フィードバック
- `FR-097`: high-density workspace の query/selection context 保持
- `FR-098`: 主要 job・詳細・高影響操作の段階的情報設計
- `NFR-016`: production view から要件・AC・検証までの意味トレーサビリティと freshness gate
- `NFR-017`: 利用者語彙、design token、共通 primitive、honest UI の一貫性
- `NFR-018`: 自動・手動 UI 品質 evidence を release 判定へ残すこと
- `SQ-016`: WCAG 2.2 AA と viewport/zoom/input/content-state matrix での主要 journey 完遂

これらは GitHub Issue #345 の継続改善基盤を原子的な要求へ分けた Draft である。正規 UI 設計は `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`、事実・推定・矛盾・未確定点は同 issue の dated analysis report under `reports/working/` を参照する。PR #341〜#344 は 2026-07-14 時点ですべて `main` に統合済みであり、削除済みの旧 `spec` / `spec-recovery` docs root は正規要求として復活させない。

既存の `FR-004`, `FR-005`, `FR-014`–`FR-018`, `FR-026`, `FR-038`, `FR-045`, `FR-046` は、引用、回答保留、検索・回答検証、非同期取り込み、trace の既存要求として維持し、新要求を追加制約として適用する。

## 置換・互換方針

| 既存要求 | 扱い | 置換先・理由 |
| --- | --- | --- |
| `FR-041` | Superseded | group create/document register は `FR-001`, `FR-057`, `FR-060`, `FR-068`, `FR-076`, `FR-081`、共有・監査は `FR-062`, `FR-076`, `FR-081`, `FR-085`, `FR-086`、検索 scope は `FR-061`, `FR-063`, `FR-064`, `FR-070`、一時添付は `FR-067` へ分割する。旧 tenant/org audience は `OQ-RD-011` の決定まで採用しない。 |
| `FR-052` | Superseded | 3層認可が複合的かつ planning のため `FR-056`–`FR-060` へ分割する。 |
| `NFR-011` | Superseded | 31 個の API/UI/role 条件を 1 要求に集約しているため、既存個別 FR と `FR-056`–`FR-067`, `FR-076`–`FR-081`, `FR-084`, `FR-086` へ AC 単位で分割する。 |
| `SQ-001` | 維持・詳細化 | 横断的な品質観点として維持し、合否を原子的な `SQ-005`–`SQ-015` へ分離する。 |

互換のため古い ID と履歴は削除しない。新規実装・設計・テストの trace は置換先を優先する。

### 統合済みの旧復元 ID

旧抽出文書を削除しても既存要求の後方 trace を失わないよう、旧 ID は次の正規要求へ統合する。旧 ID 自体は新規実装の要件 ID として再利用しない。

| 旧 ID | 正規の統合先 |
| --- | --- |
| `REQ-UI-001`, `AC-UI-001`, `SPEC-UI-001` | `FR-042`, `FR-043`, `SQ-004` |
| `REQ-HIST-002`, `AC-HIST-002`, `SPEC-HIST-003` | `FR-044` |
| `REQ-SRCH-002`, `AC-SRCH-002`, `SPEC-SRCH-002` | `FR-045` |
| `REQ-DBG-002`, `AC-DBG-002`, `SPEC-DBG-002` | `FR-046`, `NFR-015` |
| `REQ-BENCH-002`, `AC-BENCH-002`, `SPEC-BENCH-002` | `FR-047` |
| `REQ-BENCH-003`, `AC-BENCH-003`, `SPEC-BENCH-003` | `FR-048` |
| `REQ-RAG-003`, `AC-RAG-003`, `SPEC-RAG-003` | `SQ-003` |
| `REQ-DOC-002`, `AC-DOC-003`, `GAP-003` | `NFR-014` |
| `GAP-008` | `NFR-015` |

## 現行コードとの主要な不一致

2026-07-13 の audit では `FR-056`–`FR-093` と `SQ-005`–`SQ-015` に完全実装と判定できる項目はなく、`partial`、`missing`、`conflict` のいずれかである。次の表を gap と実装 todo の正規対応とする。

| ID | 現状と要求上の扱い | Confidence | 実装 todo |
| --- | --- | --- | --- |
| GAP-RD-001 | suspend/delete が Cognito user/session を無効化せず、`FR-058`, `FR-090`, `SQ-006` に未達。 | confirmed | `20260713-2250-authoritative-identity-session.md` |
| GAP-RD-002 | authoritative tenant がなく request 由来 filter に依存し、`FR-056`, `FR-060`, `FR-070` に未達。 | confirmed | `20260517-1241-tenant-scoped-document-groups.md` |
| GAP-RD-003 | authorization helper と principal namespace が併存し、`FR-059`, `FR-061`, `FR-079`, `FR-081` に未達。 | conflict | `20260713-2251-canonical-resource-authorization.md` |
| GAP-RD-004 | `SYSTEM_ADMIN` の通常資源 bypass が `FR-059`、`ARC_ADR_004` と衝突する。 | conflict | `20260713-2251-canonical-resource-authorization.md` |
| GAP-RD-005 | direct grant、folder grant、role、owner/manager の操作別合成順が一意でなく、`FR-057`, `FR-059`, `FR-063`, `FR-076` に未達。 | inferred | `20260713-2252-safe-sharing-reader-contract.md` |
| GAP-RD-006 | `CHAT_USER` は read を持つが Web documents view は manage を要求し、`FR-064` に未達。 | confirmed | `20260713-2252-safe-sharing-reader-contract.md` |
| GAP-RD-007 | principal selector と share mutation の同一 tenant・許可種別検証が不足し、`FR-062`, `FR-078`, `FR-085` に未達。 | confirmed | `20260713-2252-safe-sharing-reader-contract.md` |
| GAP-RD-008 | reader schema/error/count が principal、metadata、資源存在を過剰に示し得て、`FR-064`, `FR-091` に未達。 | confirmed | `20260713-2252-safe-sharing-reader-contract.md` |
| GAP-RD-009 | semantic query が有限件取得後に権限 filter し、`FR-070`, `SQ-005` に部分適合。 | confirmed | `20260713-2253-current-eligible-rag-retrieval.md` |
| GAP-RD-010 | memory/context expansion が current permission を一貫して再確認せず、`FR-059`, `FR-070`, `SQ-005` に未達。 | confirmed | `20260713-2253-current-eligible-rag-retrieval.md` |
| GAP-RD-011 | worker が submit 時 snapshot を再利用し、開始・commit 前の再認可がなく、`FR-090`, `SQ-006` に未達。 | confirmed | `20260713-2250-authoritative-identity-session.md` |
| GAP-RD-012 | quality metadata 欠損を安全でない既定値で補い、`FR-066`, `FR-068`–`FR-070`, `FR-075` と衝突する。 | conflict | `20260713-2253-current-eligible-rag-retrieval.md`, `20260507-2000-document-block-ingestion-v2.md` |
| GAP-RD-013 | ingest に scoped idempotency、attempt fencing、loss-aware extraction、versioned chunk contract がなく、`FR-082`, `FR-083`, `FR-092` に未達。 | confirmed | `20260507-2000-document-block-ingestion-v2.md` |
| GAP-RD-014 | untrusted instruction rule、検出・隔離、attack corpus がなく、`FR-071` に部分適合。 | confirmed | `20260713-2255-prompt-evidence-safety.md` |
| GAP-RD-015 | citation 自動補完が未支持 claim を支持済みに見せ得て、`FR-073`, `SQ-010`, `SQ-011` と衝突する。 | conflict | `20260713-2255-prompt-evidence-safety.md` |
| GAP-RD-016 | delete が物理削除中心で deny-first/reconciliation 契約がなく、`FR-066`, `SQ-006` に未達。 | confirmed | `20260517-1241-folder-delete-archive.md` |
| GAP-RD-017 | cutover/rollback が exactly-one-active と current deny を保証せず、`FR-072`, `SQ-006` に未達。 | confirmed | `20260507-2000-ingestion-bluegreen-benchmark-gate.md` |
| GAP-RD-018 | trace raw data と redaction 宣言が一致せず、`FR-074`, `FR-088` と衝突する。 | conflict | `20260713-2256-trace-evaluation-isolation.md` |
| GAP-RD-019 | product runtime に domain/dataset 固有 rule があり、`FR-075`, `SQ-007` に部分適合または衝突する。 | conflict | `20260713-2256-trace-evaluation-isolation.md`, `20260506-1203-requirements-classification-policy.md` |
| GAP-RD-020 | CDK self-signup disabled と `FR-025`/Web が衝突し、post-confirmation handler が未接続。 | conflict | `20260713-2258-self-signup-policy-implementation.md` |
| GAP-RD-021 | CloudFront/PKCE/CORS の accepted target と deploy/runtime が一致せず、`FR-054`, `TC-003` に未達。 | conflict | `20260522-2120-cloudfront-single-entry-implementation.md` |
| GAP-RD-022 | role catalog が backend/infra/Web でずれ、mutation guard/audit が不足し、`FR-079`, `FR-080`, `FR-086` に未達。 | conflict | `20260713-2251-canonical-resource-authorization.md` |
| GAP-RD-023 | move が manifest、vector metadata、subtree/index/policy を一公開単位で更新せず、`FR-061`, `FR-065`, `FR-087`, `SQ-009` に未達。 | confirmed | `20260517-1241-document-move-between-folders.md` |
| GAP-RD-024 | 本番 stage/slice 別 drift、alert、safe action の control loop がなく、`FR-089`, `FR-093`, `SQ-008`, `SQ-012`–`SQ-015` に未達。 | confirmed | `20260713-2257-production-rag-monitoring.md` |

表の todo はすべて `tasks/todo/` 配下である。planning 要求の `FR-049`–`FR-051`, `FR-053`–`FR-055` は、それぞれ `20260713-2259-chat-orchestration-completion.md`、`20260713-2300-async-agent-execution.md`、`20260713-2301-user-preferences.md`、`20260713-2302-api-lifecycle-common-middleware.md`、`20260522-2120-cloudfront-single-entry-implementation.md` で追跡する。`SQ-004` の未検証 responsive 条件は `20260713-2304-responsive-chat-ui-verification.md` で追跡する。

### UI/UX 品質基盤の不一致

2026-07-14 の Issue #345 audit では、静的 inventory の freshness は存在するが、production `AppView` と persona/job、URL/permission、正規要件、AC、実行可能検証を結ぶ意味的 gate はない。次の gap は未実装または未検証であり、対応 task の完了前に要件適合とみなさない。

| ID | 現状と要求上の扱い | Confidence | 実装 todo |
| --- | --- | --- | --- |
| GAP-UI-001 | 720px 以下で account/profile 導線が消え、権限別 navigation overflow 代替もなく、`FR-094`, `SQ-016` に未達。 | confirmed | `20260714-issue-345-mobile-navigation.md` |
| GAP-UI-002 | view/document state の URL 読み取りはあるが、利用者遷移が `replaceState` 中心で denied/invalid recovery と browser history 契約が不完全。 | confirmed | `20260714-issue-345-url-history-routing.md` |
| GAP-UI-003 | global error は plain banner で、permission/partial/stale/target/retry を区別する共通状態契約がない。 | confirmed | `20260714-issue-345-shared-ui-state-contract.md` |
| GAP-UI-004 | 高影響操作の target/effect/recoverability/result を横断保証する primitive と検証がない。 | inferred | `20260714-issue-345-risky-operation-feedback.md` |
| GAP-UI-005 | documents は 143 interaction の高密度 UI で、操作 hierarchy と state restoration の横断検証がない。 | confirmed | `20260714-issue-345-document-workspace-context.md` |
| GAP-UI-006 | chat/history/assignee の question-to-human-response journey を state transition として検証する E2E が不足する。 | confirmed | `20260714-issue-345-chat-assignee-journey.md` |
| GAP-UI-007 | 8 AppViews 横断の a11y/responsive 修正、利用者語彙・token・primitive 統一が完了していない。 | confirmed | `20260714-issue-345-cross-screen-a11y-responsive.md`, `20260714-issue-345-ui-language-primitives.md` |
| GAP-UI-008 | Playwright は desktop Chromium 中心で E2E は手動 dispatch、axe/mobile/browser/visual の required PR gate がない。 | confirmed | `20260714-issue-345-ui-automated-quality-gates.md` |
| GAP-UI-009 | keyboard、screen reader、320px/400% zoom、実機の release evidence がない。 | confirmed | `20260714-issue-345-manual-a11y-evidence.md` |

admin 固有の source/as-of、選択 context、responsive、server-authoritative data は既存 `20260714-1011-admin-ui-governance-quality.md` を再利用する。個人設定の永続化は既存 `20260713-2301-user-preferences.md`、chat responsive の狭い `SQ-004` 条件は既存 `20260713-2304-responsive-chat-ui-verification.md` を維持し、Issue #345 task との重複範囲を相互参照する。

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
| `OQ-UI-001` | PR 必須とする browser matrix を Chromium mobile までにするか、Firefox/WebKit も required にするか。 |
| `OQ-UI-002` | 代表 screen reader / OS / browser と実機端末の release matrix、実施頻度、evidence owner。 |
| `OQ-UI-003` | UI semantic trace の planned verification を implemented に昇格させる review owner と期限 SLA。 |

未確定値を仮の合格値として扱わず、対応する要求は Draft のままにする。decision owner、選択肢、承認、要求/ADR 反映は `tasks/todo/20260713-2303-requirement-open-decisions.md` で追跡する。

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

- `docs/1_要求_REQ/README.md`
- `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`
- `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_003.md`
- `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_004.md`
- `docs/3_設計_DES/11_詳細設計_DLD/`
