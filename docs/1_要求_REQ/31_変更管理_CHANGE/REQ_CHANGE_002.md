# 作業レポート由来要求の trace

- 要件ID: `CHG-002`
- 種別: `REQ_CHANGE`
- 状態: Draft
- 優先度: B

## 要件

- CHG-002: 作業・障害レポートから要求を追加または変更するとき、採用した product behavior と採用しなかった process evidence を区別し、正規要求から根拠レポートへ逆引きできること。

## 受け入れ条件（この要件専用）

- AC-CHG002-001: 採用する事実は source report/task、対象 behavior、confidence、関連 requirement を記録すること。
- AC-CHG002-002: product behavior に関係する事実だけを正規の REQ/ARC/DES/OPS へ反映すること。
- AC-CHG002-003: commit、PR、merge、agent 手順だけの記録は製品仕様として取り込まないこと。
- AC-CHG002-004: 要求、gap、todo から report source または task family へ逆引きできること。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `CHG-002` |
| 根拠 | 一時的な作業ログをそのまま製品仕様にすると、事実と推定、製品と process が混同されるため |
| 源泉 | ユーザー指示、既存作業レポート、`CHG-001` |
| 種類 | 変更管理要求 |
| 依存関係 | `REQ_CHANGE_001`, `docs/1_要求_REQ/README.md` |
| 受け入れ基準 | `AC-CHG002-001` から `AC-CHG002-004` |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版、2026-07-13 正規 docs 構成へ統合 |

## 関連文書

- `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md`
- `reports/working/`
