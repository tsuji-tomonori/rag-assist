# Issue #359 Phase 3a ConfirmDialog primitive 一本化

- 状態: do
- タスク種別: 修正
- 対象 issue: #359 Phase 3a
- 作業ブランチ: `codex/issue-359-confirm-dialog-unification`
- 起点: PR #367 final head `bc6455e0efe34d826079284f6dd5f0d6193cee0d`
- 先行 merge 条件: PR #367 が先に merge されること

## 背景・問題文

`apps/web/src/shared/ui/ConfirmDialog.tsx` と `apps/web/src/shared/components/ConfirmDialog.tsx` に同名 primitive が2実装あり、API、構造化 detail、error 表示、見出し要素、tone 指定が分岐している。両実装は同じ固定 DOM ID を使うため、複数 dialog が同時に存在する場合に accessible name / description の参照先が衝突する。focus / Escape / loading close policy のテストは `shared/components` 側の正常系1件に限られ、error announcement と loading 中の close 抑止が回帰検知されない。

## なぜなぜ分析 / RCA

### confirmed

- 同名 `ConfirmDialog` が `shared/ui` と `shared/components` に存在する。
- `shared/components` は admin 5箇所、history 1箇所、benchmark 2箇所から直接利用される。
- `shared/ui` は `DocumentConfirmDialog` adapter から利用される。
- 両実装とも `confirm-dialog-title` / `confirm-dialog-description` の固定 ID を使う。
- `shared/components` は `details?: string[]` を `":"` で分割し、`shared/ui` は `rows?: Array<{label,value}>` を受ける。
- `shared/ui` だけが `errorMessage` を `role="alert"` で描画する。
- 既存 unit test は initial cancel focus、Tab循環、Escape callback、unmount後focus restore の1件のみ。
- PR #338 は generated Web docs、PR #361 は `documents.css` / Playwright visual spec、PR #368 は App/auth paths を変更する。

### inferred

- primitive の置き場所と public API を決めずに各 feature 群へ導入したため、類似要件が別実装へ追加され同期しなかった。
- string detail の `":"` split は表示データと構造を混在させ、値自身に colon がある場合の不必要な解析を生む。
- 固定 ID と複数 dialog の契約をテストしなかったため、単体利用では見えない a11y 衝突が残った。

### open_question

- 同時に複数 dialog を表示する product flow は現状確認できない。ただし reusable primitive は複数 instance で ID 衝突しない必要があるため、発生有無に依存せず修正する。
- manual screen reader / real-device 実機確認は実行環境の可用性を検証時に判断し、未実施なら理由と残余リスクを記録する。

### root cause

ConfirmDialog の正本 layer、型付き API、accessibility lifecycle、回帰 test を一つの component contract として固定せず、feature 導入ごとに別 implementation を許したこと。

### 恒久対策

`shared/ui/ConfirmDialog` を唯一の primitive とし、構造化 `details` API、`useId`、focus / Escape / busy close / error announcement 契約を unit / integration test で固定する。全 direct consumer を正本 import と構造化 details へ移行し、duplicate component を削除する。generated Web inventory で component count と a11y metadata を同期する。

## 参照 graph

```text
shared/ui/ConfirmDialog (正本化)
├─ shared/ui/index.ts
│  └─ DocumentConfirmDialog (業務文言 adapter)
│     └─ DocumentWorkspace
├─ AdminUserPanel
│  ├─ status confirm
│  └─ role assignment confirm
├─ AliasAdminPanel
│  ├─ state command confirm
│  ├─ edit confirm
│  └─ publish confirm
├─ HistoryWorkspace
│  └─ history delete confirm
└─ BenchmarkWorkspace
   ├─ benchmark start confirm
   └─ benchmark cancel confirm

削除: shared/components/ConfirmDialog
```

## 現行 focus / close / announcement 契約

| 契約 | 現状 | Phase 3a |
| --- | --- | --- |
| initial focus | cancel button | cancel button。busy mount では focusable action がないため dialog container |
| Tab / Shift+Tab | first / last の端点循環 | children を含む有効 focusable 全体で循環 |
| focus restore | unmount 時に opener へ復帰 | opener が接続中の場合に復帰 |
| Escape | `busy=false` のとき cancel | 維持し unit test で busy 中抑止を固定 |
| cancel button | busy 中 disabled | 維持し loading / internal confirm 中 close を抑止 |
| backdrop | click close なし | 意図的に close なし |
| confirm | internal confirming で多重実行抑止 | 維持 |
| error | ui 側だけ `role=alert` | 正本 API に統合し unique ID / describedby / alert を固定 |

## 正本 API

- `title: string`
- `description: string`
- `details?: Array<{ label: string; value: ReactNode }>`
- `tone?: "danger" | "warning"`
- `confirmLabel?: string`
- `cancelLabel?: string`
- `loading?: boolean`
- `confirmDisabled?: boolean`
- `errorMessage?: string | null`
- `children?: ReactNode`
- lifecycle callback として `onCancel` / `onConfirm`

表示値はすべて props / API response / persisted state / explicit state に由来させ、production fallback の mock / demo 値を追加しない。

## 予定変更 path

### product

- `apps/web/src/shared/ui/ConfirmDialog.tsx`
- `apps/web/src/shared/ui/ConfirmDialog.test.tsx`（既存 test を移管・拡充）
- `apps/web/src/shared/components/ConfirmDialog.tsx`（削除）
- `apps/web/src/shared/components/ConfirmDialog.test.tsx`（ui test へ移管）
- `apps/web/src/features/admin/components/panels/AdminUserPanel.tsx`
- `apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx`
- `apps/web/src/features/history/components/HistoryWorkspace.tsx`
- `apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx`
- `apps/web/src/features/documents/components/workspace/DocumentConfirmDialog.tsx`

### generated / lifecycle

- `docs/generated/web-ui-inventory.json`
- `docs/generated/web-components.md`
- `docs/generated/web-accessibility.md`
- `docs/generated/web-features/*.md` の generator が更新する必要分
- 今回 task / 作業完了 report

## open PR 競合調査

| PR | changed path | 判断 |
| --- | --- | --- |
| #338 | `App.test.tsx`、chat/doc types、generated Web docs | product file 直接重複を避ける。generated Web inventory は同期必須のため競合リスクを明記 |
| #361 | `documents.css`、`visual-regression.spec.ts`、web package / Playwright config | 既存 CSS / E2E を変更せず、test は実行利用に限定 |
| #368 | App/auth/Login paths | 直接重複なし |

## 対象外 / Phase 3a 残差

- Icon / LoadingSpinner primitive 統合は独立差分として todo 化し、本 PR に混在させない。
- dialog 全般の visual redesign、CSS token 再設計
- API / authorization / RAG / benchmark evaluator の挙動変更
- PR #367 の merge
- merge / deploy / release

## 受け入れ条件

- [x] `shared/ui/ConfirmDialog` が唯一の production ConfirmDialog implementation で、`shared/components/ConfirmDialog*` が存在しない。
- [x] 全9 dialog 利用が正本 API を使い、admin / history / benchmark の string details が `{label,value}` へ移行される。
- [x] `DocumentConfirmDialog` は業務固有 title / description / details / child field を組み立てる薄い adapter として保持される。
- [x] component API は title / description / `ReactNode` value を持つ structured details / tone / labels / loading / disabled / error / children を提供する。
- [x] `useId` により複数 instance の title / description / error ID が重複しない。
- [x] initial focus、children を含む focus trap、unmount後restore、Escape close が unit test で固定される。
- [x] loading / internal confirming 中は Escape / cancel / confirm の多重操作で close・再実行されず、idle→busy 遷移時は disabled action から dialog container へ focus が退避する。
- [x] `errorMessage` は dialog description と関連付けられ、assistive technology に alert として通知される。
- [x] production 表示値は props / API / state 由来で、mock / demo fallback を追加しない。
- [x] generated Web inventory / a11y metadata が唯一 primitive と現在の line / state に同期する。
- [x] PR #338/#361/#368 と product file の直接重複がなく、generated docs の競合リスクを PR に記録する。
- [x] Web targeted tests、full coverage、typecheck、build、semantic / inventory / trace checks が成功する。
- [x] 対象 Playwright keyboard/dialog journey が実行可能なら成功し、不可なら理由と残余リスクを記録する。
- [x] root CI、docs check、pre-commit、`git diff --check` が成功する。
- [ ] 日本語 PR、受け入れ条件コメント、セルフレビュー、task done、report、final CI SUCCESS を完了する。

## Done 条件

- deliverables: 正本 primitive、全 consumer 移行、duplicate 削除、a11y regression tests、generated inventory、task/report/PR lifecycle
- validations: targeted → Web full → docs/semantic/inventory/trace → Playwright可否 → root CI → pre-commit → GitHub final CI
- completion: blocking / should-fix 指摘なし、未実施検証を明記、PR #367先行merge条件と Phase 3a 残差を PR に記載

## 実装計画

1. duplicate component test を正本側へ移し、期待 API / focus / busy / error / unique IDs の regression cases を先に固定する。
2. 正本 component を structured details と accessibility lifecycle に更新する。
3. admin / history / benchmark / document adapter を移行し、duplicate implementation を削除する。
4. Icon / LoadingSpinner の残差 todo を作成する。
5. generated Web inventory を更新し、全参照と no-mock / a11y を監査する。
6. targeted / full / docs / E2E / root validation を実行し、失敗を修復する。
7. report、commit、push、日本語 PR、受け入れ確認、セルフレビュー、task done、final CI まで進める。

## 検証記録

- targeted unit: 5 tests passed。初回は detail 内 link が input より先に focusable となる正しい DOM 順序に期待値を修正して再実行した。
- Web coverage: 61 files / 446 tests passed。statements 90.85%、branches 85.8%、functions 90.72%、lines 93.60%。
- Web typecheck / build: passed。Vite の既存 chunk size warning のみ。
- semantic / generated inventory / trace: passed。duplicate 削除後も旧 component を読む semantic test を、正本の契約と旧 path 不在を検証する形へ修復した。
- Playwright: `E2E-UI-SEMANTIC-001` と `E2E-UI-RISK-001` が Chromium で 2/2 passed。sandbox の tsx IPC socket `EPERM` 後、承認済み同一コマンドを sandbox 外で再実行した。
- `task docs:check`: passed。
- `npm run ci`: passed（API 801、Web 446、infra 38、benchmark 102 tests を含む）。
- 変更ファイル限定 `pre-commit run --files ...`: passed。
- `git diff --check`: passed。

## ドキュメント保守計画

component path と a11y metadata は generated Web inventory に同期する。公開 API、運用手順、product requirement は変わらず、ConfirmDialog の既存意図を一本化するため、durable product docs の追加要件は現時点で不要。generator 出力以外の docs 更新要否は最終差分で再確認する。

## PR review 観点

- dialog name / description / error の参照 ID が instance ごとに一意か
- destructive / high-impact action の対象・影響・回復条件が構造化 detail で維持されるか
- loading / confirming 中に close または二重 submit できないか
- children field の keyboard order と focus trap が維持されるか
- Document adapter が domain logic を primitive へ漏らしていないか
- generated inventory が duplicate component を残していないか
- mock data、権限境界変更、benchmark 固有分岐が混入していないか

## リスク

- `useId` で generated inventory の静的 name 推定は変わらない想定だが、line number churn が広がる可能性がある。
- PR #338 と generated Web docs が重複するため、#338 merge 後は generator 再実行が必要になる可能性がある。
- PR #367 未mergeでは base commit が main に存在しないため、本 PR は #367 先行merge blocker を持つ。
- manual screen reader / real-device は環境制約で未実施となる可能性がある。
