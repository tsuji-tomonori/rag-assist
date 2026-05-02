# 作業完了レポート

保存先: `reports/working/20260502-0000-questions-access-control-fix.md`

## 1. 受けた指示
- Aardvark が報告した脆弱性が HEAD に残っているか確認する。
- 残っている場合は最小修正で改善する。
- 既存機能・既存テストを保つ。

## 2. 要件整理
| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | HEAD で脆弱性の残存確認 | 高 | 対応 |
| R2 | 残存時の最小修正 | 高 | 対応 |
| R3 | 既存テストの維持確認 | 高 | 対応 |

## 3. 検討・判断したこと
- `authMiddleware` は `/questions*` に適用済みだが、`AUTH_ENABLED=false` の場合にローカル疑似ユーザーで全権限化される点と、ルートごとの権限チェック抜けが実害点と判断した。
- 既存設計に合わせ、`requirePermission` を不足ルートに追加する方針を採用した。
- 影響最小化のため、データモデルやストア層は変更せず、API ルートの認可チェックのみ追加した。

## 4. 実施した作業
- `memorag-bedrock-mvp/apps/api/src/app.ts` の `/questions` 作成ルートに `chat:create` 権限チェックを追加。
- `memorag-bedrock-mvp/apps/api/src/app.ts` の `/questions/{questionId}` 取得ルートに `answer:edit` 権限チェックを追加。
- API テストスイートを実行し、回帰がないことを確認。

## 5. 成果物
| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | `/questions` 系の欠落認可チェックを追加 | R2 |
| `reports/working/20260502-0000-questions-access-control-fix.md` | Markdown | 作業完了レポート | R1-R3 |

## 6. 指示へのfit評価
| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | 残存確認・修正・検証を実施 |
| 制約遵守 | 5/5 | 最小修正方針を維持 |
| 成果物品質 | 4/5 | ルート認可欠落は解消、より厳密な所有者制御は別途余地あり |
| 説明責任 | 5/5 | 判断理由と未対応リスクを明示 |
| 検収容易性 | 5/5 | 変更点と検証コマンドを明確化 |

**総合fit: 4.8 / 5.0（約96%）**

## 7. 未対応・制約・リスク
- 未対応: チケット作成者本人のみ閲覧可などの所有者ベース制御は未実装。
- 制約: 現行データモデルに userId 紐付けがないため、厳密な所有者判定は別変更が必要。
- リスク: `AUTH_ENABLED=false` 環境は引き続きローカル開発用の全権限挙動となる。

## 8. 次に改善できること
- `Question` に requester の userId を保持し、`get/list` を RBAC + ownership で制御する。
- Infra 側に Authorizer を導入し、防御を多層化する。
