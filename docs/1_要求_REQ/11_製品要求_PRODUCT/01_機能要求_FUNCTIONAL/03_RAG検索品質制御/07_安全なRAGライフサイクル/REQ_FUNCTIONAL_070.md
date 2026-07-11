# FR-070 全検索経路の evidence 前認可

- 要件ID: `FR-070`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-070`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `8. 認証・認可・管理・監査`

## 要件

- FR-070: システムは、lexical、semantic、memory、multi-query、context expansion、cache、citation の全経路で、権限外本文を evidence 候補、LLM prompt、trace へ渡す前または検索 engine 内で除外すること。

## 根拠と意図

有限 top-K を権限外 hit が占有した後の post-filter は、直接返却を防いでも underfill と side channel を生む。現在の authorization、classification、usage constraint、quality/admission、lifecycle を各追加 chunk と利用目的でも再確認する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-070` |
| 説明 | 全 retrieval path の authorization hard filter |
| 根拠 | 権限外本文の取得・prompt/cache/trace 到達を防ぐ |
| 源泉 | RAG ガイド §3.5.9（PDF p.81）、§4.5.2（PDF p.119）、§8.1.4（PDF pp.187–188） |
| Actor / trigger | question/search/answer/citation/context expansion |
| 種類 | 機能要求 / retrieval / security |
| 依存関係 | `FR-057`, `FR-059`–`FR-069` |
| 衝突 | semantic/memory は有限 query 後に resource post-filter する |
| 受け入れ基準 | `AC-FR070-001`, `AC-FR070-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | RAG Platform / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR070-001 query 前 hard filter

- Given: authorized と unauthorized の高類似度 chunk が同じ index にある
- When: lexical、vector、memory、multi-query を実行する
- Then: tenant/ACL/classification/usage-purpose/quality-admission/lifecycle/expiry を engine partition/filter で強制し、現在の利用目的で eligible な authorized top-K を権限外・利用不可 hit で underfill させない

### AC-FR070-002 再認可

- Given: initial retrieval 後に grant、classification、external-model/log/eval usage、quality approval、lifecycle/expiry のいずれかが変更され、当該利用目的で document が不適格になる
- When: context expansion、rerank、prompt build、citation fetch、cache reuse を行う
- Then: 各 resource を現在の authorization/classification/usage/quality/lifecycle policy で再確認し、不適格な本文を追加・保持・prompt/cache/trace/evaluation に記録しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 権限外 hit が有限 top-K、prompt、cache、trace へ到達することと authorized underfill を防ぐために必要 |
| 十分性 | OK | lexical、vector、memory、multi-query、expansion、rerank、prompt、citation、cache の authorization/classification/usage/quality/lifecycle prefilter/recheck を扱う |
| 理解容易性 | OK | authorization を置く時点、再確認する時点、禁止する本文到達先を明示した |
| 一貫性 | OK | verified context `FR-056`、current deny `FR-066`、操作行列 `FR-076`、isolated benchmark `FR-084` と整合する |
| 標準・契約適合 | OK | RAG ガイドの hard filter、権限外本文を LLM/cache/trace 前に除外する原則に適合する |
| 実現可能性 | OK | backend partition/filter、authorized candidate set、bounded refill、per-resource recheck で実現できる |
| 検証可能性 | OK | must-not-access、unauthorized top hit、underfill、revoke race、cache/citation test で確認できる |
| ニーズ適合 | OK | 利用者が権限外情報を漏らさず、許可された根拠を十分に検索できる |
| 原子性 | OK | retrieval の authorization placement を規定する |
| 実装適合 | partial/NG | lexical は prefilter、semantic/memory/context expansion は未達 |
| 合意 | pending | vector backend の partition/filter 実装方式は設計判断 |

## トレース

- 後方: `hybrid-retriever.ts:161-203,743-768`, memory/context expansion audit。
- 前方: vector store contract、bounded refill、`SQ-005`, `SQ-006`。
