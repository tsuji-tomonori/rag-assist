# REQ-AUI-004: canonical application role catalog

## 要件

システムは、application role の意味と認可計算と identity provisioning が参照する canonical catalog を一つにしなければならない。

## 要求属性

- 識別子: `REQ-AUI-004`
- 説明: role ID、表示名、説明、category、risk、permissions、system/custom、provisioning mapping を一元化する
- 根拠: backend 12 role と Cognito 9 group が不一致で、UI は raw permission 列だけである
- 源泉: `FACT-AUI-035`–`039`, `FACT-AUI-052`; `FR-079`
- Actor / trigger: role catalog read/provisioning/authorization evaluation
- 種類: functional / security / information architecture
- 依存関係: custom role policy、identity group mapping
- 衝突: current authorization catalog と infra group list、role create/update permission の未提供
- 受け入れ基準: `AC-AUI-041`–`052`
- 優先度: P0
- 安定性: single catalog 原則は stable、catalog contents は要承認
- Confidence: conflict
- 所有者: Security / Identity
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-041`: role の用途とriskを内部IDなしで読める。
- `AC-AUI-047`: catalog と provisioning の drift を検出する。
- `AC-AUI-048`:未知 role を拒否し既存 set を保持する。
- `AC-AUI-050`: application role と resource group を区別する。
- `AC-AUI-052`:未提供の role 編集操作を表示しない。

## 妥当性確認

- 必要性:可読性と安全な mutation の共通前提である
- 十分性: UI metadata と authorization/provisioning mapping を同じ source に含める
- 一貫性: `FR-079` の canonical catalog 方針を採用する
- 標準・契約適合:未知 enum を黙って default role へ変換しない
- 検証可能性: catalog snapshot、infra drift、UI search/compare test で判定する

## トレース

- Task: `TASK-AUI-004`
- E2E: `E2E-AUI-004`
- Gap: `GAP-AUI-009`, `GAP-AUI-011`, `GAP-AUI-012`, `GAP-AUI-033`
- Specification: `SPEC-AUI-004`
