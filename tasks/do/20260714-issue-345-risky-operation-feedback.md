# Issue #345 高影響操作の対象・影響・結果表示を統一する

状態: do

タスク種別: 機能追加

## 背景

削除、共有、権限変更、停止、無効化、公開、cutover、rollback の確認と結果が feature ごとに異なり、対象や回復可否を誤認するリスクがある。

## 目的・対象範囲

documents、questions、benchmark、admin の代表操作へ `FR-096` の confirmation/progress/result contract を適用する。domain mutation と API authorization は既存要件を正とする。

## 必要情報

- 要件: `FR-096`, `FR-066`, `FR-078`, `FR-080`, `FR-085`, `FR-086`
- 検証 ID: `E2E-UI-RISK-001`
- gap: `GAP-UI-004`
- 依存 PR: `#348`, `#349`, `#350`, `#351`（base: `f6c6e3eda7709332224fa13d2d13b5a8a99b1933`）

## 作業前チェックリスト

- [x] 専用 worktree `issue-345-risky-operation-feedback` と branch `codex/issue-345-risky-operation-feedback` を `#351` 最新 commit から作成した。
- [x] `FR-096` と受け入れ条件 `AC-FR096-001`〜`AC-FR096-005` を確認した。
- [x] 関連 domain 要件 `FR-066`, `FR-078`, `FR-080`, `FR-085`, `FR-086` と既存 mutation/auth 境界を確認する。
- [x] documents、history/questions、benchmark、admin の高影響操作と既存 feedback を inventory 化する。
- [x] 変更範囲に応じた component/API/access-control/E2E/docs 検証を選定する。

## 作業前 inventory

| 画面 / 操作 | 実装済み | gap と本タスクの代表適用 |
| --- | --- | --- |
| documents / 削除・共有・reindex 切替 | 対象・影響を示す確認、理由、重複送信防止、session 内の最近の操作がある | API 確定後の再読込失敗を mutation 失敗に見せる。`partial` / `unknown` と API 返却済み version・audit intent・operation ID を shared contract へ載せる。 |
| history / 会話削除 | 対象・復元不可の確認がある | API 応答前に行を削除し、失敗時も戻さない。確定応答後だけ削除し、処理中・失敗・結果不明を対象名付きで残す。 |
| benchmark / 実行・キャンセル | 起動確認はある | cancel が即時、global loading/error のみ。run ID・影響・再実行条件を確認し、対象 row に処理状態と結果を関連付ける。 |
| admin / user・role・alias publish/disable | user/role/publish/disable の確認はある | hook が error を吸収するため dialog が成功扱いで閉じる。代表操作の結果を返し、target・reason・API 返却 version/audit availability とともに表示する。 |

## 実装・検証選定

- shared operation outcome model / error classification / feedback component の unit・component test。
- documents、history、benchmark、admin の hook/component test（success、duplicate、known failure、timeout/network unknown、refresh partial）。
- `E2E-UI-RISK-001` として delete/share/cancel/publish の representative browser scenario と accessibility assertion。
- Web lint、typecheck、coverage、build、API requirements trace、既存 access-control static policy test、docs inventory/check。
- API route/auth contract は変更しない。既存 API が返さない actor/audit field は生成せず「API 応答で未提供」とする。

## Done 条件

- [x] 受け入れ条件を満たす shared confirmation/result contract と代表操作への適用が実装されている。
- [x] duplicate、timeout/unknown、partial result を false success/failure なしで検証できる。
- [x] authorization と情報非開示境界を弱めていないことを API/access-control review で確認している。
- [x] `FR-096`、`DES_UI_UX_001`、traceability、必要な domain/API docs が実装と同期している。
- [x] 選定した lint、typecheck、test、build、E2E、docs check が成功し、未実施検証は理由付きで記録されている。
- [ ] 日本語 commit、draft PR、受け入れ確認コメント、セルフレビュー、作業レポート、task の `done` 移動と lifecycle commit/push が完了している。

## 実行計画

1. 操作 inventory と recoverability/reason/audit metadata を棚卸しする。
2. target/effect/recovery/reason を持つ shared dialog/result contract を作る。
3. representative feature へ適用し duplicate/timeout/partial/unknown を扱う。
4. API contract/component/E2E/access-control review を行う。

## ドキュメントメンテナンス計画

`FR-096`, `DES_UI_UX_001` と各 domain requirement/API docs を同期する。表示できない audit field は架空値で補わず unavailable とする。

## 受け入れ条件

- [x] confirmation に利用者向け target、影響範囲、回復/取消条件、必要理由がある。
- [x] processing/success/failure/partial/unknown が affected item と関連付く。
- [x] duplicate submit を防ぎ、timeout を根拠なく成功/失敗に確定しない。
- [x] API が返す actor/result/version/audit reference を許可範囲で調査できる。
- [x] UI confirmation だけで authorization を成立させない。

## 検証計画

- dialog/result primitive component test
- delete/share/cancel/publish の representative E2E と cutover の component test
- API contract/access-control test と Web checks

## 検証結果

- `npm test -w @memorag-mvp/web -- <11 focused files>`: pass（11 files / 146 tests）。
- `npm run test:coverage -w @memorag-mvp/web`: 初回は追加結果 UI による既存 query 3 件の曖昧化を検出し、期待値と削除応答 fixture を修正後 pass（45 files / 357 tests、statements 91.81%、branches 85.23%、functions 92.71%、lines 94.69%）。
- `npm exec -w @memorag-mvp/web -- playwright test e2e/visual-regression.spec.ts --grep @risky-operation`: 通常 sandbox は `tsx` IPC socket の `EPERM`。ユーザー承認後の権限委譲で実行し、確認 detail assertion と最後の履歴削除後に結果が消える回帰を修復後 pass（Chromium 1 test）。
- `task verify`: pass（lint、全 workspace typecheck、全 workspace build）。Vite の既存 500 kB chunk warning と infra bundle size warning は非 blocking。
- `node --import tsx --test --test-concurrency=1 src/rag/requirements-coverage.test.ts src/security/access-control-policy.test.ts`（cwd: `apps/api`）: pass（2 tests）。
- `task docs:check`: pass（canonical docs、OpenAPI、API code docs、Web trace/inventory、infra inventory、hidden Unicode）。
- `npm run test:web-semantic-ui`: pass。
- `git diff --check`: pass。

## Security / access-control review

- API route、middleware、request/response schema、authorization policy は変更していない。
- UI の permission/capability は操作の表示制御に留め、server-side permission、resource guard、reason/version/audit contract を正本のまま維持した。
- actor、result、version、audit reference は API 応答にある値だけを表示し、未提供値を架空値で補わない。confirmed mutation 後の refresh error detail は developer log のみに残す。
- `apps/api/src/security/access-control-policy.test.ts` が pass し、保護 route の静的 policy に差分がないことを確認した。

## 未実施・制約

- 代表 screen reader、200%/400% browser zoom、real device、Firefox/WebKit は本 task では未実施。`tasks/todo/20260714-issue-345-manual-a11y-evidence.md` と cross-screen task の範囲として残す。
- 全 feature の risky operation exhaustive coverage は主張しない。questions、documents IA、admin remaining operations は既存の後続 task へ trace した。
- API 実装を変更していないため API 全 suite は選定せず、requirements coverage と access-control static policy を実行した。

## PR レビュー観点

対象取り違え、不可逆性、permission 非開示、audit detail、No Mock Product UI を確認する。

## 未決事項・リスク

API が idempotency/result reference を返さない操作は、UI だけで完了扱いにせず API task を分離する。
