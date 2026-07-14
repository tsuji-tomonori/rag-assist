# FR-061 フォルダー実効権限と継承

- 要件ID: `FR-061`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-061`
- 関連カテゴリ: `8. 認証・認可・管理・監査`

## 要件

- FR-061: システムは、各フォルダーについて `none / readOnly / full` の実効権限を、active な同一 tenant principal、最も近い明示 policy、親継承、group membership から決定的に算出すること。

## 根拠と意図

フォルダーは共有と検索 scope の資源境界である。同じ policy を list、document、RAG、memory が一貫して使い、archived、未知 principal、policy cycle は fail closed にする。identity/account/tenant/lifecycle/resource-integrity の mandatory deny と、通常 policy から独立した administrative principal は `FR-057` / `FR-077` の優先順位に従う。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-061` |
| 説明 | folder policy と membership からの実効権限算出 |
| 根拠 | 経路別 ACL drift と親子継承の曖昧さを除く |
| 源泉 | `ARC_ADR_004`, RAG ガイド §3.5.7–3.5.8（PDF p.80） |
| Actor / trigger | folder/document を list/read/manage/search するとき |
| 種類 | 機能要求 / authorization |
| 依存関係 | `FR-057`, `FR-059`, `FR-060`, `FR-077`, FolderPolicy, GroupMembership |
| 衝突 | legacy helper と `FolderPermissionService` が併存する |
| 受け入れ基準 | `AC-FR061-001`, `AC-FR061-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Document platform / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR061-001 継承と上書き

- Given: 親に明示 policy があり、子に明示 policy がない
- When: 子の実効権限を評価する
- Then: 最も近い親 policy を継承し、子に明示 policy がある場合は差分でなく完全設定として親を置換する

### AC-FR061-002 fail closed と管理主体の優先順位

- Given: folder に mandatory deny となる lifecycle/tenant/integrity 不成立があるか、非管理主体の principal/membership/policy が不明・循環・読取失敗である
- When: 実効権限を評価する
- Then: mandatory deny は全 principal、通常 policy/membership の不成立は非管理主体を `none` として上位権限へ補完せず、mandatory deny のない active same-tenant adminPrincipal だけは `FR-077` の `full` とする

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 共有・検索の全経路で同じ folder decision が必要 |
| 十分性 | OK | principal、tenant、継承、mandatory/ordinary failure、administrative-principal invariant を含む |
| 理解容易性 | OK | 入力と `none/readOnly/full` の出力を限定した |
| 一貫性 | pending | explicit deny と複数経路の優先規則は `OQ-RD-002` |
| 標準・契約適合 | OK | 1 要求 1 decision と専用 AC を満たす |
| 実現可能性 | OK | 既存 service を単一化して実現可能 |
| 検証可能性 | OK | parent/child、explicit/inherited、nested membership matrix |
| ニーズ適合 | OK | 権限外 folder の利用と経路差を防ぐ |
| 実装適合 | OK（confirmed） | `folder-permission-service.ts` が nearest explicit/child override/cycle/mandatory deny/admin invariant を単一 decision で評価し、folder permission tests が legacy boundary も含め検証する |

## トレース

- 後方: `ARC_ADR_004:18-26`, 2026-05-17/19 folder reports。
- 前方: `FR-062`–`FR-066`, `FR-070`, folder contract tests。
