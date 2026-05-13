# 要件定義（1要件1ファイル）

- 要件ID: `NFR-014`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 要件

- NFR-014: 文書取り込みは、PDF、OCR、大容量、抽出不能の境界状態を追跡可能な結果として記録すること。

## 受け入れ条件（この要件専用）

- AC-NFR014-001: size または quota 超過は、文書 manifest、ingest run、または benchmark summary のいずれかで明示エラーまたは skip reason として確認できること。
- AC-NFR014-002: OCR timeout は、run 全体の成功/失敗状態と区別できる reason として確認できること。
- AC-NFR014-003: 抽出不能文書は、抽出不能であることと runner fatal ではないことを区別できること。
- AC-NFR014-004: 境界状態の記録には、対象文書または dataset row を特定できる非機微な識別子を含めること。
- AC-NFR014-005: 対応 mime type、size、timeout の具体閾値が未確定の場合、未確定として文書化し、実施済みの値として扱わないこと。

## 要件の源泉・背景
- 背景: 既存要件整理では PDF/OCR/大容量 ingest の境界値が重要とされているが、mime type、size、timeout の本番閾値は未確定である。

## 要件の目的・意図

- 目的: 文書取り込みの境界状態を、成功/失敗だけでなく原因分類として追跡できるようにする。
- 意図: 未確定の閾値を確定済みとして記述せず、実装や運用で後から安全に具体化できる余地を残す。
- 区分: 非機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `NFR-014` |
| 説明 | PDF/OCR/大容量/抽出不能文書の境界状態記録 |
| 根拠 | 境界状態を記録しないと ingest failure と評価対象外を切り分けられない |
| 種類 | 非機能要求 |
| 依存関係 | `FR-001`, `FR-002`, `FR-038`, `FR-039` |
| 衝突 | 境界分類の記録により run schema と運用手順が増える |
| 受け入れ基準 | `AC-NFR014-001` から `AC-NFR014-005` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/06_非同期文書取り込み/REQ_FUNCTIONAL_038.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/06_benchmark_corpus_seed/REQ_FUNCTIONAL_039.md`
- `docs/OPERATIONS.md`
