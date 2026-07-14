# 管理画面 Gap 分析（2026-07）

## 評価規則

- Severity: `P0` は認可回避・停止無効・データ破壊・重大な誤表示、`P1` は管理判断や主要taskを阻害、`P2` は運用性・理解・保守性を継続的に損なう。
- Confidence: `confirmed` は現行source/test/schemaから直接確認、`inferred` は確定事実からの影響推定、`conflict` は実装と要件/文書が不一致、`open_question` はowner判断待ち。
- 「全問題」は基準commitのrepository、参照したreports/docs、2026-07-13時点のPR #339から観測できる範囲を指す。実利用者観察・実AWS・実請求・実支援技術の未観測問題は断定しない。

## A. 利用量・料金の真正性

| Gap | Sev | Confidence | 問題 / 影響 | Evidence | 改善方針 | Task / AC |
| --- | --- | --- | --- | --- | --- | --- |
| `GAP-AUI-001` | P0 | confirmed |実行時usage writeがなく、利用後も件数・料金が0。未利用と計測欠落を誤認する | `FACT-AUI-011`–`014` | idempotent usage event、provider quantity、completeness/watermarkをsource of truthにする | `TASK-AUI-001`; `AC-AUI-001`–`012` |
| `GAP-AUI-002` | P0 | confirmed/conflict |全期間数量を「当月」に混ぜ、固定単価・固定更新日・benchmark単位不一致で金額根拠を再現できない | `FACT-AUI-019`–`023`; chapter §13 |同一期間、versioned pricing、provider/region/model/unit/effective/source、actual/estimate/unpricedを契約化 | `TASK-AUI-002`; `AC-AUI-013`–`024` |
| `GAP-AUI-003` | P0 | confirmed/inferred | document/debug/benchmark数量がuser実利用へ正しく帰属せず、全userやSYSTEM_ADMINへ全体件数を配る | `FACT-AUI-015`–`018` | event生成時にtenant/subject/run/featureを確定し、帰属不能をunknown bucketへ分離 | `TASK-AUI-001`; `AC-AUI-003`, `004`, `010`–`012` |
| `GAP-AUI-004` | P1 | confirmed | UIがuser cost、unit price、conversationを隠し、微小正値を`$0.0000`へ丸め得る | `FACT-AUI-024`–`026` | quantity/unit/price/subtotal/sourceを表示し、正値を0にしないprecision ruleを採用 | `TASK-AUI-002`, `003`; `AC-AUI-016`–`018`, `027`, `028` |
| `GAP-AUI-005` | P1 | confirmed/conflict | period/group/user/model/feature filter、前期間比較、異常、高cost要因へのdrill-downがない | `FACT-AUI-027`; chapter §13 | normalized query、comparison/anomaly provenance、cursor/sort/detailを追加 | `TASK-AUI-003`; `AC-AUI-025`–`032`, `040` |
| `GAP-AUI-006` | P1 | confirmed/conflict | cost export APIがあるのにUIは「未提供」と表示し、利用できない | `FACT-AUI-028` |同じquery objectを使うexport controlと状態/進捗/結果を提供 | `TASK-AUI-003`; `AC-AUI-037`, `038` |
| `GAP-AUI-007` | P0 | confirmed/conflict | cost/audit exportがread permissionを流用し、閲覧者が大量持ち出しできる境界を分離しない | `FACT-AUI-029`; chapter §§13–14 | `cost:export`/`audit:export`相当をrouteで分離し、scope/auditを強制 | `TASK-AUI-003`, `008`; `AC-AUI-037`, `102`–`104` |
| `GAP-AUI-008` | P0 rollout | confirmed candidate | PR #339は改善候補だが未mergeで、Scan 1,000件、tenant固定、汎用価格、live未検証が残る | `FACT-AUI-077`–`081` |現行へ再適合しtenant+period query、migration、dual-read、canary、rollback gateを追加 | `TASK-AUI-013`; `AC-AUI-147`–`158` |

## B. ロール・ユーザー・identity

| Gap | Sev | Confidence | 問題 / 影響 | Evidence | 改善方針 | Task / AC |
| --- | --- | --- | --- | --- | --- | --- |
| `GAP-AUI-009` | P0 | confirmed/conflict | backend 12 roleとCognito 9 groupがdriftし、どれが正本か一意でない | `FACT-AUI-037`; `FR-079` | authorization/provisioning/API/UIが参照するcanonical catalogとdrift checkを導入 | `TASK-AUI-004`; `AC-AUI-047`–`050` |
| `GAP-AUI-010` | P0 | confirmed |複数role APIに対しUIは単一selectを配列1件で保存し、既存roleを消す | `FACT-AUI-031`–`034`, `073` | grant/revoke deltaを作るmulti-role editorとbefore/after reviewへ変更 | `TASK-AUI-005`; `AC-AUI-053`–`056` |
| `GAP-AUI-011` | P1 | confirmed | role一覧はraw ID、件数、comma permissionだけで用途・危険度・差分・割当を判断できない | `FACT-AUI-035`, `036` |表示名/説明/category/risk/permission group/assigned count/search/compareを提供 | `TASK-AUI-004`; `AC-AUI-041`–`046` |
| `GAP-AUI-012` | P2 | confirmed/conflict | role create/update permissionはあるがroute/UIがなく、system/custom/変更可否の契約が不明 | `FACT-AUI-038`; chapter §12 | preset read-onlyかcustom role提供かを決定し、permission/route/controlを同期 | `TASK-AUI-004`; `AC-AUI-051`, `052`; `OQ-AUI-007` |
| `GAP-AUI-013` | P0 | confirmed/conflict | role mutationにreason、same-tenant/active、last-admin、version、原子的auditがない | `FACT-AUI-040`–`043`; `FR-080`, `FR-086` | server guard order、expectedVersion、idempotency、directory/projection/auditの整合をcommand化 | `TASK-AUI-005`; `AC-AUI-056`–`068` |
| `GAP-AUI-014` | P1 | confirmed | UIはself/付与不能roleを事前抑止せず、成功後のtoken/effective permission更新時点も説明しない | `FACT-AUI-041`; role-fix report | server policy由来capabilityでpreguardし、再認証/refresh/propagation stateを表示 | `TASK-AUI-005`; `AC-AUI-065`, `066` |
| `GAP-AUI-015` | P0 | confirmed | create userはCognito userを作らずledger-only active recordを作るため、実際にlogin可能なuserと一致しない | `FACT-AUI-044` | identity createを含むlifecycle commandと途中state/reconciliationを導入 | `TASK-AUI-006`; `AC-AUI-069`, `070` |
| `GAP-AUI-016` | P0 | confirmed/conflict | suspend/deleteがCognito/session/tokenへ効かず、「利用できなくなる」というUI文言が虚偽 | `FACT-AUI-045`–`049` | sign-in disable/session revoke/request-time state checkとtruthful confirmationを実装 | `TASK-AUI-006`; `AC-AUI-071`–`078`, `081` |
| `GAP-AUI-017` | P0 | confirmed | directory syncが既存group/statusを更新せず、deleted actor loadはledgerをactiveへ戻す | `FACT-AUI-048`, `050` | source方向を固定し、version/as-of付きreconciliationを行いdeleted invariantを守る | `TASK-AUI-006`; `AC-AUI-074`, `079`, `080` |
| `GAP-AUI-018` | P1 | confirmed/conflict | user一覧に検索/filter/detail/effective permission/folder/audit/paginationがなく、resource group管理もない | `FACT-AUI-051`, `052`; chapter §11 | server-side search/filter/cursor、scope-aware detail、role/group分離、group管理を追加 | `TASK-AUI-007`; `AC-AUI-082`–`087`, `091`, `092` |
| `GAP-AUI-019` | P1 | confirmed |一つのglobal loading/errorが全行へ伝播し、対象外操作まで停止し失敗対象が分からない | `FACT-AUI-053` | query key/row単位のpending/error/retry/idempotency stateへ分離 | `TASK-AUI-007`, `009`; `AC-AUI-088`–`090`, `109`, `114`, `116` |

## C. 状態・情報設計・管理導線

| Gap | Sev | Confidence | 問題 / 影響 | Evidence | 改善方針 | Task / AC |
| --- | --- | --- | --- | --- | --- | --- |
| `GAP-AUI-020` | P0 | confirmed |初期loader失敗を`console.warn`だけにし、UIは失敗理由・retryを持たない | `FACT-AUI-004`, `007`, `008` | panelごとのtyped query state、safe error/requestId、scoped retryを導入 | `TASK-AUI-009`; `AC-AUI-106`, `109`, `111`, `114` |
| `GAP-AUI-021` | P0 | inferred |失敗したdocument/question/debug/benchmark loaderの空配列長をoverviewが0件として表示し得る | `FACT-AUI-005`, `006` | countにstatus/source/as-ofを持たせ、error/loading/unknownを0へ変換しない | `TASK-AUI-009`, `010`; `AC-AUI-121`, `122` |
| `GAP-AUI-022` | P1 | confirmed | Web API wrapperのnested runtime validationが浅く、invalid/null/unavailable/forbiddenを混同する | `FACT-AUI-063`, `064` |共有runtime schemaとdiscriminated response/errorを採用 | `TASK-AUI-009`; `AC-AUI-107`, `108`, `110`–`112` |
| `GAP-AUI-023` | P1 | confirmed | users以外にrefresh/as-ofがなく、aliasは重複refresh、section/filterはURL復元不能 | `FACT-AUI-002`, `007`, `008` | normalized URL query、source/as-of/stale、panel scoped refresh/cache keyを統一 | `TASK-AUI-009`, `010`; `AC-AUI-112`–`118` |
| `GAP-AUI-024` | P1 | confirmed/conflict | overview KPIはread-onlyで対応section/filterへ遷移せず、章仕様のactionable dashboardを満たさない | `FACT-AUI-009`; chapter §10 | permission-aware action card/deep linkと根拠/thresholdを追加 | `TASK-AUI-010`; `AC-AUI-120`, `123`–`125` |
| `GAP-AUI-025` | P2 | confirmed | quality action APIがWebから未使用で、重複した未接続surfaceになっている | `FACT-AUI-010` | overview projectionへ統合するか不要ならAPIを明示廃止し、権限/重複/expiryを定義 | `TASK-AUI-010`; `AC-AUI-123`, `124`; `OQ-AUI-014` |

## D. 監査・alias・整合性

| Gap | Sev | Confidence | 問題 / 影響 | Evidence | 改善方針 | Task / AC |
| --- | --- | --- | --- | --- | --- | --- |
| `GAP-AUI-026` | P0 | confirmed/conflict | auditは成功user/role 5 actionだけでtenant/target/reason/result/request/policy versionがない | `FACT-AUI-054`, `055`; `FR-086` |全管理mutationの全resultを共通schemaでappend-only記録 | `TASK-AUI-008`; `AC-AUI-094`–`099` |
| `GAP-AUI-027` | P1 | confirmed | admin audit 100件、alias 200件、UI 8件へ無言で切り、audit exportも100件だけ | `FACT-AUI-056`, `057` | cursor/date/filterと同一query export、total/truncation metadataを導入 | `TASK-AUI-008`, `011`; `AC-AUI-099`, `100`, `103`, `134` |
| `GAP-AUI-028` | P0 | confirmed |単一JSON ledgerのread-modify-writeにversion/conditional writeがなく、同時更新・state/audit片側成功を防げない | `FACT-AUI-043`, `058` | version/ETag、atomic update/outbox、idempotency、reconciliation、integrityを導入 | `TASK-AUI-005`, `008`, `009`; `AC-AUI-062`–`064`, `098`, `115`, `116` |
| `GAP-AUI-029` | P1 | confirmed | alias reject理由固定、下書き化no-op、client架空state/time、disabled transition許容 | `FACT-AUI-059`–`062`, `073` | reason/version付き明示transition、server-authoritative response、state table、auditへ変更 | `TASK-AUI-011`; `AC-AUI-126`–`133` |

## E. 規模・responsive・a11y・用語・検証

| Gap | Sev | Confidence | 問題 / 影響 | Evidence | 改善方針 | Task / AC |
| --- | --- | --- | --- | --- | --- | --- |
| `GAP-AUI-030` | P1 | confirmed evidence gap | user/usage/audit/debug/alias/candidate event queryに固定slice・client集計があり、規模増加時に欠落/遅延する | `FACT-AUI-017`, `027`, `051`, `056`–`058`, `078` | tenant+period/search index、cursor、stable sort、load/SLO test、全体集計をpageから分離 | `TASK-AUI-001`, `003`, `007`, `008`, `013`; `AC-AUI-011`, `029`, `040`, `084`, `100`, `147` |
| `GAP-AUI-031` | P1 | confirmed evidence gap | 920px固定rowと4列aliasが320px/400%でreflowせず、horizontal scroll依存 | `FACT-AUI-067`, `068` | priority-based responsive layout、detail disclosure、320px/400% gateを導入 | `TASK-AUI-012`; `AC-AUI-135`, `136` |
| `GAP-AUI-032` | P1 | confirmed evidence gap |狭いtarget、custom table/empty、対象なしbutton名、busy/error通知不足で支援技術の操作性が不明 | `FACT-AUI-065`–`071` | semantic components、44px目安、対象付きname、focus/live/error/contrast testを導入 | `TASK-AUI-012`; `AC-AUI-137`–`143` |
| `GAP-AUI-033` | P2 | confirmed/conflict |英語section、日本語本文、raw role/permission、`groups`=role setが混在し概念を誤解させる | `FACT-AUI-003`, `035`, `052` |承認済み日本語用語、display metadata、application role/resource groupを分離 | `TASK-AUI-004`, `007`, `012`; `AC-AUI-041`, `050`, `085`, `144` |
| `GAP-AUI-034` | P1 | confirmed evidence gap | keyboard/screen reader/contrast/320px/400%/row-error/live integration testがなく、testは単一role置換と固定reject理由を正として固定 | `FACT-AUI-072`–`074` | defect期待を置換し、contract/security/responsive/a11y/manual/live matrixをrelease gate化 | `TASK-AUI-005`, `011`, `012`; `AC-AUI-145`, `146` |
| `GAP-AUI-035` | P1 | confirmed/conflict |旧`FR-027`、新`FR-079/080/086`、chapter、stale J3、未マージPRでtarget contractと検証状態が不一致 | `FACT-AUI-075`–`081` |要件baseline/supersede、PR再適合、未実施live evidenceと残余riskを明記 | `TASK-AUI-013`; `AC-AUI-147`–`158` |
| `GAP-AUI-036` | P1 | confirmed/conflict | `usage:read:own`/`cost:read:own`がconsumerなしで、global管理画面だけか本人向けsurfaceかが未定 | `FACT-AUI-030` | own/global queryを別scopeでserver強制し、不要ならcatalogから廃止 | `TASK-AUI-003`; `AC-AUI-009`, `039`; `OQ-AUI-017` |

## Root cause cluster

| Root cause | 代表 Gap | 説明 |
| --- | --- | --- |
| Contract-first prototype がproduction truthへ未移行 | `001`, `002`, `015`, `016` |台帳・固定概算・UI契約を先に作った段階のscope-outが残った |
| server/client/source-of-truth の不一致 | `009`, `010`, `013`, `017`, `022`, `029` |配列/単一select、catalog/provisioning、client fallback、identity/ledgerが別々に真実を持つ |
| stateを値へ潰す設計 | `001`, `020`, `021`, `022` | missing/loading/errorを0/empty/nullへ変換してしまう |
| permissionとdata export/actionの粒度不足 | `007`, `018`, `026`, `036` |read/export、role/group、global/ownの境界が表面ごとに揺れる |
| unversioned shared JSON/read-all | `028`, `030` |同時更新、件数増加、監査原子性に耐えない |
| release evidence不足 | `008`, `031`, `032`, `034`, `035` |candidate実装、live AWS、実支援技術、規模testの未検証を残す |

## 優先順位の結論

1. `GAP-AUI-013`, `016`, `017`, `028` を先に直し、権限変更・停止・同時更新が安全でない状態を解消する。
2. `GAP-AUI-001`–`004` を直し、usage/costを「表示できる値」から「説明可能な値」へ変える。
3. `GAP-AUI-005`–`012`, `018`–`027`, `036` を新contractへ接続し、管理者が探索・判断・対応できるUIにする。
4. `GAP-AUI-029`–`035` をquality/release gateとして適用し、規模・a11y・migrationの再発を防ぐ。

P0の真実性・security boundaryを満たさないまま、色、列幅、グラフだけを整える変更は受け入れない。
