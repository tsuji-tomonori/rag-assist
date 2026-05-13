# 要件定義（1要件1ファイル）

- 要件ID: `FR-048`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `7. 評価・debug・benchmark`
- L2主機能群: `7.10 benchmark 実行追跡`
- L3要件: `FR-048`
- 関連カテゴリ:
  - `運用`

## 要件

- FR-048: benchmark run は、進捗と成果物生成状態を利用者または運用者が確認できること。

## 受け入れ条件（この要件専用）

- AC-FR048-001: benchmark run の状態は queued、running、completed、failed、timed_out などの運用判断に使える値で確認できること。
- AC-FR048-002: benchmark run の進捗は、少なくとも処理済み件数、skip 件数、失敗件数のいずれかを確認できること。
- AC-FR048-003: results、summary、report、log などの artifact は、生成済み、未生成、生成失敗を区別できること。
- AC-FR048-004: raw results download が利用可能な場合、対象 run と artifact 種別が取り違えられないこと。
- AC-FR048-005: CodeBuild log stream が記録された run では、管理画面からログ本文を `.txt` として download できること。

## 要件の源泉・背景
- 背景: 既存要件整理では、長時間 benchmark run の timeout、progress、metrics、raw results download、artifact generation の追跡が求められている。

## 要件の目的・意図

- 目的: benchmark run の途中状態と成果物状態を、完了/失敗後の調査に使える形で確認できるようにする。
- 意図: timeout や cost guard はサービス品質制約として扱い、この要件では利用者が確認できる実行追跡に限定する。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-048` |
| 説明 | benchmark run の進捗と artifact 生成状態の確認 |
| 根拠 | 長時間 benchmark は途中状態と artifact 状態が見えないと成功/失敗を判断できない |
| 種類 | 機能要求 |
| 依存関係 | `FR-010`, `FR-011`, `FR-012`, `SQ-002` |
| 衝突 | 詳細な進捗記録により runner と artifact schema の保守負荷が増える |
| 受け入れ基準 | `AC-FR048-001` から `AC-FR048-004` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/11_サービス品質制約_SERVICE_QUALITY/REQ_SERVICE_QUALITY_002.md`
- `docs/OPERATIONS.md`
