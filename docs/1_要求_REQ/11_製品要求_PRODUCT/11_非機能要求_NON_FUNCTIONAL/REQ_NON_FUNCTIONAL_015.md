# 要件定義（1要件1ファイル）

- 要件ID: `NFR-015`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 要件

- NFR-015: debug trace artifact は、取得可能になる前に不要な機微情報を redaction すること。

## 受け入れ条件（この要件専用）

- AC-NFR015-001: debug trace artifact は raw embeddings を含めないこと。
- AC-NFR015-002: debug trace artifact は、通常利用者に返さない raw retrieved chunks または full text を不要に含めないこと。
- AC-NFR015-003: debug trace artifact は、artifact 生成時または download 時に redaction policy を適用すること。
- AC-NFR015-004: redaction 後も、判定 step、finalEvidence、sentence assessment の調査に必要な非機微情報は残ること。
- AC-NFR015-005: redaction 対象が未確定の detail 生文字列は、未確定リスクとして追跡し、sanitize 済みとして扱わないこと。

## 要件の源泉・背景

- 源泉: `docs/spec-recovery/06_requirements.md` の `REQ-DBG-002`
- 源泉: `docs/spec-recovery/03_acceptance_criteria.md` の `AC-DBG-002`
- 源泉: `docs/spec-recovery/09_gap_analysis.md` の `GAP-008`
- 背景: debug trace は管理者限定でも機微情報を含み得るため、artifact 化時に不要な raw data を露出させない必要がある。

## 要件の目的・意図

- 目的: debug trace の調査性を保ちながら、artifact 取得による不要な情報露出を抑える。
- 意図: debug trace の閲覧権限と artifact redaction を分離し、redaction を非機能要求として検証可能にする。
- 区分: 非機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `NFR-015` |
| 説明 | debug trace artifact の redaction |
| 根拠 | debug trace artifact は管理者限定でも raw chunk や内部情報を過剰に含めるべきではない |
| 源泉 | `REQ-DBG-002`, `AC-DBG-002`, `GAP-008` |
| 種類 | 非機能要求 |
| 依存関係 | `FR-045`, `NFR-010`, `NFR-011` |
| 衝突 | redaction を強めすぎると調査に必要な evidence が欠落する |
| 受け入れ基準 | `AC-NFR015-001` から `AC-NFR015-005` |
| 優先度 | S |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/08_debug_trace_artifact/REQ_FUNCTIONAL_045.md`
- `docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md`
