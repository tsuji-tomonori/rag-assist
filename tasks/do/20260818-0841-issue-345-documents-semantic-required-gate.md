# Issue #345 文書画面のsemantic証跡をrequired gateへ追加する

- 保存先: `tasks/do/20260818-0841-issue-345-documents-semantic-required-gate.md`
- 状態: do
- タスク種別: 機能追加
- 関連 Issue: #345
- 更新対象 PR: #462

## 背景

Draft PR #462はcurrent `main@8e542b31`を祖先に含み、文書画面の320 CSS px reflowとloading／partial／permission／retryを自動検査している。`E2E-UI-SR-SEMANTICS-001`も文書画面のworkspace、folder tree、file list、current contextというlandmarkは取得するが、品質マトリクスの`documents / AC-SQ016-003`はautomated `blocked`である。検索、filter value、file table、row actionを含む画面固有のname／role／value契約がrequired gateとmachine-readable traceへ結線されていない。

## 目的

許可された文書を検索・識別・選択する主要理解導線のChromium accessibility tree契約をPR required gateへ追加し、`documents → SQ-016 → AC-SQ016-003 → E2E-UI-SR-SEMANTICS-001`を正本、authored trace、品質マトリクス、生成物で一意に追跡可能にする。自動証跡を代表screen readerのmanual合格へ読み替えない。

## 対象範囲

- test-only documents／document-groups／reindex-migrations fixture
- 文書workspace、パンくず、folder tree、folder search、file list、current context、filter controls、file table、detail dialog／主要action／disclosure expandedのChromium AX契約と選択行のDOM `aria-selected`
- `E2E-UI-SR-SEMANTICS-001`のdocuments scenarioとJSON evidence
- `SQ-016`、`DES_UI_UX_001`、machine-readable trace／quality matrix、正規生成文書
- 本task、仕様分析、作業レポート

## 対象外

- `DocumentWorkspace`と配下production component、API、認証・認可、文書mutation
- documentsのkeyboard journey、contrast、代表screen reader、実browser zoom、touch／実機
- open PR #461のshared UI統合、FR-051、API C1、OQ-UI-002のowner判断
- merge、deploy、release、force-push、破壊的変更

## 実行計画

1. current main、open PR、既存task、正本、authored／generated traceを比較し、非重複範囲を確定する。
2. test-only文書fixtureと画面固有のChromium AX期待を既存required E2Eへ追加する。
3. SQ-016、UI正本、trace、quality matrix、生成物を同じ証跡へ同期する。
4. lint、Web typecheck、unit、対象E2E、trace／semantic／docs checkを実行する。
5. report、Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新し、final-head CIを確認する。

## ドキュメントメンテナンス計画

- `SQ-016`と`DES_UI_UX_001`だけを正本として更新し、新しい要件正本を作らない。
- `ui-traceability.json`へdocumentsの`SQ-016`／`AC-SQ016-003`を追加し、共有E2E IDは重複登録せず、quality matrixのglobal evidenceとUI正本から`E2E-UI-SR-SEMANTICS-001`へ結線する。
- `ui-quality-matrix.json`はautomatedだけを`pass`へ更新し、manual／overallは`blocked`を維持する。
- `docs/generated/`は正規generatorで再生成し、手編集しない。

## 受け入れ条件

### AC-20260818-001: 文書画面の意味構造をChromium AX treeで検査する

- Given 文書とフォルダが各1件ある文書画面を表示する
- When Chromium accessibility tree contractを取得する
- Then workspace、パンくず、folder tree、folder search、file list、current contextが安定したname／roleを持つ
- Then filename search、type／status／folder／sort／page-size controlsが安定したname／role／valueを持つ
- Then file tableと対象文書のdetail actionが安定したname／roleを持つ
- Then detail action後のrowがDOM `aria-selected=true`を公開する
- Then detail dialogと主要actionが安定したname／roleを持ち、技術・品質詳細の初期expanded stateが`false`である
- Then normalized JSON evidenceをPlaywright reportへ保存する

### AC-20260818-002: test fixtureをproduction境界から分離する

- Given semantic E2E用に文書dataが必要である
- When documents関連HTTPを応答する
- Then fixtureはPlaywright routeに限定され、production component／API／permission contractを変更しない
- Then private IDやdataset固有分岐をproductionへ追加しない

### AC-20260818-003: 画面からE2Eまでを相互追跡する

- Given documents semantic gateを追加した
- When 正本、authored JSON、生成文書を確認する
- Then `documents → SQ-016 → AC-SQ016-003 → quality matrix global evidence → E2E-UI-SR-SEMANTICS-001 → Chromium required`を追跡できる
- Then `documents / AC-SQ016-003`のautomatedだけが`pass`で、manual／overallは`blocked`を維持する

### AC-20260818-004: 最小十分な検証とGitHub記録を完了する

- Given 実装と文書同期が完了した
- When 完了判定する
- Then lint、Web typecheck、Web unit、対象Chromium E2E、trace／semantic／manual evidence／docs checkが成功する
- Then Draft PR #462、受け入れ確認、セルフレビュー、Issue #345へfinal head、CI、未完了項目を記録する
- Then 未実施のmanual検証を実施済みと記載しない

## 検証計画

- `git diff --check`
- 対象E2E ESLint／Playwright discovery／Chromium実走
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `npm run docs:manual-a11y-evidence:test`
- `npm run docs:manual-a11y-evidence:check`
- canonical／generated docs freshness checks

## PRレビュー観点

- fixtureがproduction fallbackへ混入せず、権限境界を弱めないか。
- visible labelとAX name／valueが一致し、internal IDを利用者向けlabelとして固定していないか。
- tableとdetail actionが文書を識別可能か。
- 既存の高位landmarkだけで`AC-SQ016-003`を満たしたと誤判定していないか。
- automationをmanual screen reader passへ読み替えていないか。

## 未決事項・リスク

- open PR #461は`DocumentWorkspace`と配下componentを変更する。今回はproduction pathを変更しないが、#461統合後は最終DOMからAX fixtureを再検証する必要がある。
- Chromium AX treeは代表screen readerの実操作を証明しない。
- documentsのkeyboard journeyとcontrastは別ACとしてblockedを維持する。
- local browser／host service制約時はblockedを明記し、final-head GitHub Actionsを自動実走証跡とする。
