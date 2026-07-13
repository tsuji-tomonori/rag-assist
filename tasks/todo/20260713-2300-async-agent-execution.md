# 非同期エージェント実行の実装

- 状態: todo
- タスク種別: 機能・セキュリティ実装
- 作成日: 2026-07-13
- 関連要件: `FR-050`, `FR-090`, `SQ-006`

## 背景

`FR-050` は planning 状態であり、submit、queue、cancel、resume、current authorization、result ownership を満たす完成実装がない。

## 目的と範囲

非同期 agent run の lifecycle、idempotency、ownership、current reauthorization、cancel/retry、監査を実装する。

## 受け入れ条件

- [ ] create/get/list/cancel が owner/permission 境界を強制する。
- [ ] duplicate submit、retry、cancel/commit race で結果を二重公開しない。
- [ ] 実行開始・commit 前に current identity/resource state を再評価する。
- [ ] lifecycle、authorization、recovery の API/worker test を追加する。

## 検証・文書

- worker/store/API security test と recovery test を実行する。
- `FR-050`, `FR-090`, API/data/operation design を更新する。

## リスク

identity/session の共通実装は `20260713-2250-authoritative-identity-session.md` を先行または同時適用する。
