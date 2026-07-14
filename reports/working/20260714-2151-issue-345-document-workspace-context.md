# Issue #345 文書ワークスペース状態保持・情報設計 作業レポート

## 受けた指示

- GitHub Issue #345 の全体完了まで継続して作業する。
- Repository Agent Instructions に従い、専用 worktree、task、実装・検証、日本語 commit、main 向け draft PR、受け入れ確認、セルフレビュー、task lifecycle まで進める。
- 本 milestone では `FR-097`、`FR-098` の document workspace に残る状態復元と高密度 UI の gap を解消する。

## 要件整理

- folder/document/migration に加え、folder search、文書検索・filter・sort、page/pageSize を正規 URL state として復元できること。
- current target、selection、result count、source、as-of、active filter を同じ文脈で確認できること。
- invalid/obsolete/unauthorized な URL state は authorized catalog と capability を正として、protected identifier を本文へ再掲せず正規化すること。
- 行の primary action、詳細、管理操作、高影響操作を段階化しつつ、permission、critical state、risk の意味を隠さないこと。
- zero/many/long/error/stale、keyboard、狭幅、axe を自動検証し、未実施の manual evidence を成功扱いしないこと。

## 検討・判断

- 利用者が明示的に選択する folder/document/migration/page は browser history の `push`、文字入力・filter・sort・page size・正規化は `replace` とした。
- URL syntax の許可と、取得済み authorized catalog に基づく値の妥当性を分離した。catalog 確定前は選択や page を破棄せず、確定後だけ安全な既定値へ正規化する。
- 文書行の primary action は「詳細」に限定した。share/move と reindex/delete は詳細ドロワー内の管理 disclosure に移し、高影響操作を別 group にした。
- source/as-of は production fallback で捏造せず、`UiResourceState` の target と取得時刻だけを表示した。
- API route、schema、認証・認可、RAG evidence lifecycle は変更せず、既存 capability を操作可視性の正本に維持した。

## 実施作業

- document URL state に `folderQuery`、`page`、`pageSize` と history mode を追加し、parser/normalizer/hook/component test を拡充した。
- authorized document/group/migration catalog と管理 capability に基づく URL state 正規化 module と安全な通知を追加した。
- current target、selection、件数、source、as-of、active filter、reset を文書一覧上部に追加した。
- 文書一覧を primary detail action 中心に再編し、technical/quality と management action を semantic disclosure 化した。
- 詳細ドロワーに初期 focus、Tab trap、Escape close、呼び出し元への focus return を追加した。
- 320/375/768/1280px の reflow と長いファイル名へ対応し、documents の visual baseline を更新・目視確認した。
- `E2E-UI-DOCUMENTS-001` を実装し、reload/back/forward/detail return、権限外 URL、many/long、focus、axe、狭幅 overflow を検証した。
- `FR-097`、`FR-098`、`DES_UI_UX_001`、requirements coverage、UI traceability と generated web inventory を同期した。
- 新導線に合わせて既存 risky-operation E2E と `App.test.tsx` の削除・再インデックス統合テストを更新した。

## 成果物

- 実装: `apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- 状態正規化: `apps/web/src/features/documents/components/workspace/documentWorkspaceState.ts`
- UI: `DocumentFilePanel.tsx`、`DocumentDetailDrawer.tsx`、documents/responsive CSS
- routing: `apps/web/src/app/routing/appRoute.ts`、`apps/web/src/app/hooks/useAppShellState.ts`
- test: component/unit/App integration、`apps/web/e2e/visual-regression.spec.ts`、documents visual snapshot
- docs/trace: `REQ_FUNCTIONAL_097.md`、`REQ_FUNCTIONAL_098.md`、`DES_UI_UX_001.md`、`tools/web-inventory/ui-traceability.json`、generated web inventory
- task: `tasks/done/20260714-issue-345-document-workspace-context.md`

## 検証結果

- `npm run test:coverage -w @memorag-mvp/web`: 46 files / 366 tests passed。Statements 91.90%、Branches 85.34%、Functions 92.65%、Lines 94.76%。
- Web focused: routing/hook/state/workspace 94 tests passed、`App.test.tsx` 41 tests passed。
- API requirements/access-control policy: 2/2 passed。
- `E2E-UI-DOCUMENTS-001 @documents-workspace`: Chromium 1 passed。
- `E2E-UI-RISK-001 @risky-operation`: Chromium 1 passed。
- 管理系 visual regression snapshot update: Chromium 1 passed。更新した documents baseline を目視確認済み。
- `npm run test:web-semantic-ui`: 1/1 passed。
- `task verify`: lint、全 workspace typecheck、全 workspace build passed。初回 typecheck が drawer ref 型不一致を検出し、`HTMLDivElement` へ修正後に全体を再実行して成功した。
- `task docs:check`: docs/OpenAPI/API code/web trace/web inventory/infra inventory/hidden Unicode check passed。
- `git diff --check`: passed。

## 指示への fit 評価

- 受け入れ条件5項目は自動テスト、E2E、視覚確認、docs/trace 同期で満たした。
- No Mock Product UI: production 表示値は props/API/resource state/capability に限定し、30件・長い名前などの固定値は E2E fixture 内だけに置いた。
- Security: URL 値から権限や protected data を生成せず、catalog 外の識別子を通知へ含めない。API route/schema/auth の変更はなく、静的 access-control policy test は成功した。
- RAG quality: evidence lifecycle、retrieval、benchmark 期待語句、QA/dataset 固有分岐には変更を加えていない。
- Documentation: code と `FR-097`、`FR-098`、`DES_UI_UX_001`、traceability、generated inventory を同期した。README/API/運用手順へ影響する契約変更はないため、それらは更新していない。

## PR / lifecycle

- 実装 commit `500cc816` を push し、GitHub Apps で main 向け draft PR `#353` を作成した。
- `semver:minor` label、受け入れ確認コメント `#issuecomment-4969402704`、セルフレビューコメント `#issuecomment-4969402866` を日本語で記録した。
- GitHub Actions は `validate-semver-label` と `Lint, type-check, test, build, and synth` が成功した。条件付き `Explicit RAG candidate promotion gate` は skipped で、必須 check は成功している。
- task を `tasks/done/` へ移し、状態・参照・本レポートを lifecycle commit で更新した。

## 未対応・制約・リスク

- 200%/400% browser zoom、代表 screen reader、real device は未実施であり、Issue #345 の横断 manual evidence task に残す。
- Firefox/WebKit の本 E2E は本 milestone で未実施。Chromium と component/unit/axe を証拠とし、browser 横断 gate は後続 task で扱う。
- Issue #345 全体は document milestone 後も chat/assignee、admin、cross-screen/manual/gate の後続作業が残る。
