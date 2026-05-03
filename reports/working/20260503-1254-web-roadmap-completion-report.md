# web component split roadmap completion report

## 受けた指示

- `memorag-bedrock-mvp/apps/web` の全体ロードマップ完了まで作業する。
- phase ごとに検証し、commit と push を行う。
- 最初に実行計画レポートを作成し、設計/実装/テストを一気通貫で行う。
- 完了後は main 向け PR を GitHub Apps で作成/更新する。

## 要件整理

- `App.tsx` の God Component 状態を解消し、App shell、routes、feature view、hooks に責務を分ける。
- `api.ts` と `styles.css` をドメイン単位に分割しつつ、既存 import 互換を保つ。
- Login/auth 周辺も page/form/visual/hook の責務分離を進める。
- 統合テストに加え、feature/component 単位のテストを追加する。
- phase ごとに少なくとも web typecheck/test を確認し、CSS/API 変更では build も確認する。

## 実施作業

### Phase 1: 計画

- `reports/working/20260503-1228-web-roadmap-completion-plan.md` を追加。
- 分割ロードマップ、Done 条件、phase 別検証方針を明文化。
- commit: `6ed7946 📝 docs(web): 分割ロードマップ完了計画を追加`

### Phase 2: App shell 分離

- `App.tsx` を認証ゲート中心へ薄くした。
- `app/AppShell.tsx` と `app/components/RailNav.tsx`、`TopBar.tsx` へアプリ枠を分離。
- commit: `883412a ♻️ refactor(web): AppShellへアプリ本体を分離`

### Phase 3: feature view/component 分離

- `app/AppRoutes.tsx` を追加し、画面切り替え責務を分離。
- chat/questions/admin/documents/debug/benchmark/history の view/component を feature 配下へ移動。
- commit: `b79f13e ♻️ refactor(web): 主要画面をfeatureコンポーネントへ分離`

### Phase 4: hooks 分離

- `useCurrentUser`、`usePermissions`、`useDocuments`、`useChatSession`、`useDebugRuns`、`useBenchmarkRuns`、`useQuestions`、`useConversationHistory`、`useAdminData` を追加。
- API 呼び出し、loading/error、refresh、mutation 系の副作用を feature hooks へ移動。
- commit: `4b29cc9 ♻️ refactor(web): 状態と副作用をfeature hooksへ分離`

### Phase 5: API/CSS 分割

- `shared/api/runtimeConfig.ts`、`shared/api/http.ts`、`shared/types/common.ts`、`shared/utils/fileToBase64.ts` を追加。
- feature ごとの API/types を `features/*/api` と `features/*/types.ts` に分割。
- `src/api.ts` は既存 import 互換の re-export 入口として維持。
- `styles.css` を import hub 化し、`styles/features/*`、`styles/layout.css`、`styles/globals.css`、`styles/responsive.css` へ分割。
- commit: `285091d ♻️ refactor(web): APIとCSSをドメイン単位へ分割`

### Phase 6: auth/test 仕上げ

- `features/auth/components/LoginPage.tsx`、`LoginHeroGraphic.tsx`、`features/auth/hooks/useAuthSession.ts` を追加。
- ルート `LoginPage.tsx` は互換 re-export に変更。
- `RailNav.test.tsx`、`LoginPage.test.tsx`、`DocumentWorkspace.test.tsx` を追加し、component 単位の検証を増やした。
- commit: `dc537cf ♻️ refactor(web): 認証画面分割とcomponent testを追加`

## 検証結果

- Phase 2:
  - `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
  - `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass, 4 files / 50 tests
  - `git diff --check`: pass
- Phase 3:
  - `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
  - `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass, 4 files / 50 tests
  - `git diff --check`: pass
- Phase 4:
  - `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
  - `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass, 4 files / 50 tests
  - `git diff --check`: pass
- Phase 5:
  - `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
  - `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass, 4 files / 50 tests
  - `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`: pass
  - `git diff --check`: pass
- Phase 6:
  - `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
  - `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass, 7 files / 56 tests
  - `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`: pass
  - `git diff --check`: pass

## 成果物

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/91
- 作業ブランチ: `codex/web-component-refactor`
- worktree: `.worktrees/web-component-refactor`
- 主な成果:
  - `App.tsx` の責務を auth gate へ縮小。
  - 画面・状態・副作用・API・CSS・auth を feature/shared 構成へ分離。
  - component tests を追加し、web test は 50 tests から 56 tests に増加。

## fit 評価

- 指示された全体ロードマップは Phase 1 から Phase 6 まで実施済み。
- phase ごとの検証、commit、push を実施済み。
- PR は GitHub Apps で作成済みの #91 を継続利用し、最終状態へ更新する。

## 未対応・制約・リスク

- UI の見た目は既存 CSS を順序保持で分割しており、デザイン変更は意図していない。
- `src/api.ts` は互換 re-export として残しているため、呼び出し側 import の完全な feature API 移行は今後段階的に進められる。
- README/docs の仕様変更は不要と判断した。今回の変更は内部構造リファクタで、利用手順や公開 API 挙動を変えていない。
