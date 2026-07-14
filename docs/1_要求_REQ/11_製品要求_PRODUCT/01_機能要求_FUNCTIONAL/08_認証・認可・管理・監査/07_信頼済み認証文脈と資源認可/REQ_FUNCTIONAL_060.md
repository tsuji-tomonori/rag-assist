# FR-060 テナント分離

- 要件ID: `FR-060`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-060`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `3. RAG検索品質制御`

## 要件

- FR-060: システムは、認証済み actor の authoritative tenant を、資源、検索、会話、記憶、cache、trace、一時ファイル、非同期処理の強制 partition として適用すること。

## 根拠と意図

tenant は関連度 filter ではなく候補集合と保存先の境界である。単一 tenant 配備でも server configuration で固定し、caller 指定値へ委ねない。cross-tenant は承認済み例外がない限り拒否する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-060` |
| 説明 | 全データ面・実行面の tenant partition |
| 根拠 | 越境共有、検索、cache/session 混入を防ぐ |
| 源泉 | RAG ガイド §8.1.2, §8.1.5（PDF pp.187–188） |
| Actor / trigger | resource CRUD、share、search、worker、cache/trace write |
| 種類 | 機能要求 / security |
| 依存関係 | `FR-056`, tenant directory, tenant-scoped stores |
| 衝突 | 現行 store API は tenant 引数を持たず、`default` を補完する |
| 受け入れ基準 | `AC-FR060-001`, `AC-FR060-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | Product / Security / Platform |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR060-001 強制 partition

- Given: tenant A の actor と tenant B の同名または同 ID 候補資源がある
- When: list/get/update/delete/share/search/cache/trace/worker 処理を実行する
- Then: tenant A の server-derived partition だけを query/write し、tenant B の存在も返さない

### AC-FR060-002 caller による拡張拒否

- Given: request の tenant filter、metadata、scope が actor tenant と異なる
- When: API または検索を実行する
- Then: request 値を強制条件に採用せず、拒否または server 値で固定する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 同名・同 ID 資源、cache、session、worker を介した tenant 越境を防ぐために必要 |
| 十分性 | OK | CRUD、検索、会話、memory、cache、trace、一時資源、非同期処理の partition を扱う |
| 理解容易性 | OK | actor tenant の源泉と、全 data/execution surface へ適用する境界を明示した |
| 一貫性 | OK | tenant source は `FR-056`、隔離 benchmark subject は `FR-084` に委譲し、client 値非信頼を共通化した |
| 標準・契約適合 | OK | RAG ガイドの tenant/session/cache 分離と hard boundary 原則に適合する |
| 実現可能性 | OK | tenant-scoped key/query/artifact と server-derived context への段階 migration で実現できる |
| 検証可能性 | OK | 2 tenant×同 ID×全 store/search/cache/worker の否定試験で確認できる |
| ニーズ適合 | OK | 利用者が所属 tenant の資源だけを参照・更新できる |
| 原子性 | OK | tenant partition という一つの境界を規定する |
| 実装適合 | OK（confirmed） | document/RAG artifact/run/event/group/policy/membership の local+Dynamo tenant composite key/index と same-ID 並存、caller tenant 非拡張を two-tenant store/lifecycle/route tests で検証済み |
| 合意 | pending | single/multi tenant と cross-tenant 例外方針が未確定 |

## トレース

- 後方: `TC-003`, `ARC_ADR_005`, RAG ガイド PDF pp.187–189。
- 前方: `FR-061`–`FR-075`, `SQ-005`, tenant migration design。
