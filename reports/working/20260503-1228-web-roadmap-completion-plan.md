# Web 分割ロードマップ完了計画

保存先: `reports/working/20260503-1228-web-roadmap-completion-plan.md`

## 1. 追加指示

- 前回 PR #91 の第1段階だけでなく、提示された全体ロードマップ完了まで進める。
- phase ごとにテスト確認を行い、commit する。
- 作業は既存の `codex/web-component-refactor` ブランチ上で継続する。

## 2. Done 条件

| ID | Done 条件 | 検証 |
|---|---|---|
| D1 | `App.tsx` が認証ゲート中心になり、アプリ本体は `app/AppShell.tsx` / `app/AppRoutes.tsx` に分離される | web typecheck/test |
| D2 | chat/questions/admin/auth の主要 JSX が feature 配下へ分離される | web typecheck/test |
| D3 | documents/debug/benchmark/history/questions/admin/chat の状態・副作用が hooks へ分離される | web typecheck/test |
| D4 | `api.ts` が互換 re-export を保ちながら shared/feature API に分割される | web typecheck/test |
| D5 | `styles.css` が global/layout/component/feature/auth CSS に分割される | web typecheck/test |
| D6 | feature/component 単位のテストが追加される | web test |
| D7 | 各 phase が commit/push 済みで PR #91 が最新になる | git status / PR compare |

## 3. Phase 計画

| Phase | 内容 | commit 方針 | 検証 |
|---|---|---|---|
| 1 | 詳細計画レポート作成 | docs commit | `git diff --check` |
| 2 | `AppShell` / `AppRoutes` / permission helper 分離 | refactor commit | web typecheck, web test, diff check |
| 3 | Chat / Questions / Admin / Auth コンポーネント分離 | refactor commit | web typecheck, web test, diff check |
| 4 | hooks 分離 | refactor commit | web typecheck, web test, diff check |
| 5 | API / CSS 分割 | refactor commit | web typecheck, web test, diff check |
| 6 | feature/component テスト追加、最終レポート、completion status 更新 | test/docs commit | web typecheck, web test, diff check |

## 4. 実装判断

- 一度に外部挙動を変えない。CSS クラス名、画面文言、API path は維持する。
- `api.ts` は既存 import を壊さないため、最終的に re-export ファイルとして残す。
- CSS は CSS Modules ではなく、短期移行しやすい `styles/` 分割を採用する。
- hooks は既存テストの振る舞いを保つため、最初はローカル state と API 呼び出しのまとまりをそのまま移す。
- 各 phase の終了時に `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web` と `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web` を実行する。
