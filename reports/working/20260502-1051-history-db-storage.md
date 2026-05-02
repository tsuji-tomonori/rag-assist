# 作業完了レポート

保存先: `reports/working/20260502-1051-history-db-storage.md`

## 1. 受けた指示

- 主な依頼: worktree を作成し、履歴機能をローカルキャッシュではなく DB に保持するよう修正する。
- 成果物: 実装差分、検証結果、git commit、main 向け PR。
- 形式・条件: PR 作成は GitHub Apps を利用する。作業後レポートを残す。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 専用 worktree で作業する | 高 | 対応 |
| R2 | 履歴の保存先をローカルキャッシュから DB へ移す | 高 | 対応 |
| R3 | DB 永続化に必要な API・infra・テストを更新する | 高 | 対応 |
| R4 | 検証を実施する | 高 | 対応 |
| R5 | commit と main 向け PR を作成する | 高 | 最終手順で対応 |

## 3. 検討・判断したこと

- 既存実装を確認し、担当者質問は `QuestionStore` 経由で DynamoDB/ローカルファイルに保存済みだが、会話履歴は `window.localStorage` の `memorag.chat.history` に保存されていると判断した。
- 本番環境は DynamoDB、ローカル開発・テストは JSON ファイルへ保存する既存パターンに合わせ、`ConversationHistoryStore` を追加した。
- 会話履歴はユーザー単位で分離するため、DynamoDB テーブルは `userId` を partition key、`id` を sort key とした。
- フロントは履歴一覧、保存、削除を API 経由に変更し、画面上の即時反映は既存 UX を保つため optimistic update とした。

## 4. 実施した作業

- `.worktrees/history-db` に `codex/history-db-storage` ブランチの worktree を作成。
- API に `/conversation-history` の GET/POST/DELETE を追加。
- `ConversationHistoryStore`、ローカル実装、DynamoDB 実装を追加。
- フロントの履歴保存を `localStorage` から API 呼び出しに切り替え。
- CDK に `ConversationHistoryTable` と Lambda 環境変数・権限を追加。
- API/Web/infra のテストとスナップショットを更新。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/adapters/conversation-history-store.ts` | TypeScript | 会話履歴ストアのインターフェース | DB 永続化に対応 |
| `memorag-bedrock-mvp/apps/api/src/adapters/dynamodb-conversation-history-store.ts` | TypeScript | DynamoDB 保存実装 | 本番 DB 保存に対応 |
| `memorag-bedrock-mvp/apps/api/src/adapters/local-conversation-history-store.ts` | TypeScript | ローカル開発用保存実装 | 既存ローカル検証に対応 |
| `memorag-bedrock-mvp/apps/web/src/App.tsx` | TypeScript/React | 履歴 API 利用への切り替え | ローカルキャッシュ廃止に対応 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | CDK | 会話履歴 DynamoDB テーブル追加 | DB 保持に対応 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | worktree 作成、DB 永続化、commit/PR 前提の準備を実施した |
| 制約遵守 | 5 | リポジトリ指定 skill とレポート作成ルールに従った |
| 成果物品質 | 4 | 既存構成に合わせたが、DynamoDB item size 上限に対する大容量履歴対策は今後の改善余地 |
| 説明責任 | 5 | 保存先の現状と変更方針、検証内容を明示した |
| 検収容易性 | 5 | CI と差分で確認可能な形にした |

総合fit: 4.8 / 5.0（約96%）

## 7. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`
- `npm --prefix memorag-bedrock-mvp/infra run typecheck`
- `npm --prefix memorag-bedrock-mvp/apps/api test`
- `npm --prefix memorag-bedrock-mvp/apps/web test`
- `npm --prefix memorag-bedrock-mvp/infra test`
- `npm run ci`（`memorag-bedrock-mvp`）
- `git diff --check`

## 8. 未対応・制約・リスク

- GitHub CLI の既存認証トークンは失効していたため、PR 作成は指定どおり GitHub Apps connector を利用する前提で進める。
- 会話履歴には回答結果やデバッグ情報も含まれるため、非常に大きい会話では DynamoDB の item size 上限に近づく可能性がある。
