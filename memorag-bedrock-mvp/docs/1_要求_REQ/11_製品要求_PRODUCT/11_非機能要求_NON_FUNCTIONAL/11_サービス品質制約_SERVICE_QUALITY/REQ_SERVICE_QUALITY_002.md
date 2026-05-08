# 要件定義（1要件1ファイル）

- 要件ID: `SQ-002`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft
- 優先度: A

## 要件

- SQ-002: 長時間 benchmark run は、実行 timeout、失敗診断、成果物生成、運用停止判断を一貫して扱えること。

## 受け入れ条件（この要件専用）

- AC-SQ002-001: benchmark orchestration の timeout は、runner 実行基盤の timeout より先に切れないこと。
- AC-SQ002-002: benchmark run が評価 artifact 生成前に失敗した場合でも、失敗状態と一次調査に必要な log 参照および取得導線を残せること。
- AC-SQ002-003: benchmark run が失敗した場合、空または部分的な results / summary / report が成功 artifact と誤認されないこと。
- AC-SQ002-004: 長時間 run は、運用者が不要と判断したときに停止または cancel できる運用導線を持つこと。
- AC-SQ002-005: 長時間 run の timeout 延長は、コスト影響と未実施の実環境再実行確認を運用文書または PR 本文に記録すること。

## 要件の源泉・背景

- 源泉: `reports/working/20260507-2140-benchmark-build-timeout.md`
- 背景: 全量 PDF corpus seed と大規模 dataset の benchmark は、通常の短時間 job と同じ timeout 前提では完走しない可能性がある。
- 背景: timeout を延ばすだけでは、失敗時の診断性、artifact 誤認、コスト影響の問題が残る。

## 要件の目的・意図

- 目的: 長時間 benchmark を完走または診断可能な失敗として扱えるようにする。
- 意図: runner timeout、orchestration timeout、成果物、ログ、cancel、コストを個別対応にせず一貫した運用品質として管理する。
- 区分: サービス品質制約。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `SQ-002` |
| 説明 | 長時間 benchmark run の timeout 整合、失敗診断、artifact、cancel、コスト記録 |
| 根拠 | 大規模 benchmark は失敗時も調査可能でなければ改善判断に使えない |
| 源泉 | `reports/working/20260507-2140-benchmark-build-timeout.md` |
| 種類 | サービス品質制約 |
| 依存関係 | `FR-010`, `FR-011`, `FR-012`, `FR-039`, `SQ-001` |
| 衝突 | timeout 延長により失敗 run の実行コストが増える |
| 受け入れ基準 | `AC-SQ002-001` から `AC-SQ002-005` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-07 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 長時間 benchmark の運用品質に必要 |
| 十分性 | OK | timeout、log、artifact、cancel、cost を含む |
| 理解容易性 | OK | 品質水準として観測可能な条件になっている |
| 一貫性 | OK | `SQ-001` の継続測定を支える |
| 標準・契約適合 | OK | サービス品質制約として技術名依存を最小化 |
| 実現可能性 | OK | orchestration / runner / artifact / docs で実現可能 |
| 検証可能性 | OK | infra test、runner failure test、運用文書確認へ落とせる |
| ニーズ適合 | OK | 長時間評価の継続運用に必要 |

## 関連文書

- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `memorag-bedrock-mvp/docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md`
