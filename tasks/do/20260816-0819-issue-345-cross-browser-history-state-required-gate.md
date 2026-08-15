# Issue #345 Firefox／WebKitの履歴状態契約をrequired gateへ追加する

- 保存先: `tasks/do/20260816-0819-issue-345-cross-browser-history-state-required-gate.md`
- 状態: do
- タスク種別: 機能追加
- 関連 Issue: #345
- 更新対象 PR: #462

## 背景

Draft PR #462はcurrent `main@8e542b31`を祖先に含み、Firefox／WebKitでkeyboard、semantic、reflow、content-extremeの14件をPR required gateとして実走している。一方、`E2E-UI-STATE-001`のloading／error／permission／retry契約はChromium requiredだけであり、browser engine差で状態表示や再試行操作が失われてもPR内で検出できない。

## 目的

履歴画面の代表的なresource状態をFirefox／WebKitの限定required scopeでも検証し、未確認dataをempty／zeroへ誤変換しないこと、安全なerror／permission表示、retry recoveryをbrowser別artifactへ残す。ただし自動E2Eをrepresentative screen reader、実browser zoom、touch、実機のmanual合格へ読み替えない。

## 対象範囲

- 履歴のloading→HTTP 500→retry→confirmed emptyとHTTP 403
- Firefox／WebKit用の限定E2Eとbrowser別JSON artifact
- cross-browser required script／workflow表示名
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`
- machine-readable trace／quality matrixと正規generatorによる生成物
- E2E README、completion status、本task、spec analysis、作業レポート

## 対象外

- production UI、shared primitive、API、認証・認可、RAG回答contractの変更
- 履歴resume／delete journey
- browser UIの実200%／400% zoom、representative screen reader、touch／実機
- Firefox／WebKit native accessibility tree debug evidence
- FR-051、API C1、OQ-UI-002のowner判断
- merge、deploy、release、force-push、破壊的変更

## 実行計画

1. latest main、#462、open PR／Issue、task、正本・生成物の重複を確認する。
2. 履歴の2状態scenarioをFirefox／WebKit限定E2Eとして追加し、required scriptへ接続する。
3. SQ-016、NFR-018、UI設計、trace、quality matrix、生成文書を同期する。
4. lint、Web typecheck、unit、対象E2E discovery／実走、docs checkを実行し、失敗時は修復・再実行する。
5. report、Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新し、final-head CIを確認する。

## ドキュメントメンテナンス計画

- authored requirement／design／JSONを正本として更新する。
- `docs/generated/`は正規generatorの出力だけを反映し、手編集しない。
- browser自動証跡とmanual environmentを区別し、manual／overall statusは`blocked`を維持する。

## 受け入れ条件

### AC-20260816-001: Firefox／WebKitで履歴のfalse-zero防止とretryを検査する

- Type: functional / error / boundary
- Confidence: confirmed
- Given FirefoxまたはWebKitで履歴を開く
- When初回GETが処理中からHTTP 500となり、利用者が再試行する
- Then loading中とerror中は未確認件数を0件またはemptyとして表示しない
- Thenprivate detailを表示せず、対象付きerrorと再試行操作を表示する
- Then再試行後のconfirmed emptyと0件を表示し、browser projectを含むJSON evidenceを保存する

### AC-20260816-002: Firefox／WebKitでpermission deniedをemptyと区別する

- Type: permission / security
- Confidence: confirmed
- Given履歴GETがHTTP 403を返す
- When履歴画面を表示する
- Thenpermission alertを表示し、private detailとempty／zero contentを表示しない
- Thenbrowser projectを含むJSON evidenceを保存する

### AC-20260816-003: required scopeとmanual境界をboundedに保つ

- Type: non_functional
- Confidence: confirmed
- Given pull request eventである
- When Web UI Quality workflowを実行する
- Then既存14件に履歴状態2件×2 browserだけを加えた合計18件をcross-browser required jobで実行する
- Then自動browser証跡だけを更新し、manual screen reader／zoom／device statusとoverall statusは`blocked`のままにする

### AC-20260816-004: 画面からE2Eまでを相互追跡する

- Type: traceability
- Confidence: confirmed
- Given cross-browser history state gateを追加した
- When正本、authored JSON、生成文書を確認する
- Then `history → SQ-016 / NFR-018 → AC-SQ016-007 / AC-NFR018-004 → E2E-UI-CROSS-BROWSER-STATE-001 → Firefox/WebKit required`を追跡できる

### AC-20260816-005: 最小十分な検証とGitHub記録を完了する

- Type: non_functional
- Confidence: confirmed
- Given実装と文書同期が完了した
- When完了判定する
- Then lint、Web typecheck、Web unit、対象E2E、trace／semantic／manual evidence／docs checkが成功する
- Then Draft PR #462、受け入れ確認、セルフレビュー、Issue #345へfinal head、CI、未完了項目を記録する
- Then未実施のmanual検証を実施済みと記載しない

## E2Eシナリオ

### E2E-UI-CROSS-BROWSER-STATE-001: 履歴の代表resource状態をFirefox／WebKitで区別する

- Acceptance Criteria: `AC-20260816-001`, `AC-20260816-002`, `AC-20260816-003`
- Target screen: 履歴
- Actor: サインイン済み一般利用者
- Priority: high
- Confidence: confirmed

#### 画面操作と期待値

1. 履歴を開き、loading中は`aria-busy=true`、loading文言、false-zero非表示を確認する。
2. HTTP 500後は安全な対象付きerror、private detail非表示、empty非表示を確認する。
3. 再試行し、recovered status、confirmed empty、0件、GET 2回を確認する。
4. 別scenarioでHTTP 403を返し、permission alert、private detail／empty／zero非表示を確認する。
5. browser project、state sequence、evidence boundaryをJSON artifactへ保存する。

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
- canonical／generated docs freshness checks

## PRレビュー観点

- production UI、API、認可、RAG契約を変更していないか。
- required scopeが履歴状態2 scenario×2 browserだけ増えているか。
- private detail、false zero、retry回数の期待値を緩めていないか。
- automationをmanual passへ読み替えていないか。
- 正本、E2E ID、script、workflow、trace、生成文書が一致するか。

## 未決事項・リスク

- test-only fixtureは実backend障害、実支援技術、実zoom、実機を証明しない。
- local browser／host service制約時はblockedを明記し、final-head GitHub Actionsを実走証跡とする。
- representative screen reader、実browser zoom、touch／実機、FR-051 owner判断、API C1は未完了を維持する。

## 実施結果

- [ ] 実装・正本・生成物を同期する。
- [ ] 最小十分な検証を実行する。
- [ ] Draft PR #462、セルフレビュー、Issue #345を更新する。
- [ ] manual／owner判断待ちを未完了として維持する。
