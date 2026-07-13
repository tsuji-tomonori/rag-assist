# FR-076 保護資源の操作別認可行列

- 要件ID: `FR-076`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-076`
- 関連カテゴリ: `8. 認証・認可・管理・監査`

## 要件

- FR-076: 文書、フォルダー、resource group の規範的に enabled な作成・参照・更新・削除・移動・共有変更・検索利用を、要求された `resource type × operation` と完全一致する認可行列セルの feature permission、資源条件、追加 guard がすべて成立する場合に限って許可し、別セルの許可を代用せず、disabled・未定義セルを拒否すること。

## 規範的な行列キー

各セルは、操作固有の feature permission、資源条件、追加 guard、明示的な `deny` のいずれかを versioned policy に持たなければならない。未対応操作も暗黙の許可にはせず、明示的な `deny` として扱う。

| Resource type | create | read | update | delete | move | share | search/use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| document | `document.create` | `document.read` | `document.update` | `document.delete` | `document.move` | `document.share` | `document.useInSearch` |
| folder | `folder.create` | `folder.read` | `folder.update` | `folder.delete` | `folder.move` | `folder.share` | `folder.useInSearch` |
| resource group | `resourceGroup.create` | `resourceGroup.read` | `resourceGroup.update` | `resourceGroup.delete` | `resourceGroup.move` | `resourceGroup.share` | `resourceGroup.useInSearch` |

表のセル名は検証可能な論理 operation key であり、現行または将来の permission 文字列を確定するものではない。実際の permission 名と version は `FR-079` の canonical catalog で対応付ける。

`create` は新規資源がまだ存在しないため destination container または tenant create scope、`move` は source と destination、`share` は対象資源の共有 policy、`search/use` は検索対象資源の current read permission をそれぞれ独立した資源条件として評価する。

## 規範的な最低 allow 条件

強制 deny がなく、完全一致する feature permission が成立することに加え、enabled セルは次の最低資源条件と参照先 guard をすべて満たす場合に allow しなければならない。`explicit deny` は未実装の同義語ではなく、製品として非対応のセルである。

| Operation | document | folder | resource group |
| --- | --- | --- | --- |
| create | destination folder `full` または承認済み tenant root rule。`FR-068` の admission を通す | parent folder `full` または承認済み tenant root rule。同一 tenant・非循環 path | canonical group-create scope。同一 tenant、immutable ID、role namespace 分離 |
| read | document `readOnly` 以上。reader response は `FR-064` / `FR-091` | folder `readOnly` 以上。reader response は `FR-064` / `FR-091` | canonical group-read scope。同一 tenant、response allowlist |
| update | document `full`。server-managed security/quality field は別 guard | folder `full`、expected version 一致 | group manager `full`、expected version 一致 |
| delete | source folder `full`、`FR-066` の deny-first lifecycle | folder `full`、descendant impact の確定、`FR-066` | group manager `full`、dangling grant を先に無効化 |
| move | source folder `full` と destination folder `full`、同一 tenant、`FR-065` / `FR-087` | source folder `full` と destination folder `full`、非循環 subtree、`FR-087` | `explicit deny`。group hierarchy を要求として導入するまで非対応 |
| share | document `full`、active same-tenant principal、`FR-062` / `FR-077` / `FR-085` | folder `full`、active same-tenant principal、`FR-062` / `FR-077` / `FR-085` | `explicit deny`。group member 変更は `FR-081`、group を share principal として使う操作は対象 document/folder の `share` で評価 |
| search/use | document `readOnly` 以上かつ `FR-069` / `FR-070` の current eligible record | folder `readOnly` 以上かつ各 document の current permission を再評価 | active same-tenant membership と対象 document/folder の `readOnly` 以上。group 単独では本文 access を与えない |

## 根拠と意図

`read`、`update`、`delete`、`move`、`share` を CRUD や管理権限へ暗黙に束ねると、read-only 権限による更新や、ある資源種別の管理権限による別資源の操作が許可され得る。完全一致する行列セルと default deny により、操作境界をレビュー・テスト可能にする。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-076` |
| 説明 | protected resource の資源種別と操作を完全一致で評価する認可 decision |
| 根拠 | 操作の取り違え、権限の過剰包含、未定義操作の暗黙許可を防ぐ |
| 源泉 | `tasks/done/20260711-1148-redefine-rag-requirements.md`、`docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` の横断不変条件と gap 表、current authorization/routes |
| Actor / trigger | authenticated actor が document、folder、resource group の create/read/update/delete/move/share/search-use を要求するとき |
| 種類 | 機能要求 / authorization policy |
| 依存関係 | `FR-056`, `FR-057`, `FR-059`, authoritative permission catalog |
| 衝突 | 現行 role catalog と route metadata は操作名・資源条件の粒度が不均一で、resource group と application role の namespace も一部重なる |
| 受け入れ基準 | `AC-FR076-001`, `AC-FR076-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / Identity Platform / Document Platform |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR076-001 enabled セルの許可と完全一致

- Given: actor に `document.read` の完全一致 feature permission と対象 document の `readOnly` があり、強制 deny はなく、`document.update` permission はない
- When: actor が同じ document の read と update をそれぞれ要求する
- Then: システムは `document.read` を許可し、`document.update` は拒否して read の許可を代用せず、同じ規則で全 enabled セルの allow/deny contract test を満たす

### AC-FR076-002 未定義セルの default deny

- Given: versioned authorization policy から enabled セルが欠落しているか、`resourceGroup.move` / `resourceGroup.share` のように `explicit deny` と定義されている
- When: actor が resource group の移動を要求する
- Then: システムは資源状態を変更する前に要求を拒否し、別セルまたは広域 role から許可を推定しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 原子性 | OK | exact resource type と operation による認可 decision だけを規定する |
| 必要性 | OK | 操作間・資源間の confused deputy と権限過剰包含を防ぐために必要 |
| 十分性 | OK | 3 資源種別と 7 操作の必須キー、enabled セルの最低 allow 条件、unsupported/default deny、create/move/share/search-use scope を含む |
| 理解容易性 | OK | 資源種別と操作キーを 3×7 行列で一意に示し、supported/unsupported を区別した |
| 一貫性 | OK | `FR-056`–`FR-060` の認証・feature・resource 境界を操作単位へ具体化する |
| 標準・契約適合 | OK | least privilege、complete mediation、fail closed と repository の atomic requirement 方針に適合する |
| 実現可能性 | OK | route operation key と中央 authorization service の versioned decision table で実現可能 |
| 検証可能性 | OK | 21 セルの enabled allow/deny、unsupported、別セル代用禁止、missing-cell deny を contract test で検証できる |
| ニーズ適合 | OK | read-only 利用と危険な管理操作を明確に分離する利用者・管理者ニーズに対応する |

## トレース

- 後方: `FR-057`, `FR-059`, `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md`、`apps/api/src/authorization.ts`、`apps/api/src/routes/document-routes.ts`。
- 前方: resource-operation authorization contract matrix、`FR-077`, `FR-081`, `FR-085`, `FR-086`。
