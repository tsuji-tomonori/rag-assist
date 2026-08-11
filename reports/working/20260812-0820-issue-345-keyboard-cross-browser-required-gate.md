# Issue #345 cross-browser keyboard required gate 作業記録

## 入力と判断

- current main: `8e542b31da137129927c1ea8d21650b0c0d483c8`
- 更新対象: Draft PR #462、Issue #345
- #462は開始時head `38e7d8c00f5ef656c685bb1928981eafcbc0e74b`、mainからbehind 0だった。
- open PR #461はproduction UI componentを広く変更しているため、本変更ではproduction sourceを変更せず、既存keyboard E2Eのbrowser実行契約と正本・生成物だけを更新した。
- Firefox／WebKitの週次scopeはvisual regressionだけで、loginと主要画面のkeyboard journeyがPRごとに未検証だったため、最小の非重複改善として選定した。

## 変更

- `E2E-UI-LOGIN-KEYBOARD-001`と`E2E-UI-KEYBOARD-NAV-001`をFirefox／WebKitで実行する限定scriptを追加した。
- pull request時に4件を実行するrequired jobを追加し、週次／手動dispatchのより広いvisual scopeは別jobのまま維持した。
- `SQ-016 / AC-SQ016-002`、`DES_UI_UX_001`、traceability、quality matrixを同じbrowser証跡へ同期した。
- 正規generatorでWeb trace／quality matrix／inventoryを更新した。
- chat、history、favorites、profileのautomated keyboard evidenceだけを拡張し、manual／overallは`blocked`を維持した。

## ローカル検証

- pass: repository lint。
- pass: Web typecheck、Web build（既存chunk-size advisoryのみ）。
- pass: Web unit 62 files / 447 tests。
- pass: targeted Playwright discoveryはFirefox 2件＋WebKit 2件、合計4件。
- pass: UI trace 13 tests、semantic UI 5 tests、manual evidence contract 7 tests。
- pass: generated Web inventory freshness、canonical docs、OpenAPI quality（`node --import tsx`で実行）、API code docs、infra inventory、hidden Unicode、diff check。
- blocked: Firefoxはbrowser起動時にsandboxの`/proc/self/uid_map`がread-onlyで180秒timeoutとなり、2件ともassertion到達前に停止した。
- blocked: WebKitはGStreamer／GTK／Graphene／Wayland等のhost library不足で、2件ともassertion到達前に停止した。
- note: repository標準のAPI起動commandはsandboxで`tsx` IPC `listen EPERM`となるため、実走診断では一時configと`node --import tsx`を使用した。この迂回はrepository差分へ含めていない。

## 最終head CI

- pass: 初回head `0ff88717`のChromium required job。
- partial: 初回head `0ff88717`のcross-browser keyboard jobはWebKit 2件とFirefox loginが成功し、Firefox主要画面だけが固定40回の前方Tab探索で失敗した。失敗artifactでは対象の「チャット」buttonがvisible／focusableで、active elementがmodel comboboxだった。
- partial: 2回目head `dff9948e`で探索上限を120回へ拡張してもFirefoxはmodel comboboxに留まった。Firefoxは文書末尾のfocusable要素から前方Tabを文書先頭へwrapしないため、production focus defectではなくテストがbrowser依存のwrapを前提にしていたと確定した。
- fix pending: composerより前方にあるnavigationへはShift+Tabで戻るkeyboard-only journeyへ修正した。直近focus targetの失敗診断と、login証跡のconfigured browser境界文言も維持する。
- pending: MemoRAG CI、semver label validation。

## 未完了・境界

- representative screen reader、実browser 200%／400% zoom、touch／real device、Firefox／WebKit accessibility tree、対象外画面のbrowser検証は未完了である。
- `FR-051`永続化・owner判断、API C1 85%目標は既存の未完了事項であり、本変更の完了根拠にしない。
- taskは`do`、PRはDraftを維持する。
- merge、deploy、release、force-pushは実施しない。
