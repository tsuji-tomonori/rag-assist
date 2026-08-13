# Issue #345 Firefox／WebKit semantic evidenceをrequired gateへ追加する

- 保存先: `tasks/do/20260813-0842-issue-345-cross-browser-semantic-required-gate.md`
- 状態: do
- タスク種別: 機能追加
- 関連 Issue: #345
- 更新対象 PR: #462

## 背景

Draft PR #462 は current `main@8e542b31` を祖先に含み、Firefox／WebKitでloginと主要画面のkeyboard journeyをPR required gateとして4件実走している。一方、name／role／state／live regionのsemantic contractはChromium CDPのaccessibility treeだけを検査し、Firefox／WebKit project内でのARIA snapshotと動的ARIA属性は未検証である。

既存のproduction UIとopen PRの変更範囲へ重複を増やさず、Playwrightが各browser projectのrendered DOMから生成するARIA snapshotを限定scopeで検査する。

## 目的

loginとchatの代表semantic contract、およびchat処理中の`busy`／`live=polite`をFirefox／WebKit projectでPRごとに検査し、browser間で生じる支援技術向け意味論回帰をmainへ入る前に検出する。

## 対象範囲

- Firefox／WebKit用の限定semantic E2E
- 既存cross-browser required script／workflow
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`
- machine-readable trace／quality matrixと正規generatorによる生成物
- E2E README、completion status、本task、作業レポート

## 対象外

- production UI component、API、認証・認可、RAG回答contractの変更
- NVDA／JAWS／VoiceOver等の実screen reader検証
- 実browser 200%／400% zoom
- touch／virtual keyboard／real device
- Firefox／WebKit内部AX treeのengine固有debug protocol検証
- FR-051、API C1、OQ-UI-002のowner判断
- merge、deploy、release、force-push、破壊的変更

## 実行計画

1. latest main、#462、open PR／Issue、task、正本・生成物の重複を確認する。
2. loginとchatの限定aria snapshot E2EをFirefox／WebKitで実装する。
3. 既存required cross-browser jobへ接続し、週次visual scopeを維持する。
4. SQ-016、NFR-018、UI設計、trace、quality matrix、生成文書を同期する。
5. lint、typecheck、unit、対象E2E、docs checkを実行し、失敗時は修復・再実行する。
6. report、Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新し、final-head CIを確認する。

## ドキュメントメンテナンス計画

- authored requirement／design／JSONを正本として更新する。
- `docs/generated/`は正規generatorの出力だけを反映し、手編集しない。
- Firefox／WebKit automated semantic evidenceを実screen readerのpassへ読み替えず、manual／overall statusはblockedを維持する。

## 受け入れ条件

### AC-20260813-001: Firefox／WebKitでloginとchatのsemantic contractを検査する

- Given FirefoxまたはWebKitのPlaywright projectを実行する
- When loginとchatのaria snapshotを取得する
- Then heading、form、textbox、button、main、navigation、regionの必須name／roleが欠落しない
- Then browser engine名を含むsemantic evidenceをartifactへ保存する

### AC-20260813-002: chatの動的semantic stateを検査する

- Given chat回答streamをtest-only routeで待機させる
- When質問を送信して処理中から回答完了へ遷移する
- Then chat regionのbusy stateと処理中articleのpolite live regionをFirefox／WebKitで観測できる
- Then回答完了後にbusy stateが解除される

### AC-20260813-003: requiredとscheduled scopeを分離する

- Given pull request eventである
- When Web UI Quality workflowを実行する
- Then既存keyboard 4件とsemantic 2件だけをFirefox／WebKit required jobで実行する
- Then週次Firefox／WebKit visual scopeを重複実行しない

### AC-20260813-004: 画面からE2Eまでを相互追跡する

- Given cross-browser semantic gateを追加した
- When正本、authored JSON、生成文書を確認する
- Then `login/chat → SQ-016 / NFR-018 → AC-SQ016-003 / AC-NFR018-004 → E2E-UI-CROSS-BROWSER-SEMANTICS-001 → Firefox/WebKit`を追跡できる
- Thenmanual screen reader／zoom／real-deviceとoverallはblockedを維持する

### AC-20260813-005: 最小十分な検証とGitHub記録を完了する

- Given実装と文書同期が完了した
- When完了判定する
- Then lint、Web typecheck、Web unit、対象E2E、trace／semantic／docs checkが成功する
- Then Draft PR #462の本文、受け入れ確認、セルフレビュー、Issue #345へfinal head、CI、未完了項目を記録する
- Then未実施の実screen reader／zoom／device検証を実施済みと記載しない

## E2Eシナリオ

### E2E-UI-CROSS-BROWSER-SEMANTICS-001: loginとchatの支援技術向け意味論をFirefox／WebKitで維持する

- Acceptance Criteria: `AC-20260813-001`, `AC-20260813-002`, `AC-20260813-003`
- Target screen: ログイン、チャット
- Actor: ローカル認証ユーザー
- Priority: high
- Confidence: confirmed

#### 前提条件

- test-only API／SSE fixtureを使用する
- Firefox／WebKit Playwright browserを導入済みである

#### 画面操作

1. ログイン画面を開く
2. aria snapshotでformとcontrolのname／roleを確認する
3. ローカル認証でサインインする
4. chatのaria snapshotでlandmarkと質問formを確認する
5. 質問を送信し、回答streamを待機させる
6. 処理中と完了後のARIA属性とroleを確認し、snapshotとstate JSONを保存する

#### 期待値

- Firefox／WebKitの両方で必須name／roleが一致する
- 処理中はchat regionがbusyで、処理中articleがpolite live regionとして公開される
- 完了後はbusy stateが解除される
- snapshotとbrowser project名がCI artifactに残る

#### 非UI検証

- required jobがkeyboard 4件＋semantic 2件を実行する
- production UI／API／認可／RAG回答contractに差分がない

## 検証計画

- `git diff --check`
- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`
- cross-browser required E2E discovery／実走
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `npm run docs:manual-a11y-evidence:test`
- `npm run docs:manual-a11y-evidence:check`
- `python3 scripts/validate_docs.py`
- OpenAPI／API code docs／infra inventory freshness check

## PRレビュー観点

- Playwright ARIA snapshotでrole / accessible nameを検査し、単なるDOM selector存在確認へ弱めていないか。
- required jobを全cross-browser visual scopeへ不必要に拡大していないか。
- production UI、API、認可、RAG契約に変更がないか。
- automated semantic evidenceを実screen readerの合格へ読み替えていないか。
- 正本、E2E ID、script、workflow、trace、generated docsが一致するか。

## 未決事項・リスク

- aria snapshotは実screen readerの読み上げ順、操作、重複通知を証明しない。
- Playwright ARIA snapshotは`busy`／`live`をシリアライズしないため、name／roleはsnapshot、動的stateは同一browser projectのARIA属性とrole locatorで検査し、両方をartifactへ保存する。
- local browser／host library不足時は環境blockerを明記し、final-head GitHub Actionsを実走証跡とする。
- manual screen reader、実browser 200%／400% zoom、touch／real deviceは未完了を維持する。

## 実施結果（2026-08-13 local）

- [x] `E2E-UI-CROSS-BROWSER-SEMANTICS-001`を追加し、Firefox／WebKit projectでlogin / chatのARIA snapshotとchat動的ARIA stateを各1件、合計2件としてdiscoveryした。
- [x] required cross-browser scopeを既存keyboard 4件＋semantic 2件へ拡張し、より広いvisual scopeはscheduled jobに分離した。
- [x] `SQ-016`、`NFR-018`、`DES_UI_UX_001`、machine-readable trace / quality matrix、生成文書、E2E READMEを同期した。
- [x] repository lint、Web typecheck、Web build、Web unit 62 files / 447 tests、trace 13 tests、semantic 5 tests、manual evidence contract 7 tests、generated Web inventory、canonical docs、OpenAPI、API code docs、infra inventory、diff checkが成功した。
- [ ] 対象E2Eのlocal実走。sandboxの`tsx` IPCが`listen EPERM`となりAPI webServerを起動できず、assertion到達前に停止した。環境blockerであり、final-head GitHub Actionsを必須確認する。
- [ ] Draft PR #462のfinal-head CI、受け入れ確認、セルフレビュー、Issue #345進捗記録。
- [ ] representative screen reader、実browser 200%／400% zoom、touch／real device、Firefox／WebKit native accessibility treeのengine固有debug出力、FR-051 owner判断、API C1は未完了を維持する。
