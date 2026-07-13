# REQ-AUI-010: 行動可能で復元可能な管理 overview

## 要件

許可された管理者は、overview の状態・異常・未処理項目から、URLで復元可能な対象sectionとqueryへ遷移できなければならない。

## 要求属性

- 識別子: `REQ-AUI-010`
- 説明: action card/KPI、根拠、threshold/as-of、permission-aware deep link、back/forwardを提供する
- 根拠:現行KPIはread-onlyで、quality action API未使用、section stateはURL外である
- 源泉: `FACT-AUI-001`–`010`; chapter spec §10
- Actor / trigger: admin overview表示、card選択、deep link/reload/history
- 種類: functional / usability / information architecture
- 依存関係: `REQ-AUI-003`, `REQ-AUI-007`–`009`、action threshold policy
- 衝突: current component-only section state と数値だけのKPI
- 受け入れ基準: `AC-AUI-117`–`125`
- 優先度: P1
- 安定性: navigation/state truthはstable、action thresholdsはopen_question
- Confidence: confirmed / inferred
- 所有者: Product / Web / Operations
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-117`: reload/shareで同じsection/queryを復元する。
- `AC-AUI-119`:権限のないdeep linkからdataを返さない。
- `AC-AUI-120`: KPIから対応filter付きsectionへ遷移する。
- `AC-AUI-121`: KPI取得失敗を0と表示しない。
- `AC-AUI-125`: threshold source/version/as-ofを確認できる。

## 妥当性確認

- 必要性: overview を報告画面ではなく対応起点にする
- 十分性: URL/history/permission/loading/error/action provenanceを含む
- 理解容易性: cardから「何が、いつ、なぜ、どこへ」を示す
- 実現可能性: route/query stateとpermission-filtered projectionで実装可能
- 検証可能性: browser navigation/history/error/permission E2Eで判定する

## トレース

- Task: `TASK-AUI-010`
- E2E: `E2E-AUI-011`, `E2E-AUI-012`
- Gap: `GAP-AUI-020`–`025`
- Specification: `SPEC-AUI-010`
