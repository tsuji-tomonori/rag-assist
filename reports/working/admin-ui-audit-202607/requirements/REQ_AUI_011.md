# REQ-AUI-011: server-authoritative alias transition

## 要件

システムは、aliasの各state transitionを、operator reasonとexpected versionを伴うserver-authoritative commandとして処理しなければならない。

## 要求属性

- 識別子: `REQ-AUI-011`
- 説明: draft/review/publish/reject/disableを明示commandとし、差分preview、state guard、authoritative response、auditを提供する
- 根拠:現行は固定reject理由、no-op update、client時刻/state fallback、disabled transition許容がある
- 源泉: `FACT-AUI-056`, `FACT-AUI-059`–`062`, `FACT-AUI-073`
- Actor / trigger: alias作成・編集・review・publish・reject・draft・disable
- 種類: functional / governance / integrity
- 依存関係: `REQ-AUI-008`, `REQ-AUI-009`
- 衝突: current generic update/review route とUI hardcoded fallback
- 受け入れ基準: `AC-AUI-126`–`134`
- 優先度: P1
- 安定性: state/version/reason原則はstable、approval workflowは要決定
- Confidence: confirmed
- 所有者: Search / RAG Governance / Web
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-126`: operator入力のreject理由を保存する。
- `AC-AUI-127`: draft化を明示transitionとして実行する。
- `AC-AUI-128`: server responseのstate/version/timeだけを採用する。
- `AC-AUI-129`: disabledからの不正transitionをserverで拒否する。
- `AC-AUI-130`:旧versionの更新をconflictにする。

## 妥当性確認

- 必要性:検索挙動変更の説明責任と競合防止に必要
- 十分性: reason/diff/state/version/permission/audit/paginationを含む
- 一貫性: clientはserver確定値を推測で補わない
- 実現可能性: transition tableとversioned commandへ分離できる
- 検証可能性:全state pair、permission、concurrency、audit contract testで判定する

## トレース

- Task: `TASK-AUI-011`
- E2E: `E2E-AUI-013`
- Gap: `GAP-AUI-027`, `GAP-AUI-029`
- Specification: `SPEC-AUI-011`
