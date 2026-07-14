# REQ-AUI-007: 管理対象ユーザーの探索

## 要件

許可された管理者は、多数のユーザーから対象を検索・絞り込み・page移動し、application role、resource group、実効権限、source/as-of を確認できなければならない。

## 要求属性

- 識別子: `REQ-AUI-007`
- 説明: server-side search/filter/cursor と scope-aware detail、row-scoped mutation state を提供する
- 根拠:現行 list は探索・detail・pagination がなく、role/group を混同する
- 源泉: `FACT-AUI-051`–`053`; chapter spec §11
- Actor / trigger: user list/detail/group management の利用
- 種類: functional / usability / authorization
- 依存関係: `REQ-AUI-004`–`006`, `REQ-AUI-009`
- 衝突: current all-user list と global loading、既存 groups field の意味
- 受け入れ基準: `AC-AUI-082`–`093`
- 優先度: P1
- 安定性:探索概念は stable、page size/SLO は open_question
- Confidence: confirmed / conflict
- 所有者: Product / Identity / Web
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-082`: name/login identifier で server-side 検索できる。
- `AC-AUI-084`: cursor page で重複・欠落を生じない。
- `AC-AUI-085`: role/group/source/as-of をdetailで区別する。
- `AC-AUI-087`: scope外の権限・folderを表示しない。
- `AC-AUI-088`: mutation中は対象行だけをbusyにする。

## 妥当性確認

- 必要性:対象を誤らず管理するための基本操作である
- 十分性: search/filter/page/detail/permission/stale/retry を含める
- 理解容易性: role/group/effective permissionを別概念で提示する
- 実現可能性: query APIとdetail routeを段階追加できる
- 検証可能性:大規模fixture、cursor、field-level permission、row-state E2Eで判定する

## トレース

- Task: `TASK-AUI-007`
- E2E: `E2E-AUI-009`
- Gap: `GAP-AUI-018`, `GAP-AUI-019`, `GAP-AUI-030`, `GAP-AUI-033`
- Specification: `SPEC-AUI-007`
