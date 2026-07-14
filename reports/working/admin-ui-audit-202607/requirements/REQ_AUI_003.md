# REQ-AUI-003: 利用・料金の安全な分析

## 要件

許可された管理者は、利用量と料金の状態・内訳を同一 query scope で絞り込み、比較、page 移動、export できなければならない。

## 要求属性

- 識別子: `REQ-AUI-003`
- 説明: period/user/group/model/feature、breakdown、comparison、completeness、as-of、cursor、export を一貫させる
- 根拠:現行 UI は user cost/unit price/conversation/filter/comparison/export を欠く
- 源泉: `FACT-AUI-024`–`030`; chapter spec §13
- Actor / trigger: usage-cost section の閲覧・export
- 種類: functional / usability / authorization
- 依存関係: `REQ-AUI-001`, `REQ-AUI-002`, `REQ-AUI-009`
- 衝突: main UI の「export未提供」と既存 export API、own permission の未使用
- 受け入れ基準: `AC-AUI-025`–`040`
- 優先度: P1
- 安定性: query dimensions は stable 候補、anomaly threshold/SLO は open_question
- Confidence: confirmed
- 所有者: Product / FinOps / Web
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-026`:画面 filter と API query が一致する。
- `AC-AUI-028`: user/quantity/unit price/subtotal を確認できる。
- `AC-AUI-034`:取得失敗を0/emptyとして表示しない。
- `AC-AUI-038`: export は画面と同じ query scope を使う。
- `AC-AUI-039`: own scope から他 user の情報を返さない。

## 妥当性確認

- 必要性:管理者が高額要因と欠測を特定するために必要
- 十分性: normal/empty/loading/error/permission/comparison を網羅する
- 理解容易性:単位、期間、as-of、sourceを隣接表示する
- 一貫性: read と export に同一 query object を使う
- 検証可能性: browser E2E と API authorization/export equivalence test を併用する

## トレース

- Task: `TASK-AUI-003`
- E2E: `E2E-AUI-002`, `E2E-AUI-003`
- Gap: `GAP-AUI-004`–`008`, `GAP-AUI-036`
- Specification: `SPEC-AUI-003`
