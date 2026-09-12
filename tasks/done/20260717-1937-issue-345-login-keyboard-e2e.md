# Issue #345 login 前 keyboard-only journey を検証・修復する

- 状態: done
- タスク種別: 修正
- 作成日: 2026-07-17
- 起点: PR #423 final head `ac50cd5d`
- branch: `codex/issue-345-login-keyboard-e2e`
- 関連要件: `SQ-016`, `AC-SQ016-002`, Issue #345

## 背景・目的

Issue #345 は login を含む主要 journey の keyboard-only 完了を要求する。既存 evidence は login の visual、text spacing、zoom/reflow と、認証後 AppShell の navigation/skip link を扱うが、login form 自体の Tab order、visible focus、Enter submit、empty/rejected recovery を専用 contract として固定していない。

login 前画面を 320px / 1280px Chromium で keyboard-only 操作し、native form semantics と honest error stateを維持したまま、最初の入力から認証後 chat 到達までを検証可能にする。

## 対象範囲

- sign-in form の email/password/remember/submit/secondary action の native focus order
- login controls の明示的 focus-visible token
- empty submit の native validation と最初の invalid control への recovery
- rejected authentication の alert、form description、submit focus/retry contract の component test
- 320×720 / 1280×720 Chromium の keyboard-only E2E と evidence
- `SQ-016`、UI design、trace manifest、generated Web inventory/trace の同期

対象外:

- Cognito/Hosted UI/auth API の認証 semantics
- sign-up/confirmation/new-password journey 全体
- representative screen reader、実 browser 200%/400% zoom、real device、Firefox、WebKit
- 認証後 primary navigation、skip link、dialog focus、reduced motion の再実装

## 軽量なぜなぜ分析

### 問題文

2026-07-17 の PR #423 final head では、login form の keyboard-only journey を専用 E2E で検証しておらず、empty submit は required constraint を持たないため無反応で終了する。auth CSS は login control の focus-visible indicator を設計 token として固定していない。

### confirmed

- `LoginPage` は semantic `form`、label/accessible name、submit button、`role=alert` / `role=status` を持つ。
- sign-in の email/password input に `required` がなく、空の submit は `onSubmit` の早期 return となる。
- `auth.css` は login inputs/buttons/checkbox の `:focus-visible` rule を定義しない。
- component test は rejected auth の alert を確認するが、focus/retry/`aria-describedby` を固定しない。
- E2E は login を click/fill で通過するが、Tab order、Space/Enter、native invalid focus、focus indicator の専用 evidence がない。
- dialog focus は既存 tests/open #373、reduced motion は layout-stress、認証後 keyboard navigation は #396、skip link は #423 が担当する。

### inferred

- native `required` を付けると JavaScript 固有 error を増やさず、empty keyboard submit を最初の invalid inputへ fail closed に戻せる。
- explicit `:focus-visible` outline は browser default差を減らし、existing primary token と一貫した証跡にできる。
- rejected async auth は `role=alert` で通知し、submit focusを維持してcontrolsを再有効化すれば再試行可能である。

### open_question

- representative screen reader による alert 読み上げ順は未実測。
- Firefox/WebKit の native constraint validation と focus表示は未検証。
- 実 Cognito rejection はcredential/external stateを伴うため本 local E2E では行わず、component contract と既存 auth client test に分離する。

### 根本原因

login の visual/reflow evidence と認証後 keyboard evidence は追加されたが、pre-auth native form の keyboard acceptance を独立 E2E ID と trace gate に分けず、empty/error/focus の検出条件が欠落していた。

### 全影響範囲を覆う是正

- production form に native required constraints と explicit focus-visible style を追加する。
- component test で empty submit/rejected auth focus・alert・retryを固定する。
- desktop/mobile E2E で Tab/Space/Enter journey、focus indicator、containment、successful transitionを固定する。
- requirement/design/trace/generated evidenceを同じ単位で同期し、自動証跡がmanual/cross-browserを代替しないことを明記する。

## 実装チェックリスト

- [x] 既存 login/auth/E2E/docs と重複 PR を RCA する。
- [x] task/AC を実装前に固定する。
- [x] native validation と focus-visible remediation を最小差分で実装する。
- [x] component/E2E evidence を追加する。
- [x] SQ-016/design/trace/generated Web docs を同期する。
- [x] selected/full validation、Draft PR、semver、AC/self-review、report/task done、implementation-head CI まで完遂する。

## 受け入れ条件

- [x] AC1: 320px/1280px の最初の Tab から email→password→remember→submit→secondary action の順で到達できる。
- [x] AC2: keyboard focus は viewport 内で、3px 以上の existing primary token outline として可視である。
- [x] AC3: empty form の Enter submit は native validation で遮断され、emailへfocusし、架空 errorや認証 requestを生成しない。
- [x] AC4: email/password入力、Spaceでremember切替、password上のEnter submitでlocal authenticated chatへ到達する。
- [x] AC5: rejected auth は `role=alert` とform `aria-describedby`で関連付けられ、submit focusとretry可能controlsを維持する。
- [x] AC6: 320/1280でroot/form horizontal overflowを追加せず、focus targetが水平viewport内にある。
- [x] AC7: production UIにmock/demo fallback、架空user/count、認可/RAG/benchmark固有値を追加しない。
- [x] AC8: SQ-016、DES_UI_UX_001、trace manifest、generated Web inventory/traceが実装・testと同期する。
- [x] AC9: representative screen reader、実zoom、real device、Firefox/WebKitを未検証のままpassと表現しない。

## 検証結果（implementation commit 前）

- targeted LoginPage unit: 2 files / 9 tests pass
- `E2E-UI-LOGIN-KEYBOARD-001` targeted smoke: 1/1 pass
- Web unit: 61 files / 442 tests pass
- E2E smoke: 24/24 pass
- E2E all: 36/36 pass
- Web typecheck / lint / build: pass（build は既存の 500kB 超 chunk warning のみ）
- semantic UI / Web trace / Web inventory freshness: pass
- `task docs:check`: pass
- `npm run rag:release:source-audit`: dataset-specific branch 0 / artifact mismatch 0
- `npm run ci`: pass（contract 1、API 802、Web 442、infra 38、benchmark 102 tests）
- `git diff --check`: pass
- 未検証: representative screen reader、実 browser 200%/400% zoom、real device、Firefox、WebKit、actual Cognito rejection

## PR / lifecycle 証跡

- implementation commit: `d40d3fb3`
- Draft PR: #427 `♿ login前のkeyboard-only journeyを検証可能にする`
- base/head: `main` ← `codex/issue-345-login-keyboard-e2e`
- semver: `semver:patch` 1 件
- 受け入れ条件 comment: https://github.com/tsuji-tomonori/rag-assist/pull/427#issuecomment-5002466879
- セルフレビュー comment: https://github.com/tsuji-tomonori/rag-assist/pull/427#issuecomment-5002467740
- implementation-head MemoRAG CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29575196283 success
- semver validation: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29575208758 success
- PR 作成直後の semver run `29575196233` は label 付与前に起動して failure。`semver:patch` 付与後の再評価で success となった。
- GitHub Apps PR 操作 connector が利用できない実行環境のため、所定 fallback として `gh` を使用した。
- lifecycle commit push 後の final-head CI、Issue #345 進捗 comment、clean/upstream は branch の最終確認として実施する。

## 検証計画

- targeted LoginPage unit test
- `E2E-UI-LOGIN-KEYBOARD-001` targeted smoke
- required E2E smoke / full E2E
- Web full unit、typecheck、lint、build
- semantic UI、trace、inventory、docs check
- source audit、pre-commit、diff check、GitHub implementation/final-head CI

## ドキュメント保守計画

- `SQ-016`、`DES_UI_UX_001` と trace manifestへ専用 evidence ID/boundaryを追記する。
- canonical generatorでWeb inventory/traceを更新する。
- README/API/OpenAPI/operationsは公開API、setup、運用手順を変えないため更新しない。

## PRレビュー観点

- native required/keyboard semanticsをJavaScript独自validationで置換していないか。
- focus orderがDOM順と一致し、tabindex正値を導入していないか。
- focus indicatorが色だけでなくoutlineとして視認できるか。
- errorがrole alertとform descriptionへ結び付き、retryを妨げないか。
- E2E fixtureがtest serverに限定され、本番fallbackへ漏れていないか。

## リスク・rollback

- native browser validationの表示文言はbrowser/locale差があるため、E2Eはmessage文字列でなくinvalid/focus/request非発生を検証する。
- actual Cognito/screen reader/cross-browser/real-deviceは未検証として残す。
- rollbackはrequired/focus CSS/tests/docsを同一単位で戻す。
- merge、deploy、releaseは行わない。

## Done条件

- deliverables: native remediation、unit/E2E、docs/generated、task/report、Draft PRが同じstacked branchに揃う。
- validations: selected/full/implementation-head CIが成功し、blocking self-review指摘がない。
- lifecycle: done 移動を push した後、final-head CI、Issue #345 進捗、clean/upstream 一致を branch 最終確認で満たす。
- honesty: manual/screen-reader/actual browser/deviceを実施済みにしない。
