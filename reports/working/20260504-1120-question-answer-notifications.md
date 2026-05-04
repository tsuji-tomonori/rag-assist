# 作業完了レポート

保存先: `reports/working/20260504-1120-question-answer-notifications.md`

## 1. 受けた指示

- worktree を作成して作業する。
- 利用者側が問い合わせの回答を見られる状態か確認し、必要なら修正する。
- 履歴に通知を付け、返答が返ってきていることが分かるようにする。
- 変更を commit し、GitHub Apps を利用して main 向け PR を作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 独立 worktree で作業する | 高 | 対応 |
| R2 | 通常利用者が自身の問い合わせ回答を確認できる | 高 | 対応 |
| R3 | 履歴上で返答済みが分かる通知を表示する | 高 | 対応 |
| R4 | 権限境界と内部メモの非公開を維持する | 高 | 対応 |
| R5 | 最小十分な検証を実行する | 高 | 対応 |
| R6 | commit と main 向け PR 作成を行う | 高 | commit/PR 作成前 |

## 3. 検討・判断したこと

- 既存実装では `GET /questions/{questionId}` と `POST /questions/{questionId}/resolve` が `answer:*` 権限前提で、`CHAT_USER` が担当者回答を再取得できない状態だった。
- 問い合わせ作成時に認証済み userId を `requesterUserId` として保存し、作成者本人だけが詳細取得と解決済み化を実行できるようにした。
- 担当者向けの `internalMemo` は本人向け詳細レスポンスから除外し、一覧取得と回答登録は従来どおり担当者権限に閉じた。
- Web UI は担当者一覧を通常利用者に事前取得せず、会話・履歴に紐づいた ticket ID だけを targeted GET で同期する方針にした。

## 4. 実施した作業

- `/tmp/rag-assist-answer-status` に `codex/answer-status-notifications` worktree を作成。
- API に `requesterUserId` を保存し、作成者本人の問い合わせ詳細取得と解決済み化を許可。
- 本人向け問い合わせ詳細から `internalMemo` を除外。
- Web API client に `getQuestion` を追加。
- チャット中および履歴中の未解決 ticket を同期し、回答到着時に会話と履歴の ticket snapshot を更新。
- 履歴一覧に `返答あり`、`確認待ち`、`解決済み` バッジを追加。
- API/Web テストと関連ドキュメントを更新。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/app.ts` ほか | TypeScript | 問い合わせ作成者本人向けの詳細取得・解決済み化 | 回答確認要件に対応 |
| `memorag-bedrock-mvp/apps/web/src/features/history/components/HistoryWorkspace.tsx` ほか | TSX/CSS | 履歴の返答状態バッジ | 履歴通知要件に対応 |
| `memorag-bedrock-mvp/apps/api/src/questions-access.test.ts` | Test | 作成者本人と別利用者の権限境界を検証 | 権限境界要件に対応 |
| `memorag-bedrock-mvp/docs/`、`README.md` | Markdown | 仕様・API・データ設計の更新 | Docs maintenance に対応 |

## 6. 検証

| コマンド | 結果 |
|---|---|
| `npm --prefix memorag-bedrock-mvp/apps/api run typecheck` | pass |
| `npm --prefix memorag-bedrock-mvp/apps/web run typecheck` | pass |
| `npm --prefix memorag-bedrock-mvp/apps/web run test -- src/api.test.ts src/App.test.tsx` | pass |
| `npm --prefix memorag-bedrock-mvp/apps/api test -- src/questions-access.test.ts src/contract/api-contract.test.ts src/security/access-control-policy.test.ts` | pass。npm script の glob により API 全 73 test を実行 |
| `npm --prefix memorag-bedrock-mvp/apps/web run build` | pass |
| `npm --prefix memorag-bedrock-mvp run lint` | pass |
| `git diff --check` | pass |

## 7. 指示へのfit評価

総合fit: 4.8 / 5.0（約96%）

理由: worktree 作成、回答確認導線、履歴通知、権限境界、検証、ドキュメント更新は完了。commit と PR 作成はこのレポート作成後に実施するため、レポート時点では未完了として明記した。

## 8. 未対応・制約・リスク

- `gh auth status` はローカル CLI token 無効だったため、PR 作成は GitHub Apps connector を優先する。
- 通知はポーリングによる UI 同期であり、リアルタイム push 通知ではない。
