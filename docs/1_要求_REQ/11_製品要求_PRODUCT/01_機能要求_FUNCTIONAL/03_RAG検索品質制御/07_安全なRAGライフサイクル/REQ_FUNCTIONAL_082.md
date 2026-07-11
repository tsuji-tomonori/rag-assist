# FR-082 loss-aware extraction/normalization

- 要件ID: `FR-082`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-082`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `4. 回答検証・ガードレール`

## 要件

- FR-082: システムは、抽出・正規化結果を loss-aware record として生成し、silent truncation を禁止して、各出力 block に対応する page、section、span と warning を保持すること。

## 根拠と意図

文字数、ページ数、OCR、形式、処理 budget の境界で内容が黙って欠落すると、後続工程は不完全な文書を完全な根拠として扱う。原文位置と損失可能性を明示し、完全性を確認できない結果は complete として公開しない。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-082` |
| 説明 | source locator と warning を持つ loss-aware extraction/normalization |
| 根拠 | silent data loss と不正確な citation locator を防ぐ |
| 源泉 | RAG ガイド §3.1–3.2（PDF pp.59–66）、`docs/spec-recovery/15_rag_lifecycle_matrix_202607.md`、`GAP-RD-013` |
| Actor / trigger | parser/normalizer が取得済み文書を block へ変換するとき |
| 種類 | 機能要求 / ingest / data integrity |
| 依存関係 | `FR-068`, `FR-069` |
| 衝突 | 現行抽出経路の固定文字数 slice と unsupported input の text 扱い |
| 受け入れ基準 | `AC-FR082-001`, `AC-FR082-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | RAG Platform / Document steward |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR082-001 source mapping

- Given: 複数 page、section と変換対象の表・OCR text を含む文書がある
- When: 文書を抽出・正規化して block を生成する
- Then: 各 block は原文の page、section、span を追跡でき、変換または損失可能性がある箇所には対応する warning と理由を保持する

### AC-FR082-002 no silent truncation

- Given: 文字数、ページ数、展開サイズ、OCR または処理 budget の上限に達するか、入力の一部を解析できない
- When: 抽出・正規化を終了する
- Then: 内容を黙って切り捨てず、影響する page、section、span と理由を warning に記録し、結果を `partial` または `quarantined` として complete publication から除外する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | silent truncation による根拠欠落と誤引用を防ぐために必要 |
| 十分性 | OK | 原文位置、変換 warning、上限到達、公開状態を含む |
| 理解容易性 | OK | loss-aware record という一つの出力契約に限定した |
| 一貫性 | OK | `FR-068` の admission と `FR-069` の属性継承に先行する |
| 標準・契約適合 | OK | 1 要件 1 主判断と要件内 Given/When/Then を満たす |
| 実現可能性 | OK | parser result schema と publication gate で実現可能 |
| 検証可能性 | OK | 境界 corpus、OCR/unsupported fixture、locator/warning assertion で確認できる |
| ニーズ適合 | OK | 不完全な抽出を完全な回答根拠として利用しない |
| 実装適合 | NG/conflict | 固定文字数での切り詰めと詳細 locator/warning 不足がある |

## トレース

- 後方: `docs/spec-recovery/15_rag_lifecycle_matrix_202607.md`、`docs/spec-recovery/16_current_state_gap_analysis_202607.md` の `GAP-RD-013`。
- 前方: extraction result schema、boundary corpus、`FR-083`、`FR-069`。
