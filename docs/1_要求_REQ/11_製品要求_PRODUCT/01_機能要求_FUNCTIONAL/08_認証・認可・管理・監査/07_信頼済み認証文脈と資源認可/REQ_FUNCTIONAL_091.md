# FR-091 権限外資源の存在最小化

- 要件ID: `FR-091`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-091`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `3. RAG検索品質制御`

## 要件

- FR-091: システムは、対象資源の必要実効権限を持たない actor への API、Web、worker、search response を、権限外資源の識別子、本文、題名、属性、件数、principal、policy、lifecycle、詳細な拒否理由を推測できない versioned 最小 response contract に制限すること。

## 根拠と意図

操作を拒否しても、404/403 の使い分け、件数、page token、題名、policy detail、処理時間から資源の存在や共有状態を列挙できれば、認可境界は情報開示境界にならない。許可判定は `FR-057`、operator trace の最小化は `FR-088` に分離し、本要件は caller-visible response だけを規定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-091` |
| 説明 | unauthorized caller に対する resource non-enumeration と最小 response contract |
| 根拠 | deny response、list/search count、error detail を使った資源存在・共有状態の推測を防ぐ |
| 源泉 | RAG ガイド §8.1.3–8.1.4（PDF pp.187–189）、current API/list/search schemas、`GAP-RD-008` |
| Actor / trigger | 権限外 actor が get/list/search/download/share/move/delete/debug または worker result を要求するとき |
| 種類 | 機能要求 / security / response minimization |
| 依存関係 | `FR-057`, `FR-060`, `FR-064`, `FR-070`, `FR-088`, `FR-090` |
| 衝突 | 現行 reader schema は principal と arbitrary metadata を含み、API ごとの 403/404/count contract が統一されていない |
| 受け入れ基準 | `AC-FR091-001`, `AC-FR091-002`, `AC-FR091-003` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / API / Web |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR091-001 単一資源の非列挙 response

- Given: 同じ immutable ID の資源が「存在しない」場合と「存在するが actor に必要実効権限がない」場合がある
- When: actor が get、download、share、move、delete のいずれかを要求する
- Then: public response は承認済み non-enumeration profile の status/body/header/size/timing class に収まり、資源の題名、tenant、owner、principal、policy、lifecycle、内部 deny reason を返さず、両者を資源 detail から区別させない

### AC-FR091-002 集合・検索 response の最小化

- Given: query scope に authorized resource と unauthorized resource が混在する
- When: actor が list または search を実行する
- Then: response item、count、pagination token、facet、citation は authorized resource だけから構成し、除外した資源の識別子・属性・総数を caller へ返さず、operator 用 deny count/reason は `FR-088` の権限と redaction を通す

### AC-FR091-003 Web・debug・非同期 result の current 最小化

- Given: Web capability/error、debug view、または queued worker result の生成前に actor の account、role、tenant、resource permission が失効する
- When: Web が表示を構成するか、API/worker が debug または非同期 result を返す
- Then: `FR-090` の current authorization で再評価し、権限外資源の題名・識別子・本文・件数・policy・deny detail を capability、error、progress、artifact、debug payload に含めず、一般 caller には最小状態、権限を持つ operator には `FR-088` で redaction した情報だけを返す

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | state mutation の拒否だけでは防げない resource enumeration を防ぐために必要 |
| 十分性 | OK | 単一 get/mutation、list/search、Web capability/error、debug、queued worker result の detail、count、pagination、timing class を扱う |
| 理解容易性 | OK | authorization decision と operator trace から caller-visible response を分離した |
| 一貫性 | OK | `FR-057` の deny 後に適用し、reader summary は `FR-064`、trace は `FR-088` に従う |
| 標準・契約適合 | OK | least disclosure、tenant isolation、non-enumeration に適合する |
| 実現可能性 | OK | response allowlist、generalized error、authorized-only pagination、timing budget で実現可能 |
| 検証可能性 | OK | existing/absent unauthorized pair、mixed list/search、schema/timing class test で確認できる |
| ニーズ適合 | OK | 利用者が権限外の資料・共有相手・件数を推測できない |
| 原子性 | OK | 権限外 caller に返す response の最小化だけを規定する |
| 実装適合 | OK（confirmed） | `public-resource-response.ts` と reader/list/worker/debug schema が absent/unauthorized を非列挙化し、authorized-only count/cursor と最小 payload を contract/Web tests が検証する |
| 合意 | pending | API class ごとの status と non-enumeration timing/size profile を承認する必要がある |

## トレース

- 後方: RAG ガイド PDF pp.187–189、`GAP-RD-008`、`FR-057` 旧 AC の存在秘匿観点。
- 前方: public response schema contract、unauthorized existing/absent differential test、mixed list/search pagination test。
