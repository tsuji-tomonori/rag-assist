# 要件定義（1要件1ファイル）

- 要件ID: `FR-097`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A
- Confidence: confirmed

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `9. UI/UX 基盤`
- L2主機能群: `9.4 ワークスペース状態保持`
- L3要件: `FR-097`
- 関連カテゴリ: 文書管理、問い合わせ、管理・監査

## 要件

- FR-097: 利用者が high-density workspace で search、filter、sort、selection、または detail context を変更したとき、システムは承認された restorable state を URL または明示的な persisted state と visible selection に反映し、遷移・reload・return 後も予測可能に復元する。

## 受け入れ条件（この要件専用）

- `AC-FR097-001`: search/filter/sort の active value、result count/source/as-of、selection が利用者に可視であること。
- `AC-FR097-002`: reload、detail return、browser back/forward で approved restorable state と scroll/selection context が仕様どおり復元されること。
- `AC-FR097-003`: invalid、obsolete、unauthorized selection/filter は protected data を示さず、安全な default と修正理由へ正規化すること。
- `AC-FR097-004`: state reset は利用者操作または対象 data/version の失効によって説明可能で、unrelated refresh で silent reset しないこと。
- `AC-FR097-005`: zero/many/long-label data でも current context と primary action が失われないこと。

## 検証

- `E2E-UI-DOCUMENTS-001`: document query/filter/sort/selection/detail restoration。
- admin/questions variants: section/filter/sort/selection and source/as-of refresh。
- unit: URL state serialization, invalid value normalization, permission filtering。

## 要件の源泉・背景

- 源泉: GitHub Issue #345 の search/filter/sort/selection predictability TODO。
- current evidence: document workspace の folder/document/migration/query/type/status/group/sort は canonical path/query へ serialize され、route normalization と reload evidence がある。admin/questions の detail/filter/selection と scroll context は引き続き未完了。
- existing admin task: `tasks/todo/20260714-1011-admin-ui-governance-quality.md`。

## 要件の目的・意図

- 目的: 利用者が選択中の対象・絞り込み条件・戻り先を見失わず、同じ業務を再開できるようにする。
- 意図: すべてを永続化するのではなく、approved restorable state と transient state の境界を design で定義する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-097` |
| 説明 | predictable workspace query and selection context |
| 根拠 | high-density workspace の silent reset は誤操作と再探索を増やす |
| 源泉 | GitHub Issue #345、document/admin current source and tasks |
| 種類 | 機能要求 |
| 依存関係 | `FR-031`, `FR-032`, `FR-094`, `FR-098`, domain list/read requirements |
| 衝突 | URL へ機微 identifier を含める場合の privacy/non-disclosure |
| 受け入れ基準 | `AC-FR097-001`〜`AC-FR097-005` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-07-14 Issue #345 から追加 |

## 妥当性確認

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 必要性・ニーズ適合 | pass | docs/admin/questions の共通 navigation loss を扱う。 |
| 一貫性 | pass with constraint | protected identifiers and permission filtering remain authoritative. |
| 実現可能性 | pass | document URL state の canonical path/query pattern と shared route parser を実装済み。 |
| 検証可能性 | pass | serialization/restoration/invalid/permission cases are observable. |

## 関連文書・task

- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tasks/done/20260714-issue-345-url-history-routing.md`
- `tasks/todo/20260714-issue-345-document-workspace-context.md`
- `tasks/todo/20260714-1011-admin-ui-governance-quality.md`
