# 要件定義（1要件1ファイル）

- 要件ID: `TC-002`
- 種別: `REQ_TECHNICAL_CONSTRAINT`
- 状態: Draft
- 優先度: B

## 要件

- TC-002: 外部公開 API の request body は、API Gateway または API handler の schema validation により、処理本体へ渡る前に基本的な形状違反を拒否できること。

## 受け入れ条件（この要件専用）

- AC-TC002-001: 外部公開 API の request body validation 方針は、route ごとに未定義のまま放置されないこと。
- AC-TC002-002: 必須 field 欠落、型不一致、明らかな形式違反は、business logic 実行前に 4xx として扱えること。
- AC-TC002-003: request validation は認可処理を置き換えず、認証・認可境界を別途維持すること。
- AC-TC002-004: schema validation の対象外 route がある場合、対象外理由を設計文書または PR 本文に記録すること。
- AC-TC002-005: validation 追加時は、正常系と代表的な不正 body の contract test を追加すること。

## 要件の源泉・背景

- 源泉: `reports/working/20260505-1420-pr109-review-followup.md`
- 源泉: `reports/working/20260505-1327-apig2-request-validation.md`
- 背景: API Gateway の基本 request validation は導入されたが、body schema validation の厳密化は別設計扱いとして残った。
- 背景: body validation が route ごとに曖昧だと、handler や service 層で想定外入力を個別に処理する必要がある。

## 要件の目的・意図

- 目的: API 境界で不正 request body を早期に拒否し、handler と business logic の入力前提を安定させる。
- 意図: validation と認可を混同せず、入力形状の防御層を明示する。
- 区分: 技術制約。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `TC-002` |
| 説明 | 外部公開 API の request body schema validation 方針 |
| 根拠 | 不正 body を business logic へ渡すと contract と error handling が不安定になる |
| 源泉 | `reports/working/20260505-1420-pr109-review-followup.md`, `reports/working/20260505-1327-apig2-request-validation.md` |
| 種類 | 技術制約 |
| 依存関係 | `NFR-013`, `DES_API_001` |
| 衝突 | validation を厳密化すると後方互換性と既存 client の扱いに注意が必要 |
| 受け入れ基準 | `AC-TC002-001` から `AC-TC002-005` |
| 優先度 | B |
| 安定性 | Medium |
| 変更履歴 | 2026-05-07 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | API 境界の堅牢化に必要 |
| 十分性 | OK | 方針、拒否条件、認可分離、対象外理由、test を含む |
| 理解容易性 | OK | validation の目的と非目的を明示 |
| 一貫性 | OK | API contract test と request validation 方針に合う |
| 標準・契約適合 | OK | 技術制約として validation 技術の責務を明示 |
| 実現可能性 | OK | API Gateway model または handler schema validation で実現可能 |
| 検証可能性 | OK | contract test と 4xx response test へ落とせる |
| ニーズ適合 | OK | 外部公開 API の保守性と安全性を上げる |

## 関連文書

- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md`
