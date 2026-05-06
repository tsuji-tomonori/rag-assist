# 作業完了レポート

保存先: `reports/working/20260505-2148-review-request-changes-fix.md`

## 1. 受けた指示

- 主な依頼: PR レビューで Request changes 寄りとして指摘された境界条件を修正する。
- 成果物: 期限計算、月末日計算、自由入力 follow-up、mock computed fact 選択の修正と回帰テスト。
- 条件: CI が通っていても誤答しうる箇所を merge 前に解消する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `relative_policy_deadline` の判定 predicate を共通化する | 高 | 対応 |
| R2 | `calculation_unavailable` と `relative_policy_deadline` を同居させない | 高 | 対応 |
| R3 | `addMonths` の月末 overflow を clamp する | 高 | 対応 |
| R4 | 自由入力 context が無関係な次質問に漏れないようにする | 高 | 対応 |
| R5 | mock が usable computed fact を優先して選ぶようにする | 中 | 対応 |
| R6 | 指摘ケースの回帰テストを追加する | 高 | 対応 |

## 3. 検討・判断したこと

- 期限質問の判定は `isPolicyDeadlineQuestion` に集約し、`detectToolIntent` と `inferTemporalOperation` のズレをなくした。
- `execute-computation-tools` では `temporalOperation === "relative_policy_deadline"` の場合だけ資料由来 rule から computed fact を作り、通常の date calculation unavailable を混ぜないようにした。
- 月単位計算は JS Date の rollover に依存せず、target month の最終日に clamp する実装へ変更した。
- 自由入力 follow-up は seed と元質問を pending state に持ち、入力が standalone な新規質問らしく、元質問や seed と meaningful token を共有しない場合は context を clear する仕様にした。
- mock は `relative_policy_deadline` を優先し、それ以外も unavailable より usable fact を優先するようにした。

## 4. 実施した作業

- `computation.ts` に `isPolicyDeadlineQuestion` を追加し、期限・提出期限・締切表現を同じ temporal operation に統一。
- `execute-computation-tools.ts` の relative deadline rule pattern を `ヶ月`、空白、提出期限、締切、`開始日の1か月前までに申請` 形式へ拡張。
- `addMonths` を月末 clamp 実装に変更。
- `MockBedrockTextModel` の computed fact 選択を usable fact 優先に変更し、dead branch を削除。
- `useChatSession` に自由入力 context clear 判定を追加。
- API と web の回帰テストを追加。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | policy deadline predicate 共通化 | R1 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/execute-computation-tools.ts` | TypeScript | derived fact 限定実行、rule pattern 拡張、月末 clamp | R2, R3 |
| `memorag-bedrock-mvp/apps/api/src/adapters/mock-bedrock.ts` | TypeScript | computed fact 優先選択 | R5 |
| `memorag-bedrock-mvp/apps/web/src/features/chat/hooks/useChatSession.ts` | TypeScript | 自由入力 context 漏れ抑止 | R4 |
| API / web test files | Test | 指摘ケースの回帰 | R6 |

## 6. 検証

- `./node_modules/.bin/tsx --test apps/api/src/agent/computation.test.ts apps/api/src/agent/graph.test.ts apps/api/src/rag/text-processing.test.ts --test-name-pattern "relative policy|parental leave|mock model|addMonths|tool intent"`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- useChatSession.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run lint`
- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run build`

## 7. 指示へのfit評価

総合fit: 4.9 / 5.0（約98%）

理由: レビューの必須 4 点をすべて実装修正し、指摘された文言 variants、month-end、自由入力漏れ、mixed computed facts をテストで固定した。追加の大規模 benchmark は未実施だが、今回の境界条件修正に必要な API/web/build 検証は実施済み。

## 8. 未対応・制約・リスク

- 未対応事項: 大規模 benchmark は未実施。
- ドキュメント: API 形状の追加変更はなく、既存 PR で追加済みの `clarificationContext` API example で足りるため、durable docs の追加更新は行わなかった。
- リスク: 自由入力 context clear は UI 操作の意図推定を含むため、将来的には明示的な freeform mode 表示と cancel UI にするとさらに堅い。
