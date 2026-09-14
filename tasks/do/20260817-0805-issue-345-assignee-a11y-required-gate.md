# Issue #345 担当者対応のkeyboard・semantic証跡をrequired gateへ追加する

- 保存先: `tasks/do/20260817-0805-issue-345-assignee-a11y-required-gate.md`
- 状態: do
- タスク種別: 修正
- 関連 Issue: #345
- 更新対象 PR: #462

## 背景

Draft PR #462はcurrent `main@8e542b31`を祖先に含み、担当者対応の320 CSS px reflowとloading／error／permission／retryを自動検査している。一方、品質マトリクスでは担当者対応の`AC-SQ016-002`（keyboard）と`AC-SQ016-003`（支援技術semantics）が8画面中の残存automated blockerである。現行E2Eはnavigationから画面へ到達するだけで、問い合わせの絞り込み、選択、回答入力、一時保持をkeyboard-onlyで検査せず、Chromium AX tree契約にも担当者対応を含めていない。

## 目的

担当者対応の主要導線に3px focus indicatorと安定した名前付きlandmarkを提供し、keyboard-only操作とChromium accessibility tree契約をPR required gateへ追加する。自動証跡をrepresentative screen readerのmanual合格へ読み替えない。

## 対象範囲

- 担当者対応のworkspace、問い合わせ一覧、カンバン、選択中詳細、回答formのlandmark名
- toolbar、問い合わせ選択、回答入力、通知切替、一時保持の3px focus indicator
- `E2E-UI-KEYBOARD-NAV-001`と`E2E-UI-SR-SEMANTICS-001`の担当者対応scenario
- `SQ-016`、`DES_UI_UX_001`、machine-readable trace／quality matrix、正規生成文書
- 本task、spec analysis、作業レポート

## 対象外

- API、認証・認可、RAG回答contract、回答送信の業務契約
- loading／empty／error／permission／retryの既存契約変更
- Firefox／WebKit native accessibility tree、representative screen reader、実browser zoom、touch／実機
- FR-051、API C1、OQ-UI-002のowner判断
- merge、deploy、release、force-push、破壊的変更

## なぜなぜ分析

### 問題文

2026-08-17時点の担当者対応画面は、`SQ-016`が要求するkeyboard focus visibilityとaccessible name／role／stateについて、品質マトリクス上で自動証跡が`blocked`である。画面到達後の主要操作とAX treeがrequired gateに含まれないため、回帰をPR時に検出できない。

### 確認済み事実

- `keyboard-navigation.spec.ts`は担当者対応へのnavigation到達だけを検査し、画面内操作を検査していない。
- `screen-reader-semantics.spec.ts`はlogin、chat、documents、history、favorites、benchmark、profileを検査するが担当者対応を含めない。
- `questions.css`には担当者対応のtoolbar、card、answer form controlを対象にした3px `:focus-visible`規則がない。
- `AssigneeWorkspace.tsx`の回答formと選択中side panelは安定したaccessible nameを持たない。
- reflow、target size、resource状態は別のrequired証跡でautomated passである。

### 推定・未確認

- inferred: browser既定outlineだけでは、既存画面群が採用する3px focus indicator契約を一貫して満たさない。
- open_question: representative screen readerでの読み上げ順と操作感は承認済みmanual環境がなく未確認である。

### 根本原因

- 発生原因: 担当者対応のUI実装時に、画面固有のfocus-visible規則と名前付きlandmark契約が実装されなかった。
- 流出原因: required keyboard／AX E2Eの代表画面集合へ担当者対応が追加されず、navigation到達だけで画面内a11yを満たすように見えた。

### 修復方針と影響範囲

- production UIへ名前付きlandmarkと3px focus indicatorを追加して直接原因を除去する。
- keyboard-only journeyとChromium AX contractをrequired E2Eへ追加して流出原因を遮断する。
- 正本、trace、quality matrix、生成物を同期する。API、認可、RAG、既存resource状態契約は変更しない。

## 実行計画

1. task、正本、生成物、open PRとの境界を確定する。
2. 担当者対応のlandmarkとfocus-visibleを最小変更で修正する。
3. keyboard journeyとChromium AX contractを既存required E2Eへ追加する。
4. SQ-016、UI設計、trace、quality matrix、生成文書を同期する。
5. lint、Web typecheck、unit、対象E2E、docs checkを実行し、失敗時は修復・再実行する。
6. report、Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新し、final-head CIを確認する。

## ドキュメントメンテナンス計画

- `SQ-016`と既存UI設計を正本として更新し、新しい要件ファイルを作らない。
- authored trace／quality matrixを更新し、`docs/generated/`は正規generatorで再生成する。
- automationとmanual evidenceの境界を維持し、manual／overall statusは`blocked`のままにする。

## 受け入れ条件

### AC-20260817-001: 担当者対応の主要操作をkeyboard-onlyで完了できる

- Given 回答編集権限を持つ利用者が担当者対応を開く
- When ステータス絞り込み、検索、問い合わせ選択、回答入力、通知切替、一時保持をkeyboard-onlyで操作する
- Then DOM順に対象へ到達し、native keyで値と状態が更新され、各focus targetに3px indicatorが表示される
- Then 一時保持結果がvisible polite statusで確認できる

### AC-20260817-002: 担当者対応の意味構造をChromium AX treeで検査する

- Given 問い合わせが1件ある担当者対応を表示する
- When Chromium accessibility tree contractを取得する
- Then workspace、問い合わせ一覧、カンバンlane、選択中詳細、回答form、searchbox、combobox、selected question、notify checkbox、statusが安定したname／role／stateを持つ
- Then JSON evidenceをPlaywright reportへ保存する

### AC-20260817-003: 画面からE2Eまでを相互追跡する

- Given keyboard／semantic gateを追加した
- When 正本、authored JSON、生成文書を確認する
- Then `assignee → SQ-016 → AC-SQ016-002 / AC-SQ016-003 → E2E-UI-KEYBOARD-NAV-001 / E2E-UI-SR-SEMANTICS-001 → Chromium required`を追跡できる
- Then manual screen reader statusとoverall statusは`blocked`を維持する

### AC-20260817-004: 最小十分な検証とGitHub記録を完了する

- Given 実装と文書同期が完了した
- When 完了判定する
- Then lint、Web typecheck、Web unit、対象Chromium E2E、trace／semantic／manual evidence／docs checkが成功する
- Then Draft PR #462、受け入れ確認、セルフレビュー、Issue #345へfinal head、CI、未完了項目を記録する
- Then 未実施のmanual検証を実施済みと記載しない

## 検証計画

- `git diff --check`
- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- 対象Chromium E2Eのdiscovery／実走
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `npm run docs:manual-a11y-evidence:test`
- `npm run docs:manual-a11y-evidence:check`
- canonical／generated docs freshness checks

## PRレビュー観点

- focus indicatorがoverflowで隠れず、disabled controlへ誤適用されないか。
- landmark名が視覚見出しと一致し、重複／冗長なregionを作らないか。
- test fixtureがproduction fallbackへ混入していないか。
- 認可、private internal memo、回答送信契約、resource状態を弱めていないか。
- automationをmanual passへ読み替えていないか。

## 未決事項・リスク

- Chromium AX treeはrepresentative screen readerの実操作を証明しない。
- open PR #461と`AssigneeWorkspace.tsx`は同一pathだが変更hunkは別である。統合時は#461のshared UI importを保持し、今回のlandmark／ID変更を再適用して生成Web inventoryを最終sourceから再生成する。
- local browser／host service制約時はblockedを明記し、final-head GitHub Actionsを自動実走証跡とする。
- representative screen reader、実browser zoom、touch／実機、Firefox／WebKit native AX、FR-051、API C1、OQ-UI-002は未完了を維持する。

## CI修復記録

- initial Web UI Quality run `31979123888`は、追加した「担当者対応カンバン」が既存の画面到達locatorへ部分一致し、親workspaceとの2件一致でstrict-mode違反になった。
- Chromiumは36／37、Firefox／WebKitは16／18が成功し、失敗は同一locatorに限定された。
- product semantics、journey、state期待を緩めず、画面regionの既存assertionへ`exact: true`を追加して再検証する。
- second run `31979365958`でregion到達後、未対応filter中の回答入力により問い合わせが対応中laneへ移り、選択中formも消えるproduction defectを検出した。
- 選択中でdirtyまたは一時保持済みの問い合わせだけside panel contextを保持し、lane cardはfilterどおり非表示とする。回答入力／一時保持の到達性をunitとE2Eで再検証する。
- third implementation run `31979655720`はChromium 37／37、Firefox／WebKit 18／18で成功した。
- 同じheadのMemoRAG CI `31979655718`はlint、typecheck、unit、build、正本文書、trace、semanticを通過した後、上記production修正で行番号が変わった生成Web inventory 3件のfreshness差分だけで失敗した。正規generatorを再実行し、`--check`と`git diff --check`の成功を確認してfinal record headへ含める。
