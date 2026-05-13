# 要件定義（1要件1ファイル）

- 要件ID: `FR-043`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: B

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `2. チャットQA・根拠提示・回答不能制御`
- L2主機能群: `2.7 チャットUI操作性`
- L3要件: `FR-043`
- 関連カテゴリ: なし

## 要件

- FR-043: チャット画面は、利用者が回答本文を対象としてコピーできること。

## 受け入れ条件（この要件専用）

- AC-FR043-001: 回答本文の copy 操作は、対象回答の本文だけを clipboard へ渡すこと。
- AC-FR043-002: copy 操作は、debug trace、内部 metadata、未表示の retrieved full text を clipboard に含めないこと。
- AC-FR043-003: copy 成功または失敗の feedback は、対象回答に紐づく状態として表示されること。
- AC-FR043-004: 回答不能結果の copy 操作は、回答不能理由または表示済み説明だけを対象にすること。

## 要件の源泉・背景

- 源泉: `docs/spec-recovery/06_requirements.md` の `REQ-UI-001`
- 源泉: `docs/spec-recovery/07_specifications.md` の `SPEC-UI-001`
- 背景: 復元仕様では copy が対象テキストのみを扱い、不要な feedback action を出さないことが確認されている。

## 要件の目的・意図

- 目的: 利用者が回答を外部へ転記するとき、表示済みの回答本文だけを安全にコピーできるようにする。
- 意図: copy 操作に内部情報や debug 情報が混入しない境界を要件として固定する。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-043` |
| 説明 | チャット回答本文の copy 操作 |
| 根拠 | UI copy は回答本文を扱うが内部情報を含めてはならない |
| 源泉 | `REQ-UI-001`, `AC-UI-001`, `SPEC-UI-001` |
| 種類 | 機能要求 |
| 依存関係 | `FR-004`, `FR-005`, `NFR-010` |
| 衝突 | 引用や debug 表示の併存時に copy 対象の境界を明確にする必要がある |
| 受け入れ基準 | `AC-FR043-001` から `AC-FR043-004` |
| 優先度 | B |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `docs/REQUIREMENTS.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/02_根拠提示/REQ_FUNCTIONAL_004.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_010.md`
