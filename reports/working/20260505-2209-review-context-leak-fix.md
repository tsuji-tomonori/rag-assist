# 作業完了レポート

保存先: `reports/working/20260505-2209-review-context-leak-fix.md`

## 1. 受けた指示

- 主な依頼: 再レビューで Request changes とされた残り 2 点を修正する。
- 成果物: document verification 系を relative policy deadline 計算から除外し、freeform context clear を語単位にする実装と回帰テスト。
- 条件: 実利用で誤動作しやすい境界条件を merge 前に解消する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 文書確認系質問を `relative_policy_deadline` 計算から除外する | 高 | 対応 |
| R2 | freeform context の共有判定を文字単位から語単位にする | 高 | 対応 |
| R3 | generic term 共有だけでは context を保持しない | 高 | 対応 |
| R4 | 指摘ケースの回帰テストを追加する | 高 | 対応 |

## 3. 検討・判断したこと

- `detectToolIntent` では既に `asksDocumentVerification` があるため、`asksPolicyDeadlineCalculation` を `!asksDocumentVerification` でガードした。
- `inferTemporalOperation` 側でも document verification を除外し、`needsTemporalCalculation=false` でも operation だけ残る状態を避けた。
- freeform context の token は NFKC 正規化後、2 文字以上の漢字・カタカナ run と 3 文字以上の ASCII token に限定した。
- `申請`、`期限`、`申請期限` などの generic term は除外し、汎用語だけの共有では pending context を維持しないようにした。

## 4. 実施した作業

- `computation.ts` の policy deadline intent 判定に document verification 除外を追加。
- `computation.test.ts` に「資料に書かれていますか」「規程に記載されていますか」系の回帰を追加。
- `useChatSession.ts` の `meaningfulTokens` を文字単位から語単位へ変更し、generic term 除外を追加。
- `useChatSession.test.ts` に「経費精算の申請期限は？」が freeform context を送らない回帰を追加。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | document verification 除外 | R1 |
| `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts` | Test | document verification 回帰 | R1, R4 |
| `memorag-bedrock-mvp/apps/web/src/features/chat/hooks/useChatSession.ts` | TypeScript | 語単位 token と generic term 除外 | R2, R3 |
| `memorag-bedrock-mvp/apps/web/src/features/chat/hooks/useChatSession.test.ts` | Test | generic term 共有のみの context leak 回帰 | R2, R3, R4 |

## 6. 検証

- `./node_modules/.bin/tsx --test apps/api/src/agent/computation.test.ts --test-name-pattern "relative policy|document verification"`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- useChatSession.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run lint`
- `git diff --check`

補足: API/web full test は一度並列実行時に local server readiness / test timeout で失敗したため、単独で再実行して pass を確認した。

## 7. 指示へのfit評価

総合fit: 4.9 / 5.0（約98%）

理由: 再レビューの残り 2 点を実装とテストで固定し、関連する targeted と full test、typecheck、lint、差分チェックを通した。build は前回レビュー対応後に pass 済みで、今回の差分は API intent と web hook/test に限定されるため再実行していない。

## 8. 未対応・制約・リスク

- 未対応事項: 大規模 benchmark は未実施。
- ドキュメント: API 形状やユーザー向け手順の追加変更はないため、durable docs は更新しなかった。
- リスク: freeform context clear は引き続きヒューリスティックであり、将来的には UI 上の明示モードと cancel 導線を追加するとさらに堅い。
