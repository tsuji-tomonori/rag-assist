# Issue #345 cross-browser semantic required gate 作業記録

## 入力と判断

- current main: `8e542b31da137129927c1ea8d21650b0c0d483c8`
- 更新対象: Draft PR #462、Issue #345
- #462は開始時head `8f80e63db447526243f0a6739807278edf051ff7`、mainからbehind 0だった。
- 前回までにFirefox／WebKitのkeyboard journey 4件がPR requiredになった一方、semantic contractはChromium CDPだけだった。
- production UI、API、認可、RAG回答を変更せず、login / chatに限定したcross-browser semantic evidenceを最小の非重複改善として選んだ。

## 変更

- `E2E-UI-CROSS-BROWSER-SEMANTICS-001`を追加した。
- login / chatのname・roleをPlaywright ARIA snapshotで検査し、browser project名付きYAMLをartifactへ添付する。
- chat処理中の`aria-busy=true`、article role、`aria-live=polite`と完了後のbusy解除を同じFirefox／WebKit projectで検査し、state JSONを添付する。
- required cross-browser jobをkeyboard 4件＋semantic 2件へ拡張し、より広いvisual scopeはscheduledのまま維持した。
- `SQ-016 / AC-SQ016-003`、`NFR-018 / AC-NFR018-004`、`DES_UI_UX_001`、traceability、quality matrix、生成文書、E2E READMEを同期した。
- Playwright ARIA snapshotがbusy / liveをシリアライズしない仕様を確認し、name / roleはsnapshot、動的stateは同一実走のARIA属性とrole locatorで検証する境界を明記した。

## ローカル検証

- pass: repository lint。
- pass: Web typecheck、Web build（既存chunk-size advisoryのみ）。
- pass: Web unit 62 files / 447 tests。
- pass: targeted Playwright discoveryはFirefox 3件＋WebKit 3件、合計6件。
- pass: UI trace 13 tests、semantic UI 5 tests、manual evidence contract 7 tests。
- pass: generated Web inventory freshness、canonical docs、OpenAPI quality（`node --import tsx`）、API code docs、infra inventory、diff check。
- blocked: 対象E2Eのlocal実走はsandboxの`tsx` IPC `listen EPERM`でAPI webServerを起動できず、assertion到達前に停止した。
- fail/fixed: initial remote head `681e2115`ではFirefox／WebKitともchat snapshotのnavigation hierarchyが不一致だった。CI取得snapshotにより`navigation "画面"`はtop-levelではなく`complementary "主要ナビゲーション"`配下と確認し、期待landmark階層を実装／正本に一致させた。role／name assertionは維持した。

## Final-head CI／GitHub記録

- pending: Web UI QualityのChromium required scopeとFirefox／WebKit 6件。
- pending: MemoRAG CI、semver label validation。
- pending: PR本文、受け入れ確認、セルフレビュー、Issue #345進捗コメント。

## 未完了・境界

- representative screen reader、実browser 200%／400% zoom、touch／real device、Firefox／WebKit native accessibility treeのengine固有debug出力は未完了である。
- `FR-051`永続化・owner判断、API C1 85%目標は既存の未完了事項であり、本変更の完了根拠にしない。
- taskは`do`、PRはDraftを維持する。
- merge、deploy、release、force-pushは実施しない。
