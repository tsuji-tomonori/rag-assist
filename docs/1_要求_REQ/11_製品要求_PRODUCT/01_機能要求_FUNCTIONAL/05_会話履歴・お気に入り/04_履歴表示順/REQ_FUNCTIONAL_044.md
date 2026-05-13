# 要件定義（1要件1ファイル）

- 要件ID: `FR-044`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: B

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `5. 会話履歴・お気に入り`
- L2主機能群: `5.4 履歴表示順`
- L3要件: `FR-044`
- 関連カテゴリ: なし

## 要件

- FR-044: 会話履歴画面は、同一時刻の履歴 item を安定した順序で表示できること。

## 受け入れ条件（この要件専用）

- AC-FR044-001: 複数の履歴 item が同じ更新日時を持つ場合でも、一覧の表示順が再描画ごとに入れ替わらないこと。
- AC-FR044-002: 検索、sort、favorite filter の適用後も、同一 sort key の item には安定した tie-break が適用されること。
- AC-FR044-003: 表示順の tie-break は認証済み userId の履歴 item 内で完結し、他 userId の履歴を参照しないこと。
- AC-FR044-004: 安定順序のために debug trace、内部メモ、retrieved full text を sort key として使わないこと。

## 要件の源泉・背景

- 源泉: `docs/spec-recovery/06_requirements.md` の `REQ-HIST-002`
- 源泉: `docs/spec-recovery/03_acceptance_criteria.md` の `AC-HIST-002`
- 背景: 復元条件では、同一時刻や短い substring でも履歴表示順が安定することが求められている。

## 要件の目的・意図

- 目的: 履歴検索や絞り込み後の一覧を利用者が再現性を持って確認できるようにする。
- 意図: 履歴検索そのものは `FR-030` に残し、表示順の安定性だけを独立要件として管理する。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-044` |
| 説明 | 会話履歴の安定表示順 |
| 根拠 | 履歴検索・sort・favorite filter の結果が再描画で揺れると利用者が対象履歴を追いにくい |
| 源泉 | `REQ-HIST-002`, `AC-HIST-002`, `SPEC-HIST-003` |
| 種類 | 機能要求 |
| 依存関係 | `FR-022`, `FR-028`, `FR-030` |
| 衝突 | tie-break 用 key の選定が data schema に依存する |
| 受け入れ基準 | `AC-FR044-001` から `AC-FR044-004` |
| 優先度 | B |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/05_会話履歴・お気に入り/01_会話履歴管理/REQ_FUNCTIONAL_022.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/05_会話履歴・お気に入り/03_会話履歴検索/REQ_FUNCTIONAL_030.md`
