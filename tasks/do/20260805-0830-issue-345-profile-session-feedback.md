# Issue #345: 個人設定のsession scopeと変更結果を明示する

保存先: `tasks/do/20260805-0830-issue-345-profile-session-feedback.md`

状態: do

タスク種別: 修正

## 背景

個人設定の「送信キー」は`useChatSession`のReact stateだけで管理され、API/storeへ永続化されない。
一方、現在の`PersonalSettingsView`は設定の有効範囲を説明せず、変更後の結果も画面またはlive regionで通知しない。
利用者は保存済み設定と誤認でき、screen reader利用者は値変更後の適用結果を確認しにくい。

`FR-051`の本人境界を持つ永続設定API/storeはplanningであり、本taskでは実装・owner判断を先取りしない。

## 原因分析（なぜなぜ）

### 問題文

2026-08-05時点の個人設定画面では、送信キーを変更しても、有効範囲と適用結果を利用者が画面上または支援技術で確認できない。

### 確認済み事実

- `PersonalSettingsView`は`submitShortcut`とsetterを受け取り、説明文・`aria-describedby`・status messageを持たない。
- `submitShortcut`は`useChatSession`の`useState("enter")`であり、永続API/storeを呼ばない。
- `tasks/todo/20260713-2301-user-preferences.md`は`FR-051`の永続化を未実装として追跡している。
- `profile / AC-SQ016-007`はownerによるN/A / mutation feedback / persistence判断待ちでblockedである。
- open PR #461はshared UI componentsを変更するが、`PersonalSettingsView.tsx`は変更しない。

### 推定・未確認

- 推定: 設定UIが先に最小実装され、session scopeを利用者へ伝える表示契約と回帰テストが追加されなかった。
- 未確認: `FR-051`で採用する永続化方式、保存失敗/retry/permission契約、owner、期限。

### 根本原因

未永続のclient stateと、利用者へ見せる「個人設定」という保存を想起させる表現の間に、scopeを正直に開示するUI契約とテストがない。

### 対策と対象範囲

- 送信キーfieldへsession-onlyの説明を関連付ける。
- 値変更時に選択値と有効範囲をpolite statusで通知する。
- required E2Eで説明、status、同一session内の画面往復保持を検証する。
- 永続化・owner判断・remote loading/error/permission/retryを実装済み扱いにしない。

## 目的

現在の実装境界をUIで正直に伝え、送信キー変更の結果を視覚・screen reader双方で確認可能にする。

## 対象範囲

- `apps/web/src/app/components/PersonalSettingsView.tsx`
- 個人設定のunit testと`E2E-UI-STATE-001`
- `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- UI品質マトリクス、traceability、生成文書
- completion status、task、report、Draft PR #462、Issue #345

## 方針

- native `select`を維持し、説明は`aria-describedby`で結ぶ。
- 変更結果はvisible textかつ`role="status"` / polite live regionで通知する。
- 本人設定API、localStorage、cookie等の新しい永続層を追加しない。
- `profile / AC-SQ016-007`はautomated / manual / overallともblockedを維持し、今回の限定証跡だけをnoteへ追記する。

## 必要情報

- current `main@0771521c`、Draft PR #462 head `5bfb6faa`、Issue #345。
- `FR-051`、`SQ-016`、`DES_UI_UX_001`、UI品質マトリクス。
- `tasks/todo/20260713-2301-user-preferences.md`。

## 実行計画

1. session scope説明と変更statusを`PersonalSettingsView`へ追加する。
2. unit / required E2Eでfield関連付け、通知、同一session内保持を検証する。
3. 正本、matrix、trace、生成物を限定証跡へ同期する。
4. 最小十分なlint / typecheck / unit / build / E2E / docs checksを実行する。
5. report / commitを作成し、Draft PR #462、受け入れ条件、セルフレビュー、Issue #345を更新する。

## ドキュメントメンテナンス計画

- `SQ-016`と`DES_UI_UX_001`へsession-only説明・変更status・未完了境界を追記する。
- authored JSONを更新し、正規generatorでWeb生成文書を同期する。
- `FR-051`自体は永続化要件を変更しないため更新せず、既存todoを参照する。
- README / API / OpenAPI /運用文書はAPI・永続化・運用契約を変更しないため対象外とする。

## 受け入れ条件

- [x] 送信キーfieldに、現在のサインイン中だけ有効で再読み込み/再サインイン時に既定値へ戻る説明がprogrammatically関連付く。
- [x] 値変更時に、選択した送信キーとsession-only scopeをvisible polite statusで通知する。
- [x] 同一session内でチャットへ戻って個人設定を開き直したとき、選択値を維持する。
- [x] page reload後は説明どおり既定の`Enterで送信`へ戻る。
- [x] unit testとrequired `E2E-UI-STATE-001`が上記契約を検証する。
- [x] `profile / AC-SQ016-007`をpassへ昇格せず、永続化・remote state・manual検証・owner判断をblockedとして維持する。
- [x] 正本、machine-readable matrix / trace、生成文書が同じ証跡と未完了境界を参照する。
- [x] 選定したlint、typecheck、unit、build、E2E、docs checksが成功するか、実行不能理由を未完了として記録する。
- [ ] Draft PR #462、受け入れ条件、セルフレビュー、Issue #345へfinal-head結果を記録する。

## 検証計画

- targeted `PersonalSettingsView` unit test。
- required Playwright listing / targeted Chromium / Web UI Quality CI。
- Web lint / typecheck / unit / build。
- UI trace、semantic UI、generated inventory、canonical docs、manual evidence structure、hidden Unicode、`git diff --check`。
- final-head MemoRAG CI / semver。

## PRレビュー観点

- session-only scopeが現在の実装事実と一致し、永続保存済みと誤解させないこと。
- `aria-describedby`とstatusがnative selectのname / valueを壊さないこと。
- change eventのたびに冗長またはassertiveな通知を行わないこと。
- `FR-051`の本人境界、永続化、失敗/retry契約を本taskで仮決定しないこと。
- 認可、RAG根拠性、benchmark固有分岐へ影響しないこと。

## 未決事項・リスク

- 未決: `FR-051`の永続化方式、API authorization/store、保存失敗/retry/permission契約、owner、期限。
- 未完了: representative screen reader、実browser 200%/400% zoom、touch / real device、Firefox / WebKit。
- 決定事項: 今回はsession scopeの正直な表示と変更通知だけを扱い、`profile / AC-SQ016-007`全体はblockedを維持する。
- 禁止: merge、deploy、release、force-push、破壊的変更は行わない。

## 2026-08-05 ローカル検証

- pass: targeted unit（2 files / 9 tests）。初回はhelp textがaccessible nameへ混入する欠陥を検出し、label/help構造を分離後に成功。
- pass: repository lint、Web typecheck、Web unit（62 files / 446 tests）、Web build（既存chunk-size advisoryのみ）。
- pass: required Playwright listing（37 tests）。
- blocked: targeted Chromium実走。sandboxが`tsx` IPC listenerを`EPERM`で拒否し、API起動前に停止。
- pass: canonical、OpenAPI、API code docs（98 APIs / 588 docs）、UI trace（13）、semantic（5）、manual evidence structure（7）、Web/infra inventory、hidden Unicode、`git diff --check`。
- readiness false: manual evidenceはpass 0 / blocked 3 / not_run 1。
- unavailable: `task` CLI。確認済み`docs:check`の下位コマンドを直接実行。

taskはfinal-head CI、PR/Issue更新、owner/manual/API C1 gapが未完了のため`do`を維持する。
