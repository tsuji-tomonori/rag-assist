# web lint ci fix report

## 受けた指示

- MemoRAG CI Result で `web Lint` が失敗しているため修正する。
- 対象失敗コマンド: `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`

## 要件整理

- CI と同等条件で web lint の失敗を再現する。
- ESLint 指摘の根本原因を修正する。
- web lint を pass させ、TypeScript/test/build への影響も確認する。
- 修正内容を commit/push して PR branch に反映する。

## 検討・判断

- `npm --prefix memorag-bedrock-mvp exec -- eslint apps/web ...` はこの環境では path 解決が CI とずれたため、CI 同等に `memorag-bedrock-mvp` を cwd にして再現した。
- 失敗原因は、type-only re-export/import、未使用 destructuring、hook dependency、Promise-returning handler の lint rule 違反だった。
- hook dependency に関しては単に依存配列へ追加すると関数 identity の変化で不要な再実行が起きるため、`useCallback` で必要な hooks の関数を安定化した。

## 実施作業

- `src/api.ts` の type-only re-export を `export type *` に変更。
- `AppShell.tsx` の未使用 import / destructuring を削除。
- `AppShell.tsx` の effect dependency と async refresh handler を ESLint ルールに合わせて修正。
- `useBenchmarkRuns` と `useConversationHistory` の refresh/history 操作関数を `useCallback` 化。
- `ChatView.tsx` と `AssigneeWorkspace.tsx` の type-only import を `import type` に変更。

## 検証結果

- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass, 7 files / 56 tests
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`: pass
- `git diff --check`: pass

## 成果物

- web lint CI 修正差分。
- 本レポート: `reports/working/20260503-1308-web-lint-ci-fix-report.md`

## fit 評価

- 総合fit: 5.0 / 5.0
- CI 失敗対象である web lint をローカル再現し、関連する web typecheck/test/build も確認済み。

## 未対応・制約・リスク

- GitHub Actions の再実行完了までは未確認。push 後に CI が再実行される想定。
