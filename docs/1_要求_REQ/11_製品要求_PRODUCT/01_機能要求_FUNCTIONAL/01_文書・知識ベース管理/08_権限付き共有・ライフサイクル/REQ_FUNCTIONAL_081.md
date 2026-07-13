# FR-081 resource group membership integrity

- 要件ID: `FR-081`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-081`
- 関連カテゴリ: `8. 認証・認可・管理・監査`

## 要件

- FR-081: resource group membership を変更するとき、システムは actor に専用の membership mutate permission と対象 group の manager/full 実効権限があり、提案後 state に残る membership が存在する active な同一 tenant の user/group principal だけを参照し、nested group graph に cycle を生じない場合に限り、その変更を確定すること。

## 境界

本要件は membership の追加、権限変更、削除によって得られる提案後状態の integrity を規定する。削除対象 edge は提案後 state に残らないため、存在しない、inactive、別 tenant になった principal への stale edge を、正当な actor が cleanup 目的で削除することは妨げない。resource group 自体の一般的な create/read/update/delete/move/share 認可は `FR-076` に従う。

## 根拠と意図

存在しない、inactive、別 tenant の principal や循環した nested membership を保存すると、権限の誤付与、評価不能、tenant 間漏えいにつながる。membership 更新権限と graph integrity を mutation boundary で検証し、読み取り時の cycle guard だけに依存しない。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-081` |
| 説明 | membership feature permission、target-group authority、principal/tenant/cycle proposed-state integrity gate |
| 根拠 | dangling/cross-tenant membership、nested cycle、無権限の membership 変更を永続化しない |
| 源泉 | `ARC_ADR_004`、`docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` の横断不変条件と `GAP-RD-003`, `GAP-RD-022`、current GroupMembership model/store |
| Actor / trigger | authorized group administrator が membership の add/update/delete を要求するとき |
| 種類 | 機能要求 / authorization / data integrity |
| 依存関係 | `FR-056`, `FR-060`, `FR-076`, authoritative principal directory, resource group graph |
| 衝突 | 現行 `GroupMembership` の `tenantId` は optional で、store は principal existence、active state、tenant、cycle、actor permission を mutation 時に検証しない |
| 受け入れ基準 | `AC-FR081-001`, `AC-FR081-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Identity Platform / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR081-001 valid proposed-state mutation

- Given: actor に membership mutate permission と対象 group の manager/full があり、提案後 state に残る target group と member principal は同じ tenant に存在して active で、提案後 graph は acyclic である
- When: actor が valid member の追加・権限変更、または stale/dangling edge の削除を要求する
- Then: システムは提案後 state を一度だけ確定し、追加・更新された membership を後続の実効権限計算で利用可能にし、削除された edge は参照しない

### AC-FR081-002 integrity violation

- Given: actor の membership mutate permission または対象 group manager/full の欠如、または削除対象を除いて提案後 state に残る membership に principal 不在・inactive・tenant 不一致・nested group cycle のいずれかがある
- When: membership の追加、権限変更、または削除を要求する
- Then: システムは変更全体を拒否し、membership state を変更しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 原子性 | OK | membership proposed state の integrity admission だけを規定する |
| 必要性 | OK | membership が実効権限へ直結するため、保存前の tenant・principal・cycle 検証が必要 |
| 十分性 | OK | actor feature、target-group authority、残存 edge の active existence/same tenant、nested cycle、stale edge cleanup、all-or-nothing rejection を含む |
| 理解容易性 | OK | 検証対象を提案後 membership state と明記し、resource group CRUD と分離した |
| 一貫性 | OK | `FR-061` の membership 解決と `FR-076` の操作別認可を弱めず、mutation 境界を追加する |
| 標準・契約適合 | OK | tenant isolation、referential integrity、least privilege、fail closed に適合する |
| 実現可能性 | OK | directory lookup、tenant comparison、graph cycle detection、conditional write で実現可能 |
| 検証可能性 | OK | user/group、active/inactive、same/cross tenant、acyclic/cycle、permission 有無の組合せで検証できる |
| ニーズ適合 | OK | 管理者が安全に group membership を委任し、利用者の実効権限を予測可能にする |

## トレース

- 後方: `FR-061`, `FR-060`, `ARC_ADR_004`, `apps/api/src/types.ts`, `apps/api/src/adapters/group-membership-store.ts`。
- 前方: membership mutation API/service tests、nested group graph tests、`FR-085`, `FR-086`。
