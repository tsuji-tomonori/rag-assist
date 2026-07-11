# SQ-005 権限外 evidence 露出 0 件

- 要件ID: `SQ-005`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft
- 優先度: S

## 要件

- SQ-005: RAG の公開候補は、権限外の document、chunk、memory、citation、本文が candidate、prompt、answer、cache、trace に現れる件数を 0 件にすること。

## 品質尺度

- 尺度: must-not-access case で確認された unauthorized evidence exposure count。
- 測定単位: candidate ID、本文 span、citation locator、cache entry、trace field。
- fail point: 1 件。
- 最低値・目標値: 0 件。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-005` |
| 説明 | unauthorized evidence exposure の zero-tolerance gate |
| 根拠 | 権限漏えいは平均品質で相殺できない |
| 源泉 | RAG ガイド §3.8.7（PDF p.95）、§7.3.6（PDF p.168）、§8.1.8（PDF p.189） |
| Actor / trigger | RAG change の security evaluation と release |
| 種類 | サービス品質制約 / security |
| 依存関係 | `FR-056`–`FR-071`, `FR-075` |
| 衝突 | semantic/memory retrieval は現在 post-filter を含む |
| 受け入れ基準 | `AC-SQ005-001`, `AC-SQ005-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / QA |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ005-001 zero leak

- Given: 別 tenant/group/user、suspended、revoked、expired、NULL ACL、old index、cache の must-not-access corpus がある
- When: lexical/vector/memory/context expansion/citation を通常 API と worker で評価する
- Then: unauthorized exposure count が全観測点で 0 である

### AC-SQ005-002 独立 gate

- Given: relevance/faithfulness の平均が合格している
- When: unauthorized exposure が 1 件以上ある
- Then: 総合平均で相殺せず release gate を失敗にする

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 一件の権限外 evidence 露出も平均品質で相殺しない release boundary に必要 |
| 十分性 | OK | document/chunk/memory/citation/body と candidate/prompt/answer/cache/trace の観測点を扱う |
| 理解容易性 | OK | 測定対象、単位、fail point、target を 0 件として明示した |
| 一貫性 | OK | evidence 前認可 `FR-070` と promotion gate `FR-075` の定量的な安全条件になる |
| 標準・契約適合 | OK | RAG ガイドの unauthorized retrieval 0 と security gate 非相殺原則に適合する |
| 実現可能性 | OK | must-not-access corpus と候補・prompt・cache・trace instrumentation で測定できる |
| 検証可能性 | OK | multi-user/multi-tenant/revoked/NULL ACL/old index/cache negative corpus で確認できる |
| ニーズ適合 | OK | 利用者と文書所有者の共有範囲外情報を RAG の全観測点で保護する |
| 定量性 | OK | fail point と target が 0 件 |
| 実装適合 | 未検証 | 現行 test は全観測点と race を網羅しない |
| 合意 | pending | over-denial は別尺度で閾値を決める |

## トレース

- 後方: RAG ガイド PDF pp.95,168,189。
- 前方: security benchmark、runtime negative matrix、`FR-075`。
