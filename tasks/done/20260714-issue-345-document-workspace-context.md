# Issue #345 document workspace の情報設計と状態保持を完成する

状態: done

タスク種別: リファクタリング

## 背景

generated inventory で documents は 143 interaction を持つ最も高密度な領域で、primary/detail/risky action の優先度と query/filter/sort/selection/detail の復元契約が部分的である。

## 目的・対象範囲

`DocumentWorkspace` と document URL state を対象に、主要 job を中心とした progressive disclosure、現在 context、state restoration、extreme content handling を `FR-097`, `FR-098` に適合させる。

## 必要情報

- gap: `GAP-UI-005`
- 検証 ID: `E2E-UI-DOCUMENTS-001`
- 既存 document permission/lifecycle 要件と API を正とする
- 依存 draft PR: `#348`〜`#352`（base: `0d299f739072dff29f56dc00f38dcb18ed7dd5ef`）

## 作業前チェックリスト

- [x] 専用 worktree `issue-345-document-workspace-context` と branch `codex/issue-345-document-workspace-context` を #352 最新 commit から作成した。
- [x] `FR-097`, `FR-098` と documents の permission/lifecycle 要件・設計を確認した。
- [x] query/filter/sort/source/as-of/selection/detail の既存 URL/state contract と gap を inventory 化した。
- [x] reader/uploader/share-manager/reindex-operator の主要 job と action hierarchy を確定した。
- [x] 変更範囲に応じた unit/component/E2E/API/docs 検証を選定した。

## 作業前 inventory / 実装境界

| 観点 | 現状 | 本 milestone の対応 |
| --- | --- | --- |
| restorable state | folder/document/migration/query/type/status/group/sort は URL 化済み。page/pageSize は transient | page/pageSize を approved URL state に追加し、filter 操作時だけ page 1 へ説明可能に reset する。 |
| browser history | view 遷移は push だが document folder/detail selection は常に replace | 利用者が選択する folder/detail/migration は push、文字入力・filter・正規化は replace とする。 |
| invalid/obsolete/unauthorized context | route syntax は sanitize するが、取得後に存在しない ID/filter が説明なく残る | authorized catalog と capability だけで selection/filter を正規化し、識別子を再掲しない安全な理由を表示する。 |
| source/as-of/current context | stale panel 以外では source/as-of が見えず、active filters と件数は分散 | source、最終確認、current target、結果件数、active filters を context summary として表示する。 |
| operation hierarchy | upload は primary だが、各行の share/move/reindex/delete が同じ列・priority | 文書詳細を row primary action とし、管理操作を対象付き disclosure、危険操作を別 group に分離する。permission と risk label は隠さない。 |
| detail density / focus | reader/manager detail と raw technical metadata、ordinary/risky action が一括表示。drawer focus trap/return がない | reader/critical summary を常時表示し、technical metadata と management action を semantic disclosure 化する。Escape、focus trap/return を追加する。 |
| authorization / mock | API capability が action visibility の正本 | API route/schema/auth は変更せず、URL 値や client permission から protected data/capability を生成しない。 |

## 実装・検証選定

- URL parser/serializer/history mode/normalization の unit・hook test。
- documents context、page restoration、progressive disclosure、focus、zero/many/long/error/stale/read-only の component test。
- `E2E-UI-DOCUMENTS-001` として reload/back/forward/detail return、invalid selection normalization、many/long data、keyboard/axe を Chromium で検証する。
- Web focused/full coverage、semantic UI contract、lint/typecheck/build、API requirements/access-control static policy、docs/inventory check。
- 320/375/768/1280 viewport の automated reflow evidence は本 E2E に含め、200%/400% zoom、代表 screen reader、real device は横断 manual task の未実施 evidence として残す。

## Done 条件

- [x] 受け入れ条件を満たす document workspace context・progressive disclosure・state restoration が実装されている。
- [x] invalid/obsolete/unauthorized state、zero/many/long/error/stale を false data disclosure なしで検証できる。
- [x] authorization、RAG evidence lifecycle、No Mock Product UI の境界を弱めていない。
- [x] `FR-097`, `FR-098`, `DES_UI_UX_001`、traceability、必要な documents docs が実装と同期している。
- [x] 選定した lint、typecheck、test、build、E2E、docs check が成功し、未実施検証は理由付きで記録されている。
- [x] 日本語 commit、draft PR、受け入れ確認コメント、セルフレビュー、作業レポート、task の `done` 移動と lifecycle commit/push が完了している。

## 実行計画

1. reader/uploader/share-manager/reindex-operator の job/action hierarchy を定義する。
2. primary/detail/risky controls を permission と selection context で段階化する。
3. URL/state parser と visible filter/source/as-of/selection を同期する。
4. zero/many/long/error/permission/stale と keyboard/mobile を検証する。

## ドキュメントメンテナンス計画

`FR-097`, `FR-098`, `DES_UI_UX_001`、document design/API examples と generated inventory を同期する。操作削除ではなく発見性と hierarchy を変更した場合も記録する。

## 受け入れ条件

- [x] primary job/action と detail/risky action の reading/visual priority が区別される。
- [x] search/filter/sort/source/as-of/selection が可視で、reload/back/detail return 後に仕様どおり復元する。
- [x] invalid/obsolete/unauthorized state は protected data を示さず説明付きで正規化する。
- [x] 0件、多数件、長い名前、error/stale でも current target と primary action を失わない。
- [x] disclosure が permission、critical state、risk を隠さない。

## 検証計画

- URL/state/component unit test
- documents E2E、320/375/768/1280px visual、keyboard/axe/manual
- Web/API relevant tests、inventory/docs check

## 検証結果（2026-07-14）

- `npm run test:coverage -w @memorag-mvp/web`: 46 files / 366 tests passed。Statements 91.90%、Branches 85.34%、Functions 92.65%、Lines 94.76%。
- `node --import tsx --test --test-concurrency=1 src/rag/requirements-coverage.test.ts src/security/access-control-policy.test.ts`: 2/2 passed。
- `npm run test:e2e -w @memorag-mvp/web -- --grep @documents-workspace --project chromium`: 1 passed。
- `npm run test:e2e -w @memorag-mvp/web -- --grep @risky-operation --project chromium`: 1 passed。
- `npm run test:e2e -w @memorag-mvp/web -- --grep '管理系画面の visual regression' --project chromium --update-snapshots`: 1 passed。documents baseline を目視確認した。
- `npm run test:web-semantic-ui`: 1/1 passed。
- `task verify`: lint、全 workspace typecheck、全 workspace build passed。
- `task docs:check`: docs / OpenAPI / API code / web trace / web inventory / infra inventory / hidden Unicode check passed。
- `git diff --check`: passed。
- 200%/400% zoom、代表 screen reader、real device は本 milestone では未実施。Issue #345 の横断 manual evidence task で実施するため、documents 固有の完了 evidence には含めない。

## PR / lifecycle 結果

- 実装 commit: `500cc816`（`✨ feat(documents): 文書状態保持と情報階層を改善`）。
- draft PR: `#353`（main 向け、`semver:minor`）。
- 受け入れ確認コメント: `#issuecomment-4969402704`。5/5 達成を日本語で記録した。
- セルフレビューコメント: `#issuecomment-4969402866`。blocking 指摘なし、docs/test/認可/RAG/No Mock/dataset 固有分岐を確認した。
- GitHub Actions: `validate-semver-label` passed、`Lint, type-check, test, build, and synth` passed（5m45s）。条件付き `Explicit RAG candidate promotion gate` は skipped。
- 本 task の `done` 移動、参照更新、レポート更新を lifecycle commit として同 branch へ push する。

## PR レビュー観点

認可境界、共有/削除/reindex の意味、RAG evidence lifecycle、mock fallback、URL の機微情報を確認する。

## 未決事項・リスク

大規模 layout 変更は job 単位の複数 PR に分け、各 PR で操作到達性を維持する。
