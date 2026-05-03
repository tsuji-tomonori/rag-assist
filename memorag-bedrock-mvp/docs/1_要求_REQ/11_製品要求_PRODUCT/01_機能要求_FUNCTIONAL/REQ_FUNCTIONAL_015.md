# 要件定義（1要件1ファイル）

- 要件ID: `FR-015`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `4. 回答検証・ガードレール`
- L2機能群:
  - `4.3 回答後検証`
  - `4.4 strict grounded 制御`
- L3要件: `FR-015`
- 関連カテゴリ: なし

## 要件

- FR-015: 回答生成後に、システムは回答文の各主要文が引用対象チャンクで支持されているかを検証すること。

## 受け入れ条件（この要件専用）

- AC-FR015-001: 検証結果に `supported`、`unsupportedSentences`、`supportingChunkIds`、`reason` が含まれること。
- AC-FR015-002: `strictGrounded` が有効で、支持されない主要文がある場合は回答を拒否または再生成へ送れること。
- AC-FR015-003: 引用IDが存在するだけでは支持済みとみなさないこと。
- AC-FR015-004: 検証結果は debug trace または state から確認できること。

## 要件の源泉・背景

- 源泉: ユーザー提示の Self-RAG verifier 方針、現行 `validate-citations.ts` の実装確認。
- 背景: 現行 citation validation は引用IDの存在を検証するが、回答文が引用内容を超えていないかまでは判定していない。

## 要件の目的・意図

- 目的: 引用付きでも根拠を超えた回答が出る事故を減らす。
- 意図: Self-RAG 的な post-answer verifier を学習なしで導入する。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-015` |
| 説明 | 回答文と引用チャンクの支持関係を検証する |
| 根拠 | 引用IDだけでは grounded answer を保証できない |
| 源泉 | ユーザー提示方針、現行コード調査 |
| 種類 | 機能要求 |
| 依存関係 | `generate_answer`、`validate_citations`、`selectedChunks` |
| 衝突 | 再生成を行う場合は遅延とコストが増える |
| 受け入れ基準 | `AC-FR015-001` から `AC-FR015-004` |
| 優先度 | S |
| 安定性 | Medium |
| 変更履歴 | 2026-05-01 初版 / 2026-05-02 `verify_answer_support` 実装 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 根拠性の品質保証に必要 |
| 十分性 | OK | 支持有無と拒否条件を含む |
| 理解容易性 | OK | sentence 単位の検証で明確 |
| 一貫性 | OK | `strictGrounded` の意味と整合 |
| 標準・契約適合 | OK | 資料根拠方針に合う |
| 実現可能性 | OK | 既存 graph へ node 追加で可能 |
| 検証可能性 | OK | unsupported sentence で確認可能 |
| ニーズ適合 | OK | 誤回答抑止に直結 |
