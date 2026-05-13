# 要件定義（1要件1ファイル）

- 要件ID: `FR-046`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `7. 評価・debug・benchmark`
- L2主機能群: `7.8 debug trace artifact`
- L3要件: `FR-046`
- 関連カテゴリ:
  - `8. 認証・認可・管理・監査`

## 要件

- FR-046: 管理者は、chat run の debug trace を時系列 artifact として取得できること。

## 受け入れ条件（この要件専用）

- AC-FR046-001: `SYSTEM_ADMIN` または同等の debug 権限を持つ利用者は、trace timeline を取得できること。
- AC-FR046-002: trace timeline は主要 step、sentence assessment、finalEvidence、判定理由を時系列で確認できること。
- AC-FR046-003: JSON または Markdown の download artifact は、対象 run を識別できる情報を含むこと。
- AC-FR046-004: 通常ユーザーは debug trace artifact を取得できないこと。

## 要件の源泉・背景

- 源泉: `docs/spec-recovery/06_requirements.md` の `REQ-DBG-002`
- 源泉: `docs/spec-recovery/03_acceptance_criteria.md` の `AC-DBG-002`
- 源泉: `docs/spec-recovery/07_specifications.md` の `SPEC-DBG-002`
- 背景: 復元仕様では、debug trace artifact が timeline、sentence assessments、finalEvidence、判定 step を再現できることが求められている。

## 要件の目的・意図

- 目的: 管理者が RAG 回答の失敗、拒否、根拠採用、回答支持検証を後から調査できるようにする。
- 意図: debug trace の閲覧機能を時系列 artifact 取得という検証可能な単位で管理する。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-046` |
| 説明 | debug trace timeline artifact の取得 |
| 根拠 | RAG 品質調査では run 内の判定 step を時系列で再現する必要がある |
| 源泉 | `REQ-DBG-002`, `AC-DBG-002`, `SPEC-DBG-002` |
| 種類 | 機能要求 |
| 依存関係 | `FR-010`, `FR-011`, `NFR-010`, `NFR-011` |
| 衝突 | artifact に機微情報が含まれるため redaction 要件と同時に満たす必要がある |
| 受け入れ基準 | `AC-FR046-001` から `AC-FR046-004` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_015.md`
- `docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md`
