# Issue #345 お気に入り cross-browser state 必須 gate 作業レポート

## 受けた指示

Issue #345 の current main、open PR／Issue、task、正本・生成文書を確認し、既存作業と重複しない小さな UI/UX 改善を一件実装し、検証、Draft PR、Issue記録まで進める。未検証事項を完了扱いせず、merge／deploy／release／破壊的変更を行わない。

## 要件整理と判断

- current main は `8e542b31`。PR #462 の統合 branch `c7a5f828` は main を祖先に持ち、開始時点で behind 0／ahead 150 だった。
- Firefox／WebKit 必須 gate は9画面のsemantic契約とhistory／documents／assigneeのstate契約を持つが、お気に入りのresource stateはChromium requiredだけだった。
- Draft PR #461 はproduction UIを変更するため、production sourceを触らず、既存state契約を横断ブラウザ証跡へ拡張する方が競合と責務重複を抑えられる。
- 今回のtraceを `favorites → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-004` とした。

## 実施作業

- `cross-browser-state.spec.ts` に次のFirefox／WebKit対象scenarioを追加した。
  - loading → HTTP 500 error → retrying → recovered → confirmed empty
  - HTTP 403 → permission alert
- loading／error／retrying中のfalse zero・empty非表示、private detail非表示、permission時の戻る操作をassertした。
- browser project、state sequence、request count、fixture境界をJSON attachmentへ記録した。
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`、E2E README、authored trace／quality matrixを同期した。
- 生成Web文書を同期し、required scopeを40件から44件へ更新した。
- taskと事前仕様分析を `tasks/do/`、`reports/working/` に追加した。

## 検証結果（local）

### pass

- `git diff --check`
- authored／generated JSONの`jq empty`
- `node tools/web-inventory/generate-ui-quality-matrix.mjs --check`
- `node --test tools/web-inventory/ui-traceability.test.mjs tools/web-inventory/ui-quality-matrix.test.mjs`: 13 tests
- `node scripts/check-hidden-unicode.mjs docs reports tasks`

### blocked／未検証

- fresh worktreeに依存パッケージがなく、`npm run docs:web-inventory`はTypeScript package不足で停止した。生成差分はauthored metadataから同期したが、full inventory freshnessはGitHub Actionsで判定する。
- 同じ理由でlocal lint、Web typecheck、unit、build、Playwright discovery／実走は未検証であり、GitHub Actions最終headで判定する。
- 既知のE2E専用tsconfig baseline、代表screen reader、native AX tree、実browser zoom、touch／実機は未検証である。

## 成果物

- `E2E-UI-CROSS-BROWSER-STATE-004`
- お気に入りの正本・trace・quality matrix・生成Web inventory同期
- required Firefox／WebKit scope 44件の定義
- 受け入れ条件付きtaskと仕様分析

## GitHub Actions・レビュー結果

- CI、受け入れ確認、セルフレビュー、Issue #345進捗はcommit／push後に追記する。

## 指示へのfit評価

- 1件の小さな改善に限定し、production component／API／認可／RAG behaviorを変更していない。
- loading／error／retry／empty／permission、screen→requirement→AC→E2E traceを優先した。
- #461とのproduction source競合を避け、#341〜#344はmerged済みのため新規所有競合を追加していない。
- 正本文書の責務を分散していない。生成物のfull freshnessはCI成功まで未完了として扱う。

## 未対応・制約・リスク

- Firefox／WebKit新規4実走分とfull required 44件はCI成功まで未完了。
- favorite resume／delete、代表screen reader、native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機は未完了。
- #461統合後の再検証、FR-051／OQ-UI-002のowner判断、E2E tsconfig baseline、API C1 85%は未完了。
- PRとtaskはDraft／`do`を維持する。merge、deploy、release、force-pushは行わない。
