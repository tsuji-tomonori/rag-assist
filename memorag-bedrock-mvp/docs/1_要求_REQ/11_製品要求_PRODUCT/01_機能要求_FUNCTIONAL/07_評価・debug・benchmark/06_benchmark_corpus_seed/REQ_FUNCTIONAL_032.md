# 要件定義（1要件1ファイル）

- 要件ID: `FR-032`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `7. 評価・debug・benchmark`
- L2主機能群: `7.6 benchmark corpus seed`
- L3要件: `FR-032`
- 関連カテゴリ:
  - `1. 文書・知識ベース管理`

## 要件

- FR-032: benchmark runner は、評価に必要な corpus 文書を評価前に取り込み、抽出不能または OCR timeout の文書を評価不能行として分類できること。

## 受け入れ条件（この要件専用）

- AC-FR032-001: runner は評価 query または search を実行する前に、必要な corpus 文書が QA 利用可能な状態であることを確認できること。
- AC-FR032-002: runner は PDF corpus を同期 request body に載せずに seed できること。
- AC-FR032-003: 抽出可能テキストがない corpus 文書は、runner fatal ではなく `skipped_unextractable` 相当として記録できること。
- AC-FR032-004: OCR timeout になった corpus 文書は、runner fatal ではなく `skipped_unextractable` 相当として記録できること。
- AC-FR032-005: 抽出不能または OCR timeout の文書を期待資料にする dataset row は、評価対象から除外されたことを summary または report で確認できること。
- AC-FR032-006: 抽出不能とは異なる worker failure、polling failure、認可失敗は runner fatal として扱えること。

## 要件の源泉・背景

- 源泉: `reports/bugs/20260507-2029-mmrag-textract-timeout.md`
- 源泉: `reports/working/20260507-2029-fix-mmrag-textract-timeout.md`
- 源泉: `reports/working/20260507-2139-benchmark-seed-async-ocr-ingest.md`
- 背景: MMRAG DocQA benchmark は PDF corpus seed 中の Textract OCR timeout により runner 全体が失敗した。
- 背景: 評価対象外にすべき文書と runner 自体の失敗を区別しないと、benchmark 結果の解釈が不安定になる。

## 要件の目的・意図

- 目的: benchmark runner が corpus 取り込み失敗を分類し、評価可能な行だけを一貫して評価できるようにする。
- 意図: OCR や PDF 抽出の環境依存失敗で benchmark 全体の診断性を失わないようにする。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-032` |
| 説明 | benchmark corpus seed の完了確認と skip/fatal 分類 |
| 根拠 | corpus seed の失敗分類がないと評価 artifact が空になり、改善判断に使えない |
| 源泉 | `reports/bugs/20260507-2029-mmrag-textract-timeout.md`, `reports/working/20260507-2139-benchmark-seed-async-ocr-ingest.md` |
| 種類 | 機能要求 |
| 依存関係 | `FR-012`, `FR-019`, `FR-031`, `SQ-001` |
| 衝突 | skip を許容すると全 PDF を必ず評価したい用途とは衝突する |
| 受け入れ基準 | `AC-FR032-001` から `AC-FR032-006` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-07 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | PDF OCR timeout 障害の再発防止に必要 |
| 十分性 | OK | seed、QA利用可能化確認、skip、fatal を含む |
| 理解容易性 | OK | skip と fatal の境界を受け入れ条件で明示 |
| 一貫性 | OK | `FR-012` の UI 非依存評価を補完する |
| 標準・契約適合 | OK | 1 要件 1 ファイルと要件内受け入れ条件を満たす |
| 実現可能性 | OK | runner と summary / report で検証可能 |
| 検証可能性 | OK | corpus seed unit test と artifact schema test へ落とせる |
| ニーズ適合 | OK | benchmark の診断性と継続実行性を改善する |

## 関連文書

- `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md`
