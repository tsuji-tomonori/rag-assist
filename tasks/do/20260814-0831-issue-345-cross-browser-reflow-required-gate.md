# Issue #345 Firefox／WebKit reflow proxyをrequired gateへ追加する

- 保存先: `tasks/do/20260814-0831-issue-345-cross-browser-reflow-required-gate.md`
- 状態: do
- タスク種別: 機能追加
- 関連 Issue: #345
- 更新対象 PR: #462

## 背景

Draft PR #462はcurrent `main@8e542b31`を祖先に含み、Firefox／WebKitのkeyboard 4件とsemantic 2件をPR required gateで実走している。既存`E2E-UI-ZOOM-REFLOW-001`は1280px基準の200%相当（640 CSS px）／400%相当（320 CSS px）でチャット、ドキュメント、担当者対応、管理者設定、個人設定のroot overflowと到達を検査するが、required実走はChromiumだけである。

## 目的

既存reflow proxyをFirefox／WebKitの限定required scopeでも実走し、engine差による320 CSS pxでの主要view到達不能とroot overflowをPR内で検出する。ただしviewport proxyを実browser zoomの手動合格へ読み替えない。

## 対象範囲

- 既存`zoom-reflow.spec.ts`のFirefox／WebKit required実走
- cross-browser required script／workflow表示名
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`
- machine-readable trace／quality matrixと正規generatorによる生成物
- E2E README、completion status、本task、spec analysis、作業レポート

## 対象外

- production UI component、API、認証・認可、RAG回答contractの変更
- browser UIの実200%／400% zoom、text-only zoom、OS scaling、DPR
- representative screen reader、touch／virtual keyboard／real device
- Firefox／WebKit native accessibility tree debug evidence
- FR-051、API C1、OQ-UI-002のowner判断
- merge、deploy、release、force-push、破壊的変更

## 実行計画

1. latest main、#462、open PR／Issue、task、正本・生成物の重複を確認する。
2. 既存reflow E2EをFirefox／WebKit required scriptへ接続する。
3. SQ-016、NFR-018、UI設計、trace、quality matrix、生成文書を同期する。
4. lint、Web typecheck、unit、対象E2E discovery／実走、docs checkを実行し、失敗時は修復・再実行する。
5. report、Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新し、final-head CIを確認する。

## ドキュメントメンテナンス計画

- authored requirement／design／JSONを正本として更新する。
- `docs/generated/`は正規generatorの出力だけを反映し、手編集しない。
- CSS viewport reflow proxyと実browser zoomを明確に区別し、manual／overall statusはblockedを維持する。

## 受け入れ条件

### AC-20260814-001: Firefox／WebKitで200%／400%相当reflow proxyを検査する

- Type: boundary / non_functional
- Confidence: confirmed
- Given FirefoxまたはWebKitのPlaywright projectを実行する
- When `E2E-UI-ZOOM-REFLOW-001`を640×720と320×720 CSS pxで実行する
- Thenチャット、ドキュメント、担当者対応、管理者設定、個人設定へmobile navigationから到達できる
- Then各viewのdocument root `scrollWidth`が`clientWidth`を超えない
- Thenbrowser project名とviewport境界を含むJSON evidenceをartifactへ保存する

### AC-20260814-002: requiredとscheduled scopeをboundedに保つ

- Type: non_functional
- Confidence: confirmed
- Given pull request eventである
- When Web UI Quality workflowを実行する
- Then既存keyboard 4件、semantic 2件、reflow 4件の合計10件だけをFirefox／WebKit required jobで実行する
- Then週次Firefox／WebKit visual scopeを重複実行しない

### AC-20260814-003: proxyとmanual zoom evidenceを混同しない

- Type: non_functional
- Confidence: confirmed
- Givencross-browser reflow proxyが成功する
- When正本、quality matrix、生成文書、PR evidenceを更新する
- Then`AC-SQ016-001`のautomated statusだけを根拠付きで維持する
- Then実browser 200%／400% zoomのmanual statusとoverall statusを`blocked`に維持する

### AC-20260814-004: 画面からE2Eまでを相互追跡する

- Type: traceability
- Confidence: confirmed
- Givenrequired cross-browser reflow gateを追加した
- When正本、authored JSON、生成文書を確認する
- Then `chat/documents/assignee/admin/profile → SQ-016 / NFR-018 → AC-SQ016-001 / AC-NFR018-004 → E2E-UI-ZOOM-REFLOW-001 → Firefox/WebKit required`を追跡できる

### AC-20260814-005: 最小十分な検証とGitHub記録を完了する

- Type: non_functional
- Confidence: confirmed
- Given実装と文書同期が完了した
- When完了判定する
- Then lint、Web typecheck、Web unit、対象E2E、trace／semantic／manual evidence／docs checkが成功する
- Then Draft PR #462の本文、受け入れ確認、セルフレビュー、Issue #345へfinal head、CI、未完了項目を記録する
- Then未実施のmanual zoom／screen reader／device検証を実施済みと記載しない

## E2Eシナリオ

### E2E-UI-ZOOM-REFLOW-001: 主要viewをFirefox／WebKitの狭幅viewportでreflowする

- Acceptance Criteria: `AC-20260814-001`, `AC-20260814-002`, `AC-20260814-003`
- Target screen: チャット、ドキュメント、担当者対応、管理者設定、個人設定
- Actor: 最大権限を持つローカル認証ユーザー
- Priority: high
- Confidence: confirmed

#### 前提条件

- test-only local authentication fixtureを使用する
- Firefox／WebKit Playwright browserを導入済みである

#### 画面操作

1. viewportを640×720または320×720 CSS pxへ設定する
2. ローカル認証でサインインする
3. mobile menuを開き、各対象viewへ順に移動する
4. 各viewの表示とroot dimensionsを取得する

#### 期待値

- 対象viewがすべて表示される
- document rootに水平overflowが生じない
- zoom相当率、CSS viewport、browser project、各viewのURL／dimensionsがartifactに残る

#### 非UI検証

- required scriptがFirefox 5件＋WebKit 5件をdiscoveryする
- evidence boundaryが実browser zoomではないことを明記する
- production UI／API／認可／RAG contractに差分がない

## 検証計画

- `git diff --check`
- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm run test:e2e:cross-browser:required -w @memorag-mvp/web -- --list`
- cross-browser required E2E実走
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `npm run docs:manual-a11y-evidence:test`
- `npm run docs:manual-a11y-evidence:check`
- `python3 scripts/validate_docs.py`
- OpenAPI／API code docs／infra inventory freshness check

## PRレビュー観点

- production UI、API、認可、RAG契約に変更がないか。
- required scopeが既存reflow 2 case×2 browserだけに限定されているか。
- viewport proxyを実browser zoomのpassへ読み替えていないか。
- 正本、E2E ID、script、workflow、trace、generated docsが一致するか。
- open PR #461のproduction UI pathと競合を増やしていないか。

## 未決事項・リスク

- CSS viewport proxyはbrowser chromeを含む実zoom、text-only zoom、OS scaling、DPR、支援技術との組合せを証明しない。
- local browser／host library不足時は環境blockerを明記し、final-head GitHub Actionsを実走証跡とする。
- manual screen reader、実browser 200%／400% zoom、touch／real deviceは未完了を維持する。

## 実施結果（2026-08-14 local）

- [x] 既存`E2E-UI-ZOOM-REFLOW-001`をFirefox／WebKit required scriptへ追加し、keyboard 4件＋semantic 2件＋reflow 4件の合計10件をdiscoveryした。
- [x] reflow artifactへ`browserProject`を追加し、attachment名にもprojectを含めた。
- [x] `SQ-016`、`NFR-018`、`DES_UI_UX_001`、machine-readable trace / quality matrix、生成文書、E2E READMEを同期した。
- [x] repository lint、Web typecheck、Web build、Web unit 62 files / 447 tests、trace 13 tests、semantic 5 tests、manual evidence contract 7 tests、generated Web inventory、canonical docs、OpenAPI、API code docs、infra inventory、hidden Unicode、diff checkが成功した。
- [x] OpenAPI checkは`tsx` CLIのIPCが`listen EPERM`となったため、同一entryを`node --import tsx`で実行して成功した。permission escalationは行っていない。
- [ ] 対象E2Eのlocal実走。sandboxがnetwork-enabled webServer実行をtest開始前に拒否したためblocked。final-head GitHub Actionsを必須確認する。
- [ ] final-head CI、PR本文／受け入れ確認／セルフレビュー、Issue #345コメントはcommit公開後に実施する。
- [ ] representative screen reader、browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling、touch／real device、Firefox／WebKit native accessibility tree、FR-051 owner判断、API C1は未完了を維持する。

