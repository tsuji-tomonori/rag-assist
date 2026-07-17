# Issue #345 manual a11y evidence の honest contract を実装する

- 状態: do
- タスク種別: テスト・検証基盤
- 作成日: 2026-07-17
- 起点: PR #427 final head `c1afe64a`
- branch: `codex/issue-345-manual-evidence-contract`
- 関連要件: `NFR-018`, `AC-NFR018-005`, `AC-NFR018-007`, `SQ-016`, Issue #345

## 背景・目的

Issue #345 のmanual evidence taskは environment、date、persona、journey、viewport/zoom/input、result、evidence、defect/taskを求めるが、現在は文章 checklist だけで、未承認 matrix、未実施、blocked、fail、pass の必須根拠を機械検査できない。

manual evidence を実施したと仮定せず、欠落や虚偽 pass を拒否し、blocked を理由・owner status・next action 付きで保存できる executable contract を追加する。

## 対象範囲

- versioned manual evidence record と canonical schema/validator
- pass/fail/blocked/not_run/not_applicable の厳密な必須フィールド
- pass の environment/date/manual executor role/evidence 必須化
- fail の severity/owner/task/retest 追跡
- blocked/not_run の理由・owner assignment status・next action/open question 必須化
- manual keyboard、representative screen reader、実 browser zoom、real-device の現在の honest blocked baseline
- structural check と release/Issue completion 用 `require-pass` gate の分離
- `NFR-018`、UI design、manual evidence task への contract/evidence routing 追記

対象外:

- screen reader/device/browser matrix の owner 承認
- 実 screen reader、実 browser 200%/400% zoom、real-device の実測
- Firefox/WebKit required/scheduled scope の意思決定
- 未実施 evidence の pass 化
- merge、deploy、release

## 軽量なぜなぜ分析

### confirmed

- `AC-NFR018-005` は manual result に environment、date、scope、pass/fail、defect/task を求める。
- `AC-NFR018-007` は skipped/blocked/pending の理由と risk を求め、Issue full completion/merge-ready evidence にしない。
- `tasks/todo/20260714-issue-345-manual-a11y-evidence.md` は environment/date/persona/journey/viewport/zoom/input/result/evidence を求める。
- `OQ-UI-002` の representative screen reader/OS/browser/device matrix、cadence、owner は未承認。
- repository に manual a11y evidence 専用の versioned record validator はない。
- Chromium automation/AX tree/viewport proxy は実 screen reader/zoom/device evidence ではない。

### inferred

- structural validation と release readiness 判定を別 command にすれば、honest blocked baseline を通常 docs check で保持しつつ、full completion では非 0 にできる。
- evidence path と実施 environment がない pass を validator が拒否すれば、automation の誤った manual pass 化を検出できる。

### open_question

- `OQ-UI-002`: 承認する OS/browser/screen-reader/device matrix、cadence、evidence owner。
- `OQ-UI-001`: Firefox/WebKit の required/scheduled scope。
- privacy policy 上、manual executor の個人名ではなく role を記録する方針の owner 承認。

### 根本原因

manual evidence の必須属性と pass/blocker 境界は要件文章にはあるが、versioned data contract、negative fixtures、release readiness command へ落とし込まれていないため、各 PR/report の自由記述に依存している。

## 実装チェックリスト

- [x] current requirements/tasks/reports/config から confirmed/inferred/open question を分離する。
- [x] task/AC を実装前に固定する。
- [x] evidence record、validator、negative/positive tests を追加する。
- [x] honest blocked baseline と full-completion non-zero gate を追加する。
- [x] NFR/design/task/commands/docs を同期する。
- [ ] selected/full validation、report、Draft PR lifecycle、final-head CI、Issue #345 進捗まで完遂する。

## 受け入れ条件

- [x] AC1: evidence record は schema version、release/reference、scope、matrix approval status、environment、date、persona、journey、viewport/zoom/input、result、evidence/defect を表現できる。
- [x] AC2: `pass` は manual execution metadata、完全な environment、非空 evidence reference のどれかが欠けても拒否される。automation/proxy だけで manual pass にできない。
- [x] AC3: `fail` は severity、owner assignment status、defect/task、retest status を必須とする。
- [x] AC4: `blocked` / `not_run` は reason、risk、owner assignment status、next action、open question/task を必須とし、pass 集計に入らない。
- [x] AC5: current baseline は manual keyboard、representative screen reader、実 browser zoom、real-device を未実施/blocked と保存し、架空 environment/result を生成しない。
- [x] AC6: structural check は honest blocked baseline を有効とし、`require-pass` は required scope が未実施/blocked/fail なら非 0 終了する。
- [x] AC7: validator tests は valid pass、valid blocked、missing evidence、automation-only pass、fail 追跡欠落、duplicate ID、unknown status/version を覆う。
- [x] AC8: `NFR-018`、`DES_UI_UX_001`、manual task、package/Taskfile の command/evidence routing が同期する。
- [x] AC9: repository の他 UI/manual report を実施済みに書き換えず、Issue #345 全体を complete にしない。

## 実装・検証記録

- contract test: 7/7 pass。
- baseline structural check: pass。ただし summary は `pass=0`、`blocked=3`、`not_run=1`、`ready=false`。
- `require-pass`: 意図した終了コード 2 と拒否メッセージを確認。
- `npm run lint -- --no-cache`: pass。
- `npm run lint`: pass。
- semantic UI / UI trace / inventory freshness / RAG release source audit: pass。
- `task docs:check`: 初回は worktree の依存未導入により失敗。`npm ci` 後の再実行は pass。`npm ci` は既存 audit 8 件（low 2、moderate 1、high 5）を報告したが lockfile 変更はない。
- `npm run ci`: pass（API/Web/infra/benchmark tests、typecheck、build を含む）。
- E2E: production UI/runtime を変更していないため、この task では追加実行しない。manual screen reader/browser zoom/real-device は todo のまま。

## 検証計画

- manual evidence validator unit/CLI fixtures
- structural baseline check / expected `require-pass` non-zero result
- root lint / typecheck / tests / build
- `task docs:check`、source audit、pre-commit、diff check
- GitHub implementation/final-head CI

## ドキュメント保守計画

- 新しい要件は作らず、既存 `NFR-018` の測定・検証と `DES_UI_UX_001` の evidence policy に implementation routing を追記する。
- manual evidence の実測 task は todo のまま維持し、本 bounded task の contract 完了と分離する。
- README/API/OpenAPI/operations は product API/setup/operation を変えないため更新しない。

## PR レビュー観点

- blocked/not_run が structural pass を full-completion pass と誤認させないか。
- pass が automation attachment だけで作れないか。
- fail/defect/retest の trace が欠落しないか。
- unassigned owner/open question を架空の承認で埋めていないか。
- ordinary docs CI と release readiness gate の終了値が意図どおり分離されるか。

## リスク・rollback

- schema が必要以上の個人情報を要求しないよう、executor は個人名でなく role とする。
- release gate を ordinary PR CI へ即時 required 化すると known blocker で全 PR を止めるため、検査 command と判定 command を分ける。
- rollback は evidence contract/fixtures/commands/docs を同一単位で戻す。
- merge、deploy、release は行わない。

## Done 条件

- deliverables: evidence contract、validator/tests、honest blocked baseline、commands、docs、task/report、Draft PR が同じ stacked branch に揃う。
- validations: structural positive/negative tests、expected release gate failure、selected/full/final-head CI が意図どおりである。
- honesty: manual evidence は blocked のままであり、Issue #345 全体の完了は主張しない。
