# Issue #345 / Draft PR #462: チャット状態・権限証跡のrequired gate追加

## 結果

Draft PR #462の既存integration branchをcurrent `main@0771521c`のまま更新する準備として、
チャットの初期案内、処理中、SSE再接続、安全な失敗表示、権限不足をrequired UI quality gateへ追加した。
production差分は`ChatView`の権限案内と既存認可値の結線に限定し、新規PRは作らない。

## 開始時点

- base: `main@0771521cbe505d3ffeddcbe34deff89f67de8702`
- Draft PR #462 head: `7e196c01d7cea5780624a8cba84e24ed80794fca`
- mainとDraft baseは前回実行後に更新なし。PRはopen / draft / mergeable、behind 0、unresolved review thread 0。
- Issue #345、open PR / Issue、`tasks/todo/` / `tasks/do/`、SQ-016、UI/UX正本、machine-readable / generated matrixを確認した。

## 選定理由

- `chat / AC-SQ016-007`は状態実装とunit検査がある一方、required実ブラウザ証跡がなかった。
- `profile / AC-SQ016-007`のN/A / mutation feedback判断を仮定せず前進できる。
- open PR #461のchanged filesをGitHubプラグインで確認し、同PRが変更する`ChatComposer` / `MessageList`等を避け、`ChatView`、chat CSS、状態E2E、正本、matrixに限定した。
- API認可、SSE retry policy、RAG回答品質を変えない小さなUI品質単位である。

## 原因と判断

- 直接原因: chat固有の状態遷移をrequired E2Eへ結ぶ画面単位証跡がなかった。
- 流出原因: unit test、required selector、画面単位matrix statusを一括で検出する規則がなかった。
- 実欠陥: `chat:create`不足時は送信buttonがdisabledになるだけで、利用者へ理由を表示していなかった。
- 対策: 既存`canCreateChat`を`ChatView`へ結線し、alert、送信抑止、SSE retry、安全なerror、正本 / matrix / generated docsを同時に同期する。

## 変更

- `chat:create`不足時の明示的な権限alertを追加。
- `E2E-UI-STATE-001`で初期案内→処理中→SSE timeout→`Last-Event-ID`再接続→回答回復を検証。
- HTTP 500のprivate detail非表示と、権限不足時にchat POSTを送らないことを検証。
- required UI qualityを33件から36件へ拡張。
- `chat / AC-SQ016-007` automatedだけを`pass`へ更新し、manual / overallを`blocked`に維持。
- SQ-016、UI/UX正本、machine-readable matrix、生成マトリクスを同期。

## ローカル検証

| 検証 | 結果 |
| --- | --- |
| targeted ChatView / useChatSession unit | pass（2 files / 19 tests） |
| required UI quality listing | pass（36件、追加3件を検出） |
| targeted Chromium E2E | blocked（sandboxの`tsx` IPC `listen EPERM`） |
| lint | pass |
| Web typecheck | pass |
| Web unit | pass（61 files / 445 tests） |
| Web build | pass（既存chunk-size advisoryのみ） |
| UI traceability | pass（13 tests） |
| semantic UI contract | pass（5 tests） |
| canonical / generated / manual evidence / infra / hidden Unicode docs checks | pass |
| OpenAPI / API code docs checks | pass（OpenAPIは等価な`node --import tsx`で実行） |
| `git diff --check` | pass |

`task docs:check`は`task` CLIがないため実行できず、確認済みTaskfileの下位コマンドを直接実行した。

## GitHub Actions

初回head `f2a97ffd`ではWeb UI Quality 35 / 36が成功し、HTTP 500の1件のみ失敗した。
oRPCがraw private detailを`Internal Server Error`へ置換していたためprivate値は非表示だったが、
英語の内部server文言が利用者向け説明として残る実欠陥を検出した。`publicSafeUiError`の一般化対象へ追加し、
unit regressionを追加した。

| workflow | 結果 | 証跡 |
| --- | --- | --- |
| Web UI Quality | pass（36 / 36） | [run 30863691510](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30863691510)、artifact `8875333124`、digest `sha256:60b48220a3ba0990a42b4e97cea7ca0c21674678a8b7285547257322b60f0e8c` |
| MemoRAG CI | pass | [run 30863691432](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30863691432) |
| Validate Semver Label | pass | [run 30863691438](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30863691438) |

API coverageはC0 90.65% / C1 80.48%、WebはC0 90.85% / C1 85.76%。workflowは成功したが、
API C1 85%品質目標は既存`tasks/todo/20260712-coverage-api-c1-recovery.md`で未完了のまま扱う。

## 未完了

- representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKit。
- `profile / AC-SQ016-007`のowner判断。
- `OQ-UI-002` owner / cadence / approved matrix。
- API C1品質目標85%（前回最終CI 80.48%）。

## 指示への適合

| 要件 | 状況 | 根拠 |
| --- | --- | --- |
| current main / open work / tasks / 正本・生成物を確認 | 対応 | GitHub・local sourceを再確認 |
| 重複しない小改善を1件選定 | 対応 | chat state / permission evidenceへ限定 |
| task・実装・正本・生成物を同期 | 対応 | alert、E2E、2正本、matrix、generated docs |
| lint・typecheck・unit・E2E・docs check | 対応 | local static / unit / docsとGitHub required Chromium 36 / 36がpass。local E2E blockedは明記 |
| Draft PR更新・Issue進捗 | 対応 | Draft PR #462とIssue #345へfinal evidenceを記録 |
| 未検証を完了扱いしない | 対応 | taskは`do`、manual / overallは`blocked` |
| merge / deploy / release禁止 | 対応 | 未実施 |

## 次の具体作業

1. 次回はprofile state owner判断またはapproved manual evidence環境を、根拠なしに完了扱いせず進める。
2. representative screen reader、実browser 400% zoom、touch / real deviceのapproved execution環境とownerを確定する。
3. API C1は既存coverage recovery taskで85%目標へ収束する。
