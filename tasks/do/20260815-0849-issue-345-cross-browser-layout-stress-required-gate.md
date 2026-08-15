# Issue #345 Firefox／WebKit content-extreme reflowをrequired gateへ追加する

- 保存先: `tasks/do/20260815-0849-issue-345-cross-browser-layout-stress-required-gate.md`
- 状態: do
- タスク種別: 品質ゲート改善
- 関連 Issue: #345
- 更新対象 PR: #462

## 背景

Draft PR #462はcurrent `main@8e542b31`を祖先に含み、Firefox／WebKitでkeyboard 4件、semantic 2件、640／320 CSS px reflow 4件の合計10件をPR required gateとして実走している。既存`E2E-UI-LAYOUT-STRESS-001`は320pxで長文回答、長い引用・ファイル名、多数件、確認済み0件、reduced motion、root／region overflowを検査するが、required実走はChromiumだけである。

## 目的

既存content-extreme reflowをFirefox／WebKitの限定required scopeでも実走し、browser engine差による情報欠落、操作不能、水平overflowをPR内で検出する。ただし自動viewport／fixture証跡を実browser zoom、screen reader、touch、実機の手動合格へ読み替えない。

## 対象範囲

- 既存`layout-stress.spec.ts`のFirefox／WebKit required実走
- browser projectを識別できるJSON artifactとattachment名
- cross-browser required script／workflow表示名
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`
- machine-readable trace／quality matrixと正規generatorによる生成物
- E2E README、completion status、本task、spec analysis、作業レポート

## 対象外

- production UI component、shared primitive、API、認証・認可、RAG回答contractの変更
- browser UIの実200%／400% zoom、text-only zoom、OS scaling、DPR
- representative screen reader、touch／virtual keyboard／real device
- Firefox／WebKit native accessibility tree debug evidence
- FR-051、API C1、OQ-UI-002のowner判断
- merge、deploy、release、force-push、破壊的変更

## 実行計画

1. latest main、#462、open PR／Issue、task、正本・生成物の重複を確認する。
2. 既存content-extreme E2EをFirefox／WebKit required scriptへ接続し、artifactをbrowser別に識別可能にする。
3. SQ-016、NFR-018、UI設計、trace、quality matrix、生成文書を同期する。
4. lint、Web typecheck、unit、対象E2E discovery／実走、docs checkを実行し、失敗時は修復・再実行する。
5. report、Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新し、final-head CIを確認する。

## ドキュメントメンテナンス計画

- authored requirement／design／JSONを正本として更新する。
- `docs/generated/`は正規generatorの出力だけを反映し、手編集しない。
- content-extreme fixtureとmanual environmentを明確に区別し、manual／overall statusはblockedを維持する。

## 受け入れ条件

### AC-20260815-001: Firefox／WebKitで320px content extremesを検査する

- Type: boundary / non_functional
- Confidence: confirmed
- Given FirefoxまたはWebKitのPlaywright projectを実行する
- When `E2E-UI-LAYOUT-STRESS-001`を320×720 CSS pxで実行する
- Then reduced motion下の長文回答と長い引用名が末尾まで表示される
- Thenドキュメントの長いファイル名、履歴35件、確認済みお気に入り0件が情報を失わず表示される
- Then対象regionとdocument rootの水平overflowがない
- Thenbrowser project名とfixture境界を含むJSON evidenceをartifactへ保存する

### AC-20260815-002: requiredとscheduled scopeをboundedに保つ

- Type: non_functional
- Confidence: confirmed
- Given pull request eventである
- When Web UI Quality workflowを実行する
- Then既存10件にlayout-stress 4件だけを加えた合計14件をFirefox／WebKit required jobで実行する
- Then週次Firefox／WebKit visual scopeを重複実行しない

### AC-20260815-003: automatedとmanual evidenceを混同しない

- Type: non_functional
- Confidence: confirmed
- Given content-extreme E2Eが成功する
- When正本、quality matrix、生成文書、PR evidenceを更新する
- Then該当する`AC-SQ016-001`／`AC-SQ016-006`／`AC-SQ016-007`のautomated evidenceだけを更新する
- Then実browser zoom、screen reader、touch／real-deviceのmanual statusとoverall statusを`blocked`に維持する

### AC-20260815-004: 画面からE2Eまでを相互追跡する

- Type: traceability
- Confidence: confirmed
- Givenrequired cross-browser content-extreme gateを追加した
- When正本、authored JSON、生成文書を確認する
- Then `chat/documents/history/favorites → SQ-016 / NFR-018 → AC-SQ016-001 / 006 / 007, AC-NFR018-004 → E2E-UI-LAYOUT-STRESS-001 → Firefox/WebKit required`を追跡できる

### AC-20260815-005: 最小十分な検証とGitHub記録を完了する

- Type: non_functional
- Confidence: confirmed
- Given実装と文書同期が完了した
- When完了判定する
- Then lint、Web typecheck、Web unit、対象E2E、trace／semantic／manual evidence／docs checkが成功する
- Then Draft PR #462の本文、受け入れ確認、セルフレビュー、Issue #345へfinal head、CI、未完了項目を記録する
- Then未実施のmanual zoom／screen reader／device検証を実施済みと記載しない

## E2Eシナリオ

### E2E-UI-LAYOUT-STRESS-001: 320pxの内容極端値をFirefox／WebKitでreflowする

- Acceptance Criteria: `AC-20260815-001`, `AC-20260815-002`, `AC-20260815-003`
- Target screen: チャット、ドキュメント、履歴、お気に入り
- Actor: 最大権限を持つローカル認証ユーザー
- Priority: high
- Confidence: confirmed

#### 前提条件

- test-only local authentication／API fixtureを使用する
- Firefox／WebKit Playwright browserを導入済みである

#### 画面操作

1. viewportを320×720 CSS px、reduced motionへ設定する
2. ローカル認証でサインインする
3. 長文回答を送信し、先頭／末尾／長い引用名を確認する
4. mobile menuからドキュメント、履歴、お気に入りへ移動する
5. 長いファイル名、35件、確認済み0件、root／region dimensionsを確認する

#### 期待値

- 対象情報と操作対象がすべて表示される
- document rootと対象regionに水平overflowが生じない
- browser project、viewport、fixture量、URL／dimensions、evidence boundaryがartifactに残る

#### 非UI検証

- required scriptがFirefox 7件＋WebKit 7件をdiscoveryする
- evidence boundaryが実zoom／実screen reader／実機ではないことを明記する
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

- production UI、shared primitive、API、認可、RAG契約に変更がないか。
- required scopeが既存layout-stress 2 case×2 browserだけに限定されているか。
- fixture automationをmanual screen reader／zoom／real-deviceのpassへ読み替えていないか。
- 正本、E2E ID、script、workflow、trace、generated docsが一致するか。
- open PR #461のproduction／shared UI pathと競合を増やしていないか。

## 未決事項・リスク

- 320px viewport fixtureはbrowser chromeを含む実zoom、text-only zoom、OS scaling、DPR、IME、支援技術との組合せを証明しない。
- local browser／host library不足時は環境blockerを明記し、final-head GitHub Actionsを実走証跡とする。
- manual screen reader、実browser 200%／400% zoom、touch／real deviceは未完了を維持する。

## 実施結果

- [x] 既存`E2E-UI-LAYOUT-STRESS-001`をFirefox／WebKit required scriptへ追加し、Firefox 7件＋WebKit 7件の合計14件をdiscoveryした。
- [x] layout-stress artifactへ`browserProject`を追加し、attachment名にもprojectを含めた。
- [x] `SQ-016`、`NFR-018`、`DES_UI_UX_001`、machine-readable trace／quality matrix、生成文書、E2E READMEを同期した。
- [x] repository lint、Web typecheck、Web build、Web unit 62 files／447 tests、trace 13 tests、semantic 5 tests、manual evidence contract 7 tests、generated Web inventory、canonical docs、OpenAPI、API code docs、infra inventory、hidden Unicode、Taskfile alias、diff checkが成功した。
- [ ] Firefox／WebKit対象E2Eのlocal実走はwebServer起動前にsandboxのnetwork approval boundaryで拒否された。権限拡張せず、final-head GitHub Actionsを実走証跡とする。
- [ ] final-head GitHub Actionsを確認し、Draft PR #462、セルフレビュー、Issue #345を更新する。
- [ ] representative screen reader、実browser zoom、touch／real-device、Firefox／WebKit native accessibility tree、FR-051 owner判断、API C1は未完了を維持する。
