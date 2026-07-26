# SQ-010 回答忠実性

- 要件ID: `SQ-010`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（閾値未承認）
- 優先度: S

## 要件

- SQ-010: システムは、回答 claim が許可済み根拠から支持される割合と unsupported claim rate を、承認済み忠実性閾値内に保つこと。

## 品質尺度

- measure: claim-level faithfulness、unsupported claim rate、重大な捏造件数。
- runner summary の `faithfulness` は answer support が評価した全回答文のうち支持された文の micro-rate とし、support evidence が0件なら `null` とする。
- fail point/target: question type、severity、answerability 別に `OQ-RD-005` で決定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-010` |
| 説明 | authorized evidence に対する answer faithfulness |
| 根拠 | 検索成功後の根拠外生成を独立に検出する |
| 源泉 | RAG ガイド §7.4（PDF pp.168–174） |
| Actor / trigger | answer candidate の評価 |
| 種類 | サービス品質制約 / generation |
| 依存関係 | `FR-014`–`FR-016`, `FR-073`, `FR-075` |
| 衝突 | 網羅性を上げる生成が unsupported claim を増やし得る |
| 受け入れ基準 | `AC-SQ010-001` から `AC-SQ010-003` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | RAG Quality / Business owner |
| 変更履歴 | 2026-07-11 初版 / 2026-07-17 runner summary と versioned case propagation を追加 |

## 受け入れ条件

### AC-SQ010-001 claim 支持

- Given: claim と支持 span を注釈した versioned dataset がある
- When: candidate answer を claim 単位で評価する
- Then: faithfulness が approved fail point 以上で、unsupported claim rate が approved 上限以下である

### AC-SQ010-002 重大な根拠外回答

- Given: 高重大度 claim に支持根拠がない
- When: promotion gate を評価する
- Then: 全体平均で相殺せず、profile の重大度規則に従って不合格にする

### AC-SQ010-003 artifact 伝播

- Given: answer support の evaluated / unsupported claim count を持つ versioned case artifact がある
- When: benchmark summary、run metrics、production observation を生成する
- Then: 同じ分子・分母から faithfulness を伝播し、evidence 不足または未承認 threshold を合格へ変換しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 回答の捏造を検索品質と分けて管理する |
| 十分性 | OK | 支持率と unsupported claim を含む |
| 理解容易性 | OK | 引用品質は `SQ-011` へ分離した |
| 一貫性 | OK | 根拠限定回答要求を定量化する |
| 標準・契約適合 | OK | 1 要求 1 faithfulness characteristic |
| 実現可能性 | OK | claim/span annotation と evaluator で測定可能 |
| 検証可能性 | OK | 支持・非支持 fixture で判定できる |
| ニーズ適合 | OK | 利用者が根拠に反する回答を受けない |
| 実装適合 | OK（measurement/gate contract、閾値未承認） | runner の answer support count と versioned claim/span/locator evidence から faithfulness/unsupported rate を導出・伝播し、critical/high unsupported claim を独立 gate する focused tests が pass |

## トレース

- 後方: `SQ-001`, RAG ガイド §7.4。
- 前方: claim evaluator、`SQ-007`, `OQ-RD-005`。
