# Issue #345: チャットの状態・権限証跡を required gate へ追加する

保存先: `tasks/do/20260804-0832-issue-345-chat-state-required-gate.md`

状態: do

タスク種別: 修正

## 背景

Issue #345 と Draft PR #462 は、8 AppViews のUI品質証跡をrequired Chromium gateへ収束している。
2026-08-04時点で `chat / AC-SQ016-007` は、初期案内、送信中、SSE再接続、失敗、権限不足を
画面境界で結ぶrequired E2Eがなく、automated statusが`blocked`のままである。

## 原因分析（なぜなぜ）

### 問題文

チャットは処理中live status、自動SSE再接続、安全な共通エラーを実装している一方、
`chat:create`がない利用者には送信buttonをdisabledにするだけで理由を表示せず、
状態遷移と認可境界をrequired実ブラウザ検査で回帰検出できない。

### 確認済み事実

- `useChatSession` は処理中表示、SSE timeout / disconnect時の最大3回再接続、`Last-Event-ID`引き継ぎを実装している。
- `publicSafeUiError` はprivateなrequest IDや内部detailを利用者向けエラーへ露出しない。
- `ChatComposer` は `canAsk=false` のとき送信を無効化するが、権限不足の説明を表示しない。
- `E2E-UI-STATE-001` は`@ui-quality`によりrequired Chromium gateの対象である。
- current `main@0771521c` とDraft PR #462のbaseは前回実行後に変化していない。
- open PR #461は`ChatComposer`、`MessageList`等を変更するが、`ChatView`、chat CSS、状態E2E、SQ-016正本、品質matrixは変更しない。

### 推定・未確認

- 推定: 共通状態primitiveとSSE再接続のunit検査を追加した後、画面単位required evidenceへの収束が未実施だった。
- 未確認: PR #461統合後も表示文言とDOM境界が同一か。
- 未確認: 代表screen reader、実browser 400% zoom、touch / real device、Firefox / WebKitの結果。

### 根本原因

チャット固有の非同期状態・権限境界を、画面→要件→受け入れ条件→required E2Eへ結ぶ検出規則がなく、
認可はbuttonの無効化だけに依存し、状態証跡はunit testに留まっていた。

### 対策と対象範囲

- `ChatView`に`chat:create`不足を明示するaccessibleな権限案内を追加する。
- 初期案内、処理中、SSE timeout、`Last-Event-ID`再接続、回復を実画面境界で検証する。
- HTTP 500のprivate detail非表示と、権限不足時にchat POSTを送らないことを検証する。
- `chat / AC-SQ016-007`のautomatedだけを`pass`とし、manual / overallは`blocked`を維持する。

## スコープ

- `apps/web/src/features/chat/components/ChatView.tsx`と局所style / unit test。
- `apps/web/src/app/hooks/useAppShellState.ts`の権限prop結線。
- `apps/web/e2e/visual-regression.spec.ts`のrequired `E2E-UI-STATE-001` 3シナリオ。
- `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`、品質matrixと生成物。
- task / report / completion status / Draft PR #462 / Issue #345。

## スコープ外

- PR #461が変更する`ChatComposer`、`MessageList`、shared UI component。
- RAG回答品質、API認可実装、SSE retry policyの変更。
- `profile / AC-SQ016-007`のowner判断。
- 代表screen reader、実browser 400% zoom、touch / 実機検証。
- merge、deploy、release、force-push。

## 受け入れ条件

- [x] `chat:create`不足時に明示的な権限案内をalertとして表示し、送信buttonを無効化する。
- [x] 権限不足時は入力・Enter操作でも`/rpc/chat/startRun`を送信しない。
- [x] required E2Eが初期案内、処理中live status、SSE timeout、自動retry、`Last-Event-ID`、回答回復を実画面で検証する。
- [x] required E2EがHTTP 500をerrorとして表示し、raw private detailを表示しない。
- [x] `chat / AC-SQ016-007`のautomatedのみを`pass`とし、manual / overallを`blocked`に維持する。
- [x] SQ-016、UI/UX正本、machine-readable matrix、生成物が同じ証跡を参照する。
- [x] targeted lint / typecheck / unit / build / E2E / docs checksが成功するか、実行不能理由を未完了として記録する。
- [x] Draft PR #462、受け入れ条件、セルフレビュー、Issue #345へfinal-head結果を記録する。

## 実装・文書保守計画

1. `ChatView`へ権限案内を追加し、既存認可値をpropで結線する。
2. required E2E 3件とunit testを追加する。
3. SQ-016、UI/UX正本、quality matrixを同期し、`npm run docs:web-inventory`で生成物を更新する。
4. 最小十分な検証を実行してreportへ記録する。
5. Draft PR #462とIssue #345を更新し、final-head CIを確認する。

README / OpenAPI / API設計 / 運用文書はproduct・API・運用契約を変更しないため対象外とする。
生成文書は手編集しない。

## 検証計画

- ChatView targeted unit、E2E listing / targeted Chromium / required UI quality。
- targeted ESLint、Web typecheck / unit / build。
- UI trace、semantic UI、generated inventory、canonical docs、hidden Unicode、`git diff --check`。
- final-head GitHub Actions Web UI Quality / MemoRAG CI / semver。

## PRレビュー観点

- 権限案内が色だけに依存せず、roleと利用者向け文言を持つこと。
- retry検査が実際の2回目SSE requestと`Last-Event-ID`を確認すること。
- raw HTTP responseのprivate detailをDOMへ露出しないこと。
- automated passをmanual / overall passへ昇格しないこと。
- PR #461のproduction差分や認可・RAG挙動を混在させないこと。

## 未決事項・リスク

- `profile / AC-SQ016-007`は状態契約のowner判断が必要なため、本taskでは`blocked`を維持する。
- required gateが3シナリオ増えるため実行時間が増える。
- PR #461統合後にchat DOMが変わる場合、正本契約を維持してselectorを再評価する。
- 代表screen reader、実browser 400% zoom、touch / real device、Firefox / WebKit、`OQ-UI-002`は未完了。
- merge、deploy、release、force-push、破壊的変更は行わない。

## 2026-08-04 ローカル検証

- pass: targeted ChatView / useChatSession unit（2 files / 19 tests）。
- pass: `npm run lint`、Web typecheck、Web unit（61 files / 445 tests）、Web build（既存chunk-size advisoryのみ）。
- pass: required UI quality Playwright listing（36件、追加3件を検出）。
- pass: UI trace 13件、semantic UI 5件、canonical docs、generated inventory、manual evidence structure、infra inventory、hidden Unicode、OpenAPI、API code docs、`git diff --check`。
- blocked: targeted Chromium E2E実走。sandboxが`tsx` IPC listenerを`listen EPERM`で拒否し、API server起動前に停止した。final-head GitHub Actionsで実走する。
- unavailable: `task docs:check`は`task` CLI未導入。確認済みTaskfileの下位コマンドを直接実行した。
- initial CI finding: [Web UI Quality run 30863421790](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30863421790)は追加3件中HTTP 500だけ失敗。oRPCがraw private detailを`Internal Server Error`へ置換していたためprivate値は非表示だったが、英語の内部server文言が利用者向け説明として残った。`publicSafeUiError`の一般化対象へ追加し、unit regressionを追加した。
- pass: 修正head `28fd6ea7`の[Web UI Quality run 30863691510](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30863691510)（36 / 36、artifact `8875333124`、digest `sha256:60b48220a3ba0990a42b4e97cea7ca0c21674678a8b7285547257322b60f0e8c`）。
- pass: [MemoRAG CI run 30863691432](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30863691432)と[semver run 30863691438](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30863691438)。API C1は80.48%で85%目標未達のため、既存coverage taskを維持する。

本taskの自動受け入れ条件は満たしたが、Issue #345全体のmanual evidence、profile owner判断、API C1目標が未完了のため、状態は`do`を維持する。
