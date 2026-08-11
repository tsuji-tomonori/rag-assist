# Issue #345 keyboard journeyをFirefox／WebKit required gateへ昇格する

- 保存先: `tasks/do/20260812-0820-issue-345-keyboard-cross-browser-required-gate.md`
- 状態: do
- タスク種別: 機能追加
- 関連 Issue: #345
- 更新対象 PR: #462

## 背景

Draft PR #462 は current `main@8e542b31` を祖先に含み、Chromium required gateでログインと主要画面のkeyboard journeyを検査している。一方、Firefox／WebKitは週次のvisual-regression scopeだけで、`E2E-UI-LOGIN-KEYBOARD-001`と`E2E-UI-KEYBOARD-NAV-001`をPRごとに実走していない。そのため、Firefox／WebKitのkeyboard到達性は未検証blockerとして残っている。

open PR #461はshared UIと各画面production componentを変更するため、本taskでは同PRのproduction pathを変更せず、既存keyboard E2Eの実行契約、workflow、SQ-016と品質マトリクスだけを更新する。

## 目的

ログインからチャット、履歴、お気に入り、個人設定までの既存keyboard journeyをFirefox／WebKitのPR required gateで実走し、ブラウザ固有のfocus・native key操作回帰をmainへ入る前に検出する。

## 対象範囲

- `.github/workflows/web-ui-quality.yml`
- `apps/web/package.json`
- `apps/web/e2e/README.md`
- `docs/1_要求_REQ/**/REQ_SERVICE_QUALITY_016.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tools/web-inventory/ui-quality-matrix.json`
- `tools/web-inventory/ui-traceability.json`
- 正規generatorが更新する`docs/generated/`
- `.codex/completion-status.json`
- 本taskと作業レポート

## 対象外

- production UI componentの変更
- representative screen readerの読み上げ検証
- 実browser 200%／400% zoom
- touch／real device
- FR-051永続化、API C1、OQ-UI-002のowner判断
- merge、deploy、release、force-push、破壊的変更

## 実行計画

1. current main、#462、open PR／Issue、task、正本・生成物の重複を確認する。
2. 既存keyboard E2EをFirefox／WebKit向けの限定scriptへ接続する。
3. PR時に限定cross-browser jobを実行し、週次visual scopeは維持する。
4. SQ-016、UI設計、trace、quality matrix、E2E READMEを同じ証跡へ同期する。
5. 正規generatorを実行し、生成物freshnessを確認する。
6. lint、typecheck、unit、E2E discovery／実走、docs checkを実行する。
7. report、PR本文、受け入れ確認、セルフレビュー、Issue #345を更新し、final-head CIを確認する。

## ドキュメントメンテナンス計画

- `SQ-016 / AC-SQ016-002`へFirefox／WebKit keyboard evidenceを追加する。
- `DES_UI_UX_001`で画面→要件→受け入れ条件→E2E→browser projectを追跡する。
- authored JSONを正としてWeb生成文書を正規generatorで同期し、生成物を手編集しない。
- API、OpenAPI、RAG、deployment、operationの契約は変更しないため、該当文書はfreshness checkだけを行う。

## 受け入れ条件

### AC-20260812-001: Firefox／WebKitでログインkeyboard journeyを実走する

- Given PRのWeb UI Quality workflowが実行される
- When cross-browser keyboard gateを起動する
- Then `E2E-UI-LOGIN-KEYBOARD-001`がFirefoxとWebKitの両projectで成功する
- Then Tab到達、3px focus indicator、Enter submit、main view到達を検査する

### AC-20260812-002: Firefox／WebKitで主要画面keyboard journeyを実走する

- Given ローカル認証とtest-only route fixtureが有効である
- When `E2E-UI-KEYBOARD-NAV-001`をFirefoxとWebKitで実行する
- Then chat textboxへのTab到達、Enter送信、処理中から回答復帰を検査する
- Then history、favorites、profileの代表controlへkeyboard-onlyで到達・操作できる

### AC-20260812-003: requiredとscheduled scopeを分離する

- Given PR eventである
- When Web UI Quality workflowを評価する
- Then Chromium required jobと限定cross-browser keyboard jobを実行する
- Then週次Firefox／WebKit visual accessibility scopeを重複実行しない

### AC-20260812-004: 正本と生成物を同期する

- Given cross-browser keyboard gateを追加した
- When追跡文書を確認する
- Then `chat/history/favorites/profile → SQ-016 → AC-SQ016-002 → E2E-UI-LOGIN-KEYBOARD-001 / E2E-UI-KEYBOARD-NAV-001 → Firefox/WebKit`を相互追跡できる
- Then automated evidenceだけを更新し、manual／overallはblockedを維持する

### AC-20260812-005: 最小十分な検証とGitHub記録を完了する

- Given差分を実装・同期した
- When完了判定する
- Then lint、Web typecheck、Web unit、対象E2E、docs checkが成功する
- Then Draft PR #462の本文、受け入れ確認、セルフレビュー、Issue #345へfinal headとblockerを記録する
- Then未実施検証を実施済みと記載しない

## E2Eシナリオ

### E2E-UI-CROSS-BROWSER-KEYBOARD-001: ログインと主要画面をFirefox／WebKitでkeyboard操作できる

- Acceptance Criteria: `AC-20260812-001`, `AC-20260812-002`, `AC-20260812-003`
- Target screen: ログイン、チャット、履歴、お気に入り、個人設定
- Actor: ローカル認証ユーザー
- Priority: high
- Confidence: confirmed

#### 前提条件

- test-only API／SSE fixtureを使用する
- Firefox／WebKit Playwright browserを導入済みである

#### 画面操作

1. Tabでログインformの各controlへ到達し、Enterで送信する
2. チャットの質問textboxへTabで到達し、Enterで質問を送信する
3. 回答処理中から回答表示へ復帰する
4. 履歴、お気に入り、個人設定へTabとEnter／Spaceで移動する
5. 各画面の代表controlをnative keyboard操作する

#### 期待値

- Firefox／WebKitの両方でfocus対象が3px indicatorを持つ
- ログイン後にmain viewへ到達する
- チャット送信requestは1回だけ発行され、回答へ復帰する
- 履歴、お気に入り、個人設定の代表controlを操作できる
- test-only fixtureがproduction API、認可、RAG回答contractを変更しない

#### 非UI検証

- PR workflowが限定cross-browser commandを実行する
- scheduled visual scopeは別job／commandとして維持する

## 検証計画

- `git diff --check`
- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`
- `npm run test:e2e:cross-browser:keyboard -w @memorag-mvp/web -- --list`
- Firefox／WebKit対象E2E実走。local browser不足時は理由を記録し、final-head GitHub Actionsを必須確認する
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `npm run docs:manual-a11y-evidence:test`
- `npm run docs:manual-a11y-evidence:check`
- `python3 scripts/validate_docs.py`
- OpenAPI／API code docs／infra inventory freshness check

## PRレビュー観点

- PR jobが週次visual全量ではなく2本のkeyboard E2EだけをFirefox／WebKitで実行するか。
- Chromium required scopeとscheduled Firefox／WebKit scopeを壊していないか。
- production UI、API、認可、RAG回答へ変更がないか。
- #461のproduction pathと重複していないか。
- Firefox／WebKit automated evidenceをmanual screen reader／zoom／real deviceのpassへ読み替えていないか。
- 正本、authored JSON、生成文書、E2E ID、workflow commandが一致するか。

## 未決事項・リスク

- representative screen readerの読み上げ順・重複通知は本taskで検証しない。
- 実browser 200%／400% zoom、touch／real deviceはblockedを維持する。
- CI時間増加を抑えるため、PR cross-browser scopeはログイン＋主要画面keyboardの2本に限定する。
- local browser導入がnetwork／sandboxでblockedの場合、GitHub Actions final-head成功を実走証跡とする。

## 実施結果（2026-08-12）

- [x] PR用のFirefox／WebKit限定keyboard jobと4件のE2E実行契約を追加した。
- [x] `SQ-016`、UI設計、traceability、quality matrix、生成文書を同期した。
- [x] lint、Web typecheck、Web build、Web unit 447件、E2E discovery 4件、trace 13件、semantic 5件、docs freshness／canonical checkが成功した。
- [ ] Firefox／WebKit E2Eのローカル実走。Firefoxはsandboxの`/proc/self/uid_map` read-onlyでlaunch timeout、WebKitは必要なGStreamer／GTK等共有library不足でbrowser launch不可だった。test assertion到達前の環境blockerであり、final-head GitHub Actionsを必須確認する。
- [x] 初回GitHub ActionsでWebKit 2件とFirefox loginは成功した。Firefox主要画面だけが前方Tabを文書末尾から先頭へwrapするテスト前提で失敗したため、composerから前方にあるnavigationへはShift+Tabで戻るkeyboard-only journeyへ修正した。
- [ ] final-head GitHub Actions、PR受け入れ確認／セルフレビュー、Issue #345の記録。
- [ ] representative screen reader、実browser 200%／400% zoom、touch／real device、Firefox／WebKit AX treeは未完了を維持する。
