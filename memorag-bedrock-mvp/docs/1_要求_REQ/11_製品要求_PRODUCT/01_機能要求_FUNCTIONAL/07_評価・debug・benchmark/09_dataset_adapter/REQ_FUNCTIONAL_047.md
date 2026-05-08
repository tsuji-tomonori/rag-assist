# 要件定義（1要件1ファイル）

- 要件ID: `FR-047`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `7. 評価・debug・benchmark`
- L2主機能群: `7.9 dataset adapter`
- L3要件: `FR-047`
- 関連カテゴリ: なし

## 要件

- FR-047: benchmark dataset adapter は、dataset ごとの入力を共通評価形式へ正規化できること。

## 受け入れ条件（この要件専用）

- AC-FR047-001: adapter は corpus、expected answer、source context、skip reason を共通 schema へ変換できること。
- AC-FR047-002: adapter は dataset row ごとの評価可否を runner が判別できる形で返すこと。
- AC-FR047-003: adapter は dataset 固有値や期待語句の分岐を product RAG 実装へ持ち込まないこと。
- AC-FR047-004: adapter 出力から生成される metrics と report artifact は、dataset 間で比較可能な項目名を持つこと。

## 要件の源泉・背景

- 源泉: `docs/spec-recovery/06_requirements.md` の `REQ-BENCH-002`
- 源泉: `docs/spec-recovery/03_acceptance_criteria.md` の `AC-BENCH-002`
- 源泉: `docs/spec-recovery/07_specifications.md` の `SPEC-BENCH-002`
- 背景: Allganize、MMRAG DocQA、NeoAI などの dataset を同じ benchmark runner で扱う必要がある。

## 要件の目的・意図

- 目的: dataset ごとの形式差を adapter に閉じ込め、評価指標と artifact を横断比較できるようにする。
- 意図: dataset 固有分岐が product RAG path に混入することを防ぐ。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-047` |
| 説明 | benchmark dataset adapter の共通形式正規化 |
| 根拠 | dataset ごとの構造差を product 実装へ持ち込むと評価が再現不能になる |
| 源泉 | `REQ-BENCH-002`, `AC-BENCH-002`, `SPEC-BENCH-002` |
| 種類 | 機能要求 |
| 依存関係 | `FR-012`, `FR-019`, `FR-039`, `FR-040`, `SQ-001` |
| 衝突 | dataset 固有の評価情報は adapter 保守の対象になる |
| 受け入れ基準 | `AC-FR047-001` から `AC-FR047-004` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/05_benchmark指標/REQ_FUNCTIONAL_019.md`
- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/06_benchmark_corpus_seed/REQ_FUNCTIONAL_039.md`
