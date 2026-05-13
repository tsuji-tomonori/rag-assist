# 要件定義（1要件1ファイル）

- 要件ID: `SQ-003`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft
- 優先度: A

## 要件

- SQ-003: 回答可能性判定は、dataset 固有の期待語句や QA sample 固有値に依存しない汎用 policy として評価できること。

## 受け入れ条件（この要件専用）

- AC-SQ003-001: answerability gate は、根拠、数値、言い換え、否定極性を判定材料として扱えること。
- AC-SQ003-002: support verifier は、dataset row id、expectedContains 固有語句、QA sample 固有値への分岐なしに不支持回答を拒否できること。
- AC-SQ003-003: threshold、clause polarity、abbreviation、value mismatch の判断理由は trace または evaluation artifact で確認できること。
- AC-SQ003-004: 不十分または不支持の回答は、回答不能または確認質問へ流れること。

## 要件の源泉・背景
- 背景: 既存要件整理では、回答可能性判定を dataset 固有 hardcode ではなく汎用 policy として扱うことが明記されている。

## 要件の目的・意図

- 目的: benchmark だけに最適化された判定ではなく、実運用の RAG 回答にも適用できる品質制約にする。
- 意図: product 実装に dataset 固有分岐が入ることを防ぎ、評価と通常回答の乖離を避ける。
- 区分: サービス品質制約。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `SQ-003` |
| 説明 | dataset 固有 hardcode に依存しない回答可能性 policy |
| 根拠 | 固有値分岐は benchmark スコアを上げても実運用品質を保証しない |
| 種類 | サービス品質制約 |
| 依存関係 | `FR-014`, `FR-015`, `FR-044`, `SQ-001` |
| 衝突 | 汎用判定は短期的な dataset 個別改善より設計・評価コストが高い |
| 受け入れ基準 | `AC-SQ003-001` から `AC-SQ003-004` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/04_回答検証・ガードレール/01_回答前ガード/REQ_FUNCTIONAL_014.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/04_回答検証・ガードレール/02_回答後検証/REQ_FUNCTIONAL_015.md`
- `docs/2_アーキテクチャ_ARC/31_品質属性_QA/ARC_QA_001.md`
