# チャット内オーケストレーションの完成

- 状態: todo
- タスク種別: 機能追加
- 作成日: 2026-07-13
- 関連要件: `FR-049`

## 背景

tool registry と複数 turn の基盤は一部存在するが、`FR-049` の planning、tool execution、状態遷移、失敗時挙動を end-to-end で満たす証拠がない。

## 目的と範囲

認可された tool だけを明示 plan から実行し、結果と失敗を conversation state へ一貫して反映する。

## 受け入れ条件

- [ ] plan、tool selection、引数、結果、最終回答を request/run ID で追跡できる。
- [ ] tool ごとの認可、timeout、retry、partial failure が fail safe になる。
- [ ] tool output を untrusted data として扱い、根拠・引用契約を維持する。
- [ ] 単一 turn、複数 turn、拒否、失敗、再試行の E2E test を追加する。

## 検証・文書

- agent/chat API test、Web conversation test、RAG security regression を実行する。
- `FR-049` と runtime/API/data design を実装に同期する。

## リスク

非同期 agent は `20260713-2300-async-agent-execution.md` と分離する。
