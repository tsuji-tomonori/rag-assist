# 要件定義（1要件1ファイル）

- 要件ID: `FR-037`
- 種別: `REQ_FUNCTIONAL`
- 状態: Planned
- 優先度: B

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `6. 問い合わせ・人手対応`
- L2主機能群: `6.1 問い合わせ管理`
- L3要件: `FR-037`
- 関連カテゴリ: `1. 文書・知識ベース管理`、`3. RAG検索品質制御`、`7. 評価・debug・benchmark`、`8. 認証・認可・管理・監査`

## 要件

- FR-037: システムは問い合わせ対応結果を HITL 改善候補として分類し、review 後に RAG 改善へ反映できること。

## 受け入れ条件（この要件専用）

- AC-FR037-001: システムは回答不能、低信頼、低評価、権限境界に近い問い合わせを HITL candidate として扱えること。
- AC-FR037-002: 担当者回答は review 前に RAG corpus へ自動投入されないこと。
- AC-FR037-003: HITL candidate は FAQ 候補、評価データ候補、用語集候補、alias 候補、不足文書候補を区別できること。
- AC-FR037-004: review、publish、reject の操作は audit log に who、when、source question、reviewed evidence、publish target を残せること。
- AC-FR037-005: benchmark へ publish する場合、expectedContains 固有チューニングや dataset 固有分岐を実装へ要求しない形式で登録できること。
- AC-FR037-006: reviewer 権限は route-level permission と store-level owner / role constraint で保護されること。
- AC-FR037-007: operations docs は未 review 回答の自動投入を避ける運用手順を説明できること。

## 要件の源泉・背景

- 源泉: `tasks/todo/20260507-2000-hitl-review-feedback-loop.md`、`reports/working/20260507-2000-neoai-roadmap-tasks.md`。
- 背景: 本番運用に近づけるには、回答不能、低信頼、低評価を人手対応に渡し、review 後に FAQ、評価データ、用語集、alias、chunking、文書追加へ戻すループが必要である。
- 背景: 既存の問い合わせ回答は利用者対応としては扱えるが、未 review の人間回答を RAG corpus に自動投入することは誤回答混入リスクを高める。
- 背景: 本要件は roadmap / todo に基づく Planned 要件であり、現時点の実装完了を意味しない。

## 要件の目的・意図

- 意図: 問い合わせ対応を一回限りの人手回答で終わらせず、RAG 改善の候補へつなげる。
- 意図: 人手回答を review と audit なしに検索対象へ混入させない。
- 意図: benchmark、FAQ、用語集、alias、不足文書候補への反映経路を分け、改善結果を追跡可能にする。

## 関連文書

- `1_要求_REQ/21_受入基準_ACCEPTANCE/REQ_ACCEPTANCE_001.md`
- `3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_007.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_008.md`
- `3_設計_DES/41_API_API/DES_API_001.md`
