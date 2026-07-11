# 2026-07 権限・文書共有・RAG 要求再定義

## 1. 目的と適用範囲

本書は、現行実装、既存要求・ADR、作業・障害レポート、`.workspace/rag-engineering-guide.pdf`、`.workspace/swebok-v4.pdf` を別々の要求源として扱い、権限、文書共有、RAG ライフサイクルを再定義した作業記録である。

規範的な要求は `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` と個別 `FR-056`–`FR-093`, `SQ-005`–`SQ-015` を正とする。本書は要求獲得、分析、採否、矛盾、未確定判断を追跡する。

対象:

- identity/account/role/tenant/resource の認可境界
- folder/document の所有、共有、継承、direct grant、移動、失効、削除
- upload/ingest、構造保持 chunk/metadata、index、retrieval、evidence、generation、citation、evaluation、本番 monitoring、trace
- Web で read-only shared resource を発見・選択する利用導線

対象外:

- 本タスクでの認可・RAG runtime 実装修正
- SLO/品質閾値の無根拠な仮決定
- 本番 deploy、AWS 統合試験、実データ migration

## 2. 入力と信頼度

| Source ID | 入力 | 読み取り範囲 | Confidence |
| --- | --- | --- | --- |
| SRC-034 | `.workspace/rag-engineering-guide.pdf` | §3–§8、PDF pp.59–208 | confirmed |
| SRC-035 | `.workspace/swebok-v4.pdf` | Chapter 1、PDF pp.44–62 | confirmed |
| SRC-036 | current code/tests | commit `e8ae57f6126aca802d85042a1697d07c836b3603` の auth、authorization、folder/document、retrieval、ingest、prompt、quality、Web、infra | confirmed |
| SRC-037 | existing REQ/ADR/design | FR-025/041/052、NFR-011、ADR-0004/0005、chapter spec。矛盾は fact/gap の `conflict` で別記 | confirmed |
| SRC-038 | related reports | 2026-05-12–05-22 の authorization/share/delete/scope reports | confirmed |

PDF の推奨事項自体は `confirmed`、rag-assist の製品要求として採用する判断は `inferred` とした。現行コードは「現在どう動くか」の根拠であり、「どうあるべきか」の優先根拠にはしない。

`SRC-038` として本文を再確認した focused reports:

- `reports/working/20260514-1529-b-authorization-3layer.md`
- `reports/working/20260516-1728-document-group-resource-auth.md`
- `reports/working/20260517-1936-folder-permission-foundation.md`
- `reports/working/20260519-1934-document-group-authz-tests.md`
- `reports/working/20260519-2055-pr328-owner-bypass-resource-permission.md`
- `reports/working/20260519-2207-pr328-memory-parent-permission.md`
- `reports/working/20260520-2107-folder-scope-metadata-fix.md`
- `reports/working/20260520-2130-pr326-resource-permission-fix.md`
- `reports/working/20260521-0020-pr326-effective-permission-fail-closed.md`
- `reports/working/20260521-0115-pr326-document-ingest-scope-required.md`
- `reports/working/20260521-0900-document-group-permissions-ui.md`
- `reports/working/20260521-0912-document-share-move-ui.md`
- `reports/working/20260521-2307-pr331-rag-scope-ledger.md`
- `reports/working/20260521-2308-pr332-answer-scope.md`
- `reports/working/20260522-0923-document-share-stale-state-fix.md`
- `reports/working/20260522-1127-document-share-load-fail-guard.md`
- `reports/bugs/20260506-2303-role-assignment-access-denied.md`
- `reports/bugs/20260510-1210-document-delete-missing-manifest-500.md`

## 3. 抽出した確定事実

| Fact ID | 事実 | 根拠 | Confidence |
| --- | --- | --- | --- |
| FACT-027 | 認可強制条件は verified identity から構築し、client tenant/role を信頼してはならない。 | RAG ガイド PDF pp.99,187 | confirmed |
| FACT-028 | ACL/tenant/delete/expiry は relevance score でなく候補集合の hard boundary である。 | RAG ガイド PDF pp.119,125–127 | confirmed |
| FACT-029 | 権限外本文は prompt/cache/trace へ到達する前に除外する。 | RAG ガイド PDF pp.81,187–188 | confirmed |
| FACT-030 | share revoke/account-group change/delete は old index/cache/session/memory/queued work に反映する。 | RAG ガイド PDF pp.81,188–189 | confirmed |
| FACT-031 | 文書 ACL と lifecycle/provenance は全 chunk へ継承し、欠損は deny する。 | RAG ガイド PDF pp.78–81 | confirmed |
| FACT-032 | 取得文書・tool output は instruction でなく untrusted data である。 | RAG ガイド PDF pp.146,193–194 | confirmed |
| FACT-033 | RAG は ingestion/retrieval/post-retrieval/generation/citation/E2E を別々に評価する。 | RAG ガイド PDF pp.156–185 | confirmed |
| FACT-034 | 個別要求は atomic/testable で、属性、AC、validation、bidirectional trace を持つ。 | SWEBOK PDF pp.50,54–61 | confirmed |
| FACT-035 | `AppUser` に tenant がなく、semantic/memory は resource post-filter を含む。 | `auth.ts:7-12`, `hybrid-retriever.ts:161-203,743-768` | confirmed |
| FACT-036 | account suspend/delete は admin ledger を更新するだけで Cognito/session を無効化しない。 | `memorag-service.ts:1498-1509`, `user-directory.ts:15-18` | confirmed |
| FACT-037 | folder authorization は legacy helper と `FolderPermissionService` が併存する。 | `document-group-permissions.ts:37-66`, `folder-permission-service.ts` | confirmed |
| FACT-038 | quality metadata 欠損は approved/verified/current/high/eligible に補完される。 | `quality-policy.ts:53-65` | confirmed |
| FACT-039 | `CHAT_USER` は read permission を持つが documents view は manage permission を要求する。 | `authorization.ts:164-170`, `usePermissions.ts:39-49` | confirmed |
| FACT-040 | CDK self-signup disabled と FR-025/Web self-signup が衝突し、post-confirmation trigger は未接続である。 | `memorag-mvp-stack.ts:309-318`, `FR-025` | conflict |

## 4. 再定義した stakeholder tasks

### TASK-025 認可文脈と tenant を server-side で確定する

- Actor: Identity platform / Security
- Outcome: account、tenant、role、resource group を verified source から構築し、request で拡張できない
- Related: FR-056–FR-060, FR-077–FR-080, FR-084, FR-090, FR-091

### TASK-026 共有資源の実効権限を一意に管理する

- Actor: Document owner / Share manager / Security
- Outcome: folder/direct grant/deny/inheritance の一意な結果と、share/move/revoke の監査がある
- Related: FR-061–FR-066, FR-076–FR-081, FR-085–FR-087

### TASK-027 read-only 共有資料を利用する

- Actor: General user
- Outcome: 許可資料を発見・閲覧・chat scope 選択でき、管理操作はできない
- Related: FR-064

### TASK-028 文書を検査・隔離・公開する

- Actor: Document steward / RAG operator
- Outcome: provenance/owner/ACL/quality を検証し、unknown を正常値に補完せず publication gate を通す
- Related: FR-068, FR-069, FR-082, FR-083, FR-092

### TASK-029 全 RAG 経路で現在認可を強制する

- Actor: RAG platform / Security
- Outcome: lexical/vector/memory/expansion/citation/cache/worker の全経路で unauthorized evidence が 0
- Related: FR-058, FR-066, FR-070, FR-090, SQ-005, SQ-006

### TASK-030 安全性と品質を工程別に公開判定する

- Actor: QA / RAG quality / Security / Business owner
- Outcome: stage/slice 別 metric と zero-tolerance security gate を versioned profile で判定する
- Related: FR-071–FR-075, FR-084, FR-088, FR-089, FR-093, SQ-005–SQ-015

## 5. 要求分割結果

| 旧要求 | 問題 | 正規の置換先 |
| --- | --- | --- |
| FR-041 | create/share/search/temp/ACL の複合要求 | group create/document register: FR-001, FR-057, FR-060, FR-068, FR-076, FR-081; share/audit: FR-062, FR-076, FR-081, FR-085, FR-086; search: FR-061, FR-063, FR-064, FR-070; temporary: FR-067 |
| FR-052 | account/feature/resource/全操作を planning 1件に集約 | FR-056–FR-060 |
| NFR-011 | API/UI/role/benchmark の AC 31件を集約 | 既存個別 FR と FR-056–FR-067, FR-076–FR-081, FR-084, FR-086 |
| SQ-001 | 複数品質軸を一要求に集約 | 維持し、判定を SQ-005–SQ-015 で詳細化 |

既存 FR-004/005/014–018/026/038/045/046 は削除せず、新要求が authorization、lifecycle、security、evaluation の追加制約になる。

## 6. 代表受け入れ条件

### AC-AUTH-003 current authorization

- Given: queued run の submit 後に account/role/share が revoke された
- When: worker が開始または commit する
- Then: current identity/resource state で拒否し、旧 snapshot で実行しない

### AC-SHARE-003 read-only discovery

- Given: CHAT_USER に read-only folder/direct document share がある
- When: Web から documents/chat を開く
- Then: 許可 summary と scope 選択を表示し、share/move/delete は表示・実行しない

### AC-RAG-004 unauthorized top hit

- Given: unauthorized chunk が semantic 上位で authorized chunk がその後ろにある
- When: top-K retrieval を行う
- Then: unauthorized hit を query boundary で除外し、authorized top-K を post-filter underfill させない

### AC-RAG-005 revocation race

- Given: initial retrieval 後、context expansion 前に share revoke が commit された
- When: adjacent chunk、citation、prompt を構築する
- Then: current policy で再認可し、revoked text を追加・保持しない

### AC-RAG-006 injection

- Given: document 内に ACL 無視、secret 開示、tool 実行の命令がある
- When: ingest/search/generation/tool planning を行う
- Then: untrusted data として扱い、system/security policy を変更しない

## 7. E2E シナリオ

| E2E ID | シナリオ | Actors / data | 主要期待 |
| --- | --- | --- | --- |
| E2E-AUTH-003 | suspended user と queued run | active user, admin, worker | session/new API/worker commit を拒否 |
| E2E-TENANT-001 | tenant A/B 同一 ID | 2 tenants, same resource ID | B の存在・本文・timing を A に露出しない |
| E2E-SHARE-003 | read-only folder/direct share | owner, CHAT_USER | discover/view/select 可、manage 不可 |
| E2E-SHARE-004 | revoke while chat runs | owner, reader, queued run | prompt/citation/cache に revoked text なし |
| E2E-RAG-003 | unauthorized semantic top hit | allowed/denied high-similarity docs | exposure 0、authorized top-K underfill なし |
| E2E-RAG-004 | indirect prompt injection | poisoned doc, tool/secret fixture | instruction 不実行、critical leak 0 |
| E2E-RAG-005 | old index rollback | deleted/revoked docs, staged/current index | old ACL/delete を復活させない |
| E2E-RAG-006 | conflicting versions | current/old/equal-authority docs | conflict を保持し限定回答/保留 |

## 8. 優先順位

### P0: 漏えい・失効境界

- FR-056–FR-060, FR-066, FR-069, FR-070, FR-077–FR-080, FR-084, FR-090, FR-091
- SQ-005, SQ-006
- account/Cognito/session、tenant、single authorization service、retrieval prefilter、worker reauthorization

### P1: 共有利用・取り込み安全性

- FR-061–FR-065, FR-067, FR-068, FR-071, FR-076, FR-081–FR-083, FR-085–FR-087, FR-092
- read-only UI、principal validation、folder/direct rule、ingest quarantine、prompt injection

### P2: 再現性・品質運用

- FR-072–FR-075, FR-088, FR-089, FR-093
- SQ-007–SQ-015
- index transition、evidence conflict、trace reproducibility/redaction、executable promotion gate、工程別品質、latency/reliability/cost SLO

## 9. Open questions

| ID | Question | Owner | Proposed safe default | Status |
| --- | --- | --- | --- | --- |
| OQ-RD-001 | single tenant か multi tenant か。authoritative tenant source は何か。 | Product/Security | server-configured single tenant も client 値を信頼しない | open_question |
| OQ-RD-002 | folder/direct grant の max/min、ordinary explicit deny、multi-folder 規則は何か。 | Product/Security | mandatory deny → administrative-principal invariant → ordinary deny → versioned allow composition | open_question |
| OQ-RD-003 | direct `full` は share/move/delete/reindex の何を許すか。 | Product/Document owner | source container full を危険操作に要求 | open_question |
| OQ-RD-004 | revoke/delete propagation SLO は何秒か。 | Security/SRE | 未承認値で合格扱いにしない | open_question |
| OQ-RD-005 | use case/slice 別 RAG quality threshold は何か。 | Business owner/QA | current baseline を測定後に承認 | open_question |
| OQ-RD-006 | chat/search/ingest p95/p99、availability、cost target は何か。 | Product/SRE | safety guard は値に関係なく省略禁止 | open_question |
| OQ-RD-007 | break-glass を導入するか。承認・期限・監査は何か。 | Security/Audit | 通常 SYSTEM_ADMIN bypass は禁止 | open_question |
| OQ-RD-008 | self-signup/invite/SSO の正式方針は何か。 | Product/Identity | 現行 conflict を解消するまで公開 signup を前提にしない | open_question |
| OQ-RD-009 | source/chunk/cache/trace/audit の retention と hard delete は何か。 | Legal/Security/Ops | authoritative deny を物理 purge より先に適用 | open_question |
| OQ-RD-010 | source priority、effective date、conflict handoff の責任者は誰か。 | Business owner | unresolved conflict は限定回答または保留 | open_question |
| OQ-RD-011 | user/resource group/tenant/guest/public link のうち許可する share audience は何か。 | Product/Security/Legal | active same-tenant user/resource group のみ | open_question |
| OQ-RD-012 | move に source container `full` を必須とするか。 | Product/Security | source/destination の両方に `full` | open_question |

## 10. 完了判定と制約

- 要求・AC・trace 文書の作成は実施した。
- 現行 runtime の修正、AWS E2E、2 tenant/2 user 本番相当試験は本タスクの対象外であり、実施済みとはしない。
- `inferred` 要求と `open_question` の値は、ステークホルダー承認までは Draft である。
- gap の exact evidence は `16_current_state_gap_analysis_202607.md`、行単位 trace は `17_traceability_matrix_202607.csv` を参照する。
