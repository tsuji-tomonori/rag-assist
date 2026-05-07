# 要件定義（1要件1ファイル）

- 要件ID: `FR-033`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `7. 評価・debug・benchmark`
- L2主機能群: `7.7 benchmark corpus 隔離`
- L3要件: `FR-033`
- 関連カテゴリ:
  - `3. RAG検索品質制御`
  - `8. 認証・認可・管理・監査`

## 要件

- FR-033: benchmark runner は、評価用 corpus と通常利用者の文書を混在させず、評価 query または search の検索前に benchmark corpus scope を強制できること。

## 受け入れ条件（この要件専用）

- AC-FR033-001: runner が seed する文書は、通常利用者の文書一覧と通常 RAG 検索から隔離されること。
- AC-FR033-002: runner が評価用 API を呼ぶとき、検索前 filter は benchmark corpus を識別する scope 条件を含むこと。
- AC-FR033-003: runner は同じ corpus を共有する suite でも、corpus identity を固定して評価できること。
- AC-FR033-004: raw retrieval と最終回答根拠は、評価 report で区別して解釈できること。
- AC-FR033-005: benchmark の no-access leak 指標は、citation、最終回答根拠、raw retrieval の混入を検出できること。
- AC-FR033-006: benchmark corpus scope の強制は、通常利用者向け検索 API の権限境界を広げないこと。

## 要件の源泉・背景

- 源泉: `reports/working/20260507-2027-retrieval-scope-final-evidence.md`
- 源泉: `reports/working/20260507-2105-rag-baseline-evaluation-set.md`
- 背景: benchmark corpus と一般文書が混在すると、評価結果が tenant / ACL / 既存文書の状態に依存する。
- 背景: raw retrieval と最終根拠を分けないと、検索 miss と回答生成前の根拠選択 miss を切り分けられない。

## 要件の目的・意図

- 目的: benchmark が常に意図した corpus に対して評価されるようにする。
- 意図: RAG 品質評価で、検索精度、最終根拠、権限外漏えいを別々に診断できるようにする。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-033` |
| 説明 | benchmark corpus scope の強制、通常文書との隔離、raw/final evidence 分離 |
| 根拠 | benchmark 結果の再現性と認可境界を維持するため |
| 源泉 | `reports/working/20260507-2027-retrieval-scope-final-evidence.md`, `reports/working/20260507-2105-rag-baseline-evaluation-set.md` |
| 種類 | 機能要求 |
| 依存関係 | `FR-012`, `FR-019`, `FR-026`, `NFR-012`, `SQ-001` |
| 衝突 | 隔離 corpus の seed / cleanup に時間がかかる |
| 受け入れ基準 | `AC-FR033-001` から `AC-FR033-006` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-07 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | benchmark の再現性と情報漏えい防止に必要 |
| 十分性 | OK | scope、corpus identity、raw/final evidence、no-access leak を含む |
| 理解容易性 | OK | 評価対象と通常文書の境界が明確 |
| 一貫性 | OK | `NFR-012` と `SQ-001` の漏えい防止・品質測定に合う |
| 標準・契約適合 | OK | 1 要件 1 ファイルと要件内受け入れ条件を満たす |
| 実現可能性 | OK | runner、search filter、report 指標で実現可能 |
| 検証可能性 | OK | benchmark runner test と API contract test へ落とせる |
| ニーズ適合 | OK | dataset 固有状態に左右されない評価を可能にする |

## 関連文書

- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md`
- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/05_benchmark指標/REQ_FUNCTIONAL_019.md`
