# 要件定義（1要件1ファイル）

- 要件ID: `FR-022`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `5. 会話履歴・お気に入り`
- L2主機能群: `5.1 会話履歴管理`
- L3要件: `FR-022`
- 関連カテゴリ: なし


## 要件

- FR-022: 利用者は自分の会話履歴を永続的に保存し、再表示できること。

## 受け入れ条件（この要件専用）

- AC-FR022-001: システムは会話履歴 item を認証済み userId 単位で保存できること。
- AC-FR022-002: システムは会話履歴 item を認証済み userId 単位で一覧取得できること。
- AC-FR022-003: システムは会話履歴 item を認証済み userId 単位で削除できること。
- AC-FR022-004: 会話履歴 item は `schemaVersion` を持ち、未指定の既存 item は v1 として扱えること。
- AC-FR022-005: Web と API が新規保存する会話履歴 item は current schema の v2 を明示または補完すること。
- AC-FR022-006: システムは version 未指定、v1、v2 の item を同じ利用者の履歴として読み取れ、v1/v2 以外の version は黙って補完せず拒否すること。
- AC-FR022-007: システムは version 未指定または v1 の item を次回更新保存時に v2 へ移行し、一覧取得だけでは保存値を書き換えないこと。

## 要件の源泉・背景

- 源泉: `reports/working/20260502-1051-history-db-storage.md`、`reports/working/20260502-1103-history-schema-version-docs.md`、現行 `/conversation-history` API 実装。
- 背景: ブラウザローカルキャッシュだけでは端末変更、セッション消去、複数環境利用に弱いため、履歴をサーバー側で保持する必要がある。

## 要件の目的・意図

- 意図: 利用者の会話履歴を本人のデータとして分離し、画面再訪時にも過去のやり取りを復元できるようにする。
- 意図: 将来の履歴構造変更時に、保存済み item の互換性を管理できるようにする。

## schemaVersion decision

- `confirmed`: 2026-05-02 に保存された version 未指定 item は、当時の current schema である v1 と解釈する。
- `confirmed`: multi-turn optional state 導入後の current write schema は v2 とする。
- `confirmed`: v1 は read compatibility のため維持し、次回 write 時に v2 へ昇格する。read は副作用を持たない。
- `confirmed`: unknown version は v1/v2 へ推測変換せず fail closed とする。
- `open_question`: 実 AWS の保存 item における version 分布は未確認であり、本要件の自動テストを production migration 実施済みの証拠にはしない。

## 関連文書

- `3_設計_DES/41_API_API/DES_API_001.md`
- `3_設計_DES/31_データ_DATA/DES_DATA_001.md`
- `apps/api/src/contract/conversation-history-version-contract.test.ts`
- `apps/api/src/adapters/dynamodb-conversation-history-store.test.ts`
- `apps/api/src/adapters/local-stores.test.ts`
- `apps/web/src/features/history/hooks/useConversationHistory.test.ts`
