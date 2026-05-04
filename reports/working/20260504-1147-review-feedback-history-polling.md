# 作業完了レポート

保存先: `reports/working/20260504-1147-review-feedback-history-polling.md`

## 1. 受けた指示

- PR レビュー指摘を受け、Web 側の履歴同期をマージ前に修正する。
- 履歴の `返答あり` バッジが継続ポーリングされない問題を直す。
- `updateHistoryQuestionTickets` の state updater 内副作用を避ける。
- 非所有者が ticket ID の存在確認をできる境界を見直す。
- requester が未回答 ticket を resolve できる挙動を見直す。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 履歴側の unresolved ticket を継続同期する | 高 | 対応 |
| R2 | state updater 内で保存対象配列を mutate しない | 高 | 対応 |
| R3 | 非担当者・非作成者に ticket 存在有無を識別させない | 中 | 対応 |
| R4 | requester の resolve は回答済み ticket に限定する | 中 | 対応 |
| R5 | fake timer を使った回帰テストを追加する | 高 | 対応 |

## 3. 検討・判断したこと

- 履歴 polling は過剰リクエストを避けるため、`history` / `favorites` view 表示時だけ動かすことにした。
- ticket ID の存在確認は、非所有者・非担当者に `404` を返して missing / forbidden を揃えた。
- requester による解決済み化は、担当者回答確認後の操作として `answered` 状態に限定した。担当者の `answer:publish` 経路は従来どおり status を問わず resolve できる。
- 静的 access-control policy test は、`requirePermission` 固定ではなく「permission または requester ownership」パターンを明示的に検証する形へ更新した。

## 4. 実施した作業

- `useAppShellState` に履歴/favorites 表示中の 20 秒 interval polling を追加。
- `updateHistoryQuestionTickets` は `historyRef.current` から `nextHistory` と `changedItems` を updater 外で算出するよう変更。
- `/questions/{questionId}` と `/questions/{questionId}/resolve` の非所有者応答を `404` に統一。
- requester の open ticket resolve を `409` に変更。
- Web の fake timer テストと API access-control テストを更新。
- FR/NFR/API 例/設計ドキュメントを更新。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/web/src/app/hooks/useAppShellState.ts` | TypeScript | 履歴 ticket polling | R1 |
| `memorag-bedrock-mvp/apps/web/src/features/history/hooks/useConversationHistory.ts` | TypeScript | updater 外で履歴更新・保存対象を算出 | R2 |
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | 非所有者 404、requester open resolve 409 | R3/R4 |
| `memorag-bedrock-mvp/apps/web/src/App.test.tsx` | Test | 20 秒後に `返答あり` へ変わる fake timer test | R5 |
| `memorag-bedrock-mvp/apps/api/src/questions-access.test.ts` | Test | 非所有者 404 と open resolve 409 の検証 | R3/R4 |

## 6. 検証

| コマンド | 結果 |
|---|---|
| `npm --prefix memorag-bedrock-mvp/apps/web run typecheck` | pass |
| `npm --prefix memorag-bedrock-mvp/apps/api run typecheck` | pass |
| `npm --prefix memorag-bedrock-mvp/apps/web run test -- src/App.test.tsx` | pass |
| `npm --prefix memorag-bedrock-mvp/apps/api test -- src/questions-access.test.ts src/contract/api-contract.test.ts src/security/access-control-policy.test.ts` | pass。npm script の glob により API 全 73 test を実行 |
| `npm --prefix memorag-bedrock-mvp run lint` | pass |
| `npm --prefix memorag-bedrock-mvp/apps/web run build` | pass |
| `git diff --check` | pass |

## 7. 指示へのfit評価

総合fit: 5.0 / 5.0（約100%）

理由: 指摘 1-4 をすべて実装し、主目的の履歴バッジ同期について fake timer の回帰テストを追加した。

## 8. 未対応・制約・リスク

- 履歴 polling は `history` / `favorites` view 表示中のみ行う。非表示中は view を開いた時点で即時同期する。
- 通知は引き続き polling であり、push 通知ではない。
