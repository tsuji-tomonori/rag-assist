# web review followups report

## 受けた指示

- PR #91 のレビュー指摘について、必須・強く推奨・後続でもよい項目まで含めて対応する。

## 要件整理

- 必須 blocker:
  - web lint failure を解消した状態を維持する。
  - `useChatSession.canAsk` に `loading` guard を戻す。
  - debug trace / pending 状態が `latestTrace` と `pendingDebugQuestion` を正しく見るように配線する。
- 強く推奨:
  - feature hooks の root `api.ts` 依存を feature API / shared utils へ直接寄せる。
  - `AppShell` の巨大 orchestration と props pack を整理する。
  - `ChatView.tsx` 内の小コンポーネントを別ファイル化する。
- 後続でもよい:
  - `authClient.ts` の実体を auth feature 配下へ移す。
  - CSS は CSS Modules ではなく、既存の feature-scoped CSS 方針を維持する。

## 実施作業

- `useChatSession` に `loading` input を追加し、`canAsk` と `onAsk` の二重送信 guard に反映。
- `useDebugRuns` を state hook と `useDebugSelection` に分割し、`AppShell` 側で chat の `latestTrace` / `pendingDebugQuestion` を渡す構成へ修正。
- `useChatSession.test.ts` と `useDebugRuns.test.ts` を追加し、loading guard と pending debug selection を検証。
- feature hooks/components/shared utils の import を root `api.ts` から feature API/types/shared API へ直接移行。
- `AppRoutesProps` を export し、`useAppShellState` に orchestration と props pack を移動。`AppShell.tsx` は rail/topbar/routes の JSX 中心へ縮小。
- `ChatView.tsx` から以下を分割:
  - `ChatComposer.tsx`
  - `MessageList.tsx`
  - `MessageItem.tsx`
  - `UserPromptBubble.tsx`
  - `AssistantAnswer.tsx`
  - `ChatEmptyState.tsx`
  - `ProcessingAnswer.tsx`
  - `QuestionEscalationPanel.tsx`
  - `QuestionAnswerPanel.tsx`
  - `utils/getLinkedQuestion.ts`
  - `utils/questionDefaults.ts`
- `authClient.ts` の実体を `features/auth/api/authClient.ts` へ移動し、root `authClient.ts` は互換 re-export に変更。

## 検証結果

- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass, 9 files / 58 tests
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`: pass
- `git diff --check`: pass

## 成果物

- review follow-up 修正差分。
- 本レポート: `reports/working/20260503-1414-web-review-followups-report.md`

## fit 評価

- 総合fit: 5.0 / 5.0
- 必須 blocker、強く推奨項目、後続でもよい項目まで実装または既存方針に沿って対応済み。

## 未対応・制約・リスク

- CSS Modules への全面移行は実施していない。既存 CSS の class contract と cascade を壊さないため、今回の PR で既に入っている feature-scoped CSS 分割を維持した。
- GitHub Actions の再実行完了までは未確認。push 後に CI が再実行される想定。
