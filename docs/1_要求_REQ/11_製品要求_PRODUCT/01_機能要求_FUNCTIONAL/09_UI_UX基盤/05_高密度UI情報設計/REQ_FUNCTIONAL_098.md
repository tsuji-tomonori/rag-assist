# 要件定義（1要件1ファイル）

- 要件ID: `FR-098`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A
- Confidence: confirmed

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `9. UI/UX 基盤`
- L2主機能群: `9.5 高密度 UI 情報設計`
- L3要件: `FR-098`
- 関連カテゴリ: 文書管理、問い合わせ、管理・監査

## 要件

- FR-098: high-density workspace を表示するとき、システムは主要 job に必要な操作、詳細操作、高影響操作を情報優先度に応じて段階化し、利用者語彙と現在の対象 context から ordinary task を完了できるようにする。

## 受け入れ条件（この要件専用）

- `AC-FR098-001`: primary action は current job/selection に対応し、unrelated detail/risky action と同じ視覚・reading priority で並ばないこと。
- `AC-FR098-002`: detail/advanced/risky actions は利用者が展開でき、keyboard/screen reader で expanded state、controlled region、focus return を把握できること。
- `AC-FR098-003`: raw enum、opaque ID、内部 service/module 名を ordinary task の必須入力または主要 label にせず、approved display metadata を使うこと。
- `AC-FR098-004`: 0件、多数件、長文、長い file/user/group name でも current target、selection、primary action、risk distinction が失われないこと。
- `AC-FR098-005`: progressive disclosure によって permission/critical state/risky consequence を隠さないこと。

## 検証

- `E2E-UI-DOCUMENTS-001`: documents high-density workspace variants。
- admin/questions large dataset and keyboard disclosure variants。
- inventory review: labels, controls, state metadata, operation count by disclosure level。

## 要件の源泉・背景

- 源泉: GitHub Issue #345 の document 132-operation analysis、progressive disclosure、user vocabulary TODO。
- current evidence: current main inventory では documents feature が 143 interactions を持つ。
- 分析: `FACT-345-013` と `TASK-345-06`。

## 要件の目的・意図

- 目的: 多数の操作を一度に同じ重みで提示して主要 job と危険操作を見失う状態を防ぐ。
- 意図: 操作数の固定上限ではなく、job/target/risk による hierarchy と検証可能な disclosure behavior を定める。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-098` |
| 説明 | progressive disclosure and user-language context in high-density UI |
| 根拠 | documents/admin/questions は操作密度と内部語彙が高い |
| 源泉 | GitHub Issue #345、generated Web inventory |
| 種類 | 機能要求 |
| 依存関係 | `FR-097`, `FR-096`, domain operation requirements, `NFR-017`, `SQ-016` |
| 衝突 | disclosure により permission/risk/critical status が発見不能になる可能性 |
| 受け入れ基準 | `AC-FR098-001`〜`AC-FR098-005` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-07-14 Issue #345 から追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・ニーズ適合 | pass | 操作密度の根拠が current inventory にある。 |
| 一貫性 | pass | permission/risk visibility を例外として明示した。 |
| 実現可能性 | pass | feature ごとに段階導入できる。 |
| 検証可能性 | pass | action hierarchy/disclosure/labels/extreme data を test できる。 |

## 関連文書・task

- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/todo/20260714-issue-345-document-workspace-context.md`
- `tasks/done/20260714-issue-345-ui-language-primitives.md`
