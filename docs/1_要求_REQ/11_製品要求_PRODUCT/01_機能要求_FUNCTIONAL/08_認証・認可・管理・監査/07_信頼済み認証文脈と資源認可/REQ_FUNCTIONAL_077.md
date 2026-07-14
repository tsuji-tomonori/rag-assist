# FR-077 管理主体の不可侵 full 権限

- 要件ID: `FR-077`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-077`
- 関連カテゴリ: `1. 文書・知識ベース管理`

## 要件

- FR-077: システムは、強制 deny のない active な資源に登録された active かつ同一 tenant の owner または adminPrincipal に、資源 policy から独立した `full` 実効権限を保証し、通常の allow/deny policy でその管理権限を降格または拒否できないこと。

## 根拠と意図

資源の管理主体まで通常の共有 policy で拒否できると、管理者不在の資源が生じ、共有解除、移管、削除、事故対応ができなくなる。verified identity 不成立、account 非 active、authoritative tenant 欠損・不一致、resource lifecycle 非 active、resource identity/integrity 不成立の強制 deny は `FR-057` を優先し、文書での合成は `FR-063`、管理主体が無効になる場合は `FR-078` の移管整合性で解決する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-077` |
| 説明 | owner/adminPrincipal に対する policy 非依存の `full` invariant |
| 根拠 | 資源を管理不能にする policy と self-lockout を防ぐ |
| 源泉 | `ARC_ADR_004:20-26`, 現行 `DocumentPermissionService`, ユーザー依頼の owner 境界 |
| Actor / trigger | folder/document の実効権限を算出するとき、または resource policy を保存するとき |
| 種類 | 機能要求 / authorization invariant |
| 依存関係 | `FR-056`, `FR-057`, `FR-060`, `FR-078` |
| 衝突 | 現行 folder/document 経路で owner/adminPrincipal の扱いが統一されず、explicit deny の最終規則も未承認 |
| 受け入れ基準 | `AC-FR077-001`, `AC-FR077-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Product / Security / Document Governance |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR077-001 policy 非依存の full

- Given: active な同一 tenant 資源に active な owner または adminPrincipal が登録され、通常の資源 policy に当該 principal の entry がないか deny entry が提案されている
- When: list、read、share、move、delete のために実効権限を算出する
- Then: identity、account、tenant、resource lifecycle/integrity の強制 deny がない限り、当該管理主体の実効権限を `full` とし、通常 policy の欠損・読取不能・deny を管理権限の降格に使わない

### AC-FR077-002 管理主体 deny の拒否

- Given: 通常の resource policy の変更が、active な owner または adminPrincipal を `readOnly` / `none` に降格するか explicit deny の対象にする
- When: policy 変更を保存する
- Then: 変更を拒否して既存 policy と管理主体の `full` を維持し、管理主体を変える場合は `FR-078` の移管を要求する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | orphan resource と管理不能な共有状態を防ぐために必要 |
| 十分性 | OK | 権限算出と policy mutation の双方で invariant を確認する |
| 理解容易性 | OK | 対象 principal、適用条件、強制 deny との優先関係を明示した |
| 一貫性 | OK | account/tenant/lifecycle deny は `FR-057`、principal 変更は `FR-078` に分離した |
| 標準・契約適合 | OK | 一つの管理権限 invariant と専用 AC を一ファイルに記載した |
| 実現可能性 | OK | canonical permission decision の owner/adminPrincipal rule と policy validation で実装可能 |
| 検証可能性 | OK | owner/adminPrincipal × policy entry × explicit deny の matrix test へ変換できる |
| ニーズ適合 | OK | 文書所有者・共有管理者が自資源を継続管理できる |
| 原子性 | OK | 管理主体の `full` を policy で剥奪できないという一つの invariant を規定する |
| 実装適合 | OK（confirmed） | folder/document permission services が active same-tenant administrative principal の full と mandatory deny 優先を同一 decision で強制し、invariant tests を持つ |
| 合意 | pending | owner/adminPrincipal の正規 ID と global deny の詳細を承認する必要がある |

## トレース

- 後方: `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_004.md:20-26`, `apps/api/src/documents/document-permission-service.ts`, `OQ-RD-002`, `OQ-RD-003`。
- 前方: canonical resource authorization contract、owner/adminPrincipal matrix test、`FR-078`, `FR-086`。
