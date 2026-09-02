# Issue #345 担当者対応 cross-browser state 必須 gate 作業レポート

## 受けた指示

Issue #345 の current main、open PR／Issue、task、正本・生成文書を確認し、既存作業と重複しない小さな UI/UX 改善を一件実装し、検証、Draft PR、Issue記録まで進める。未検証事項を完了扱いせず、merge／deploy／release／破壊的変更を行わない。

## 要件整理と判断

- current main は `8e542b31`。PR #462 の統合 branch `a50e90c3` は main を祖先に持ち、開始時点で behind 0 だった。
- Firefox／WebKit 必須 gate は8画面のsemantic契約とhistory／documentsのstate契約を持つが、担当者対応のresource stateはChromium requiredだけだった。
- Draft PR #461 は担当者対応を含むproduction UIを変更するため、production sourceを触らず、既存state契約を横断ブラウザ証跡へ拡張する方が競合と責務重複を抑えられる。
- 今回のtraceを `assignee → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-003` とした。

## 実施作業

- `cross-browser-state.spec.ts` に次のFirefox／WebKit対象scenarioを追加した。
  - loading → HTTP 500 error → retrying → recovered → confirmed empty
  - HTTP 403 → permission alert
- loading／error／retrying中のfalse zero・未確認カンバン・empty非表示、private detail非表示、permission時の戻る操作をassertした。
- browser project、state sequence、request count、fixture境界をJSON attachmentへ記録した。
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`、E2E README、authored trace／quality matrixを同期した。
- `npm run docs:web-inventory` で生成Web文書を更新し、required scopeを36件から40件へ同期した。
- taskと事前仕様分析を `tasks/do/`、`reports/working/` に追加した。

## 検証結果（local）

### pass

- `npm run lint -- apps/web/e2e/cross-browser-state.spec.ts`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=UTC npm test -w @memorag-mvp/web`: 62 files / 449 tests
- `npm run build -w @memorag-mvp/web`: pass。既存chunk-size advisoryのみ。
- `npm run test:e2e:cross-browser:required -w @memorag-mvp/web -- --list`: 6 files / 40 tests。新規4実走分を検出。
- `npm run docs:web-trace:test`: 13 tests
- `npm run test:web-semantic-ui`: 5 tests
- `npm run docs:web-inventory:check`
- `python3 scripts/validate_docs.py`
- `npm run docs:manual-a11y-evidence:test`: 7 tests
- `npm run docs:manual-a11y-evidence:check`: valid blocked baseline、ready false
- `npm run docs:api-code:check`: 98 APIs / 588 documents
- `npm run docs:infra-inventory:check`
- `npm run docs:hidden-unicode:check`
- `npm run check:taskfile-aliases`
- `node --import tsx apps/api/src/validate-openapi-docs.ts`: pass
- `git diff --check`

### blocked／未検証

- 通常のPlaywright実走と`npm run docs:openapi:check`は、`tsx` CLIがsandbox内IPC socketを`listen EPERM`で作成できず停止した。OpenAPIは同一moduleを`node --import tsx`で実行してpassした。
- API／Webを同一exec内で代替起動し、対象4件のrunner到達まで確認したが、ローカルにFirefox `1511`／WebKit `2272` executableがなく、browser launch前で停止した。scenarioのpass／failはGitHub Actions最終headで判定する。
- `npx tsc -p apps/web/e2e/tsconfig.json --noEmit` は今回未変更の `cross-screen-audit.ts` に既存TS2488 4件がありfailureした。新規specはrepository lint、Web typecheck、Playwright 40件discoveryを通過したが、E2E専用tsconfig全体は未解決である。

## 成果物

- `E2E-UI-CROSS-BROWSER-STATE-003`
- 担当者対応の正本・trace・quality matrix・生成Web inventory同期
- required Firefox／WebKit discovery 40件
- 受け入れ条件付きtaskと仕様分析

## 指示へのfit評価

- 1件の小さな改善に限定し、production component／API／認可／RAG behaviorを変更していない。
- loading／error／retry／empty／permission、screen→requirement→AC→E2E traceを優先した。
- #461とのproduction source競合を避け、#341〜#344はmerged済みのため新規所有競合を追加していない。
- generated文書はgeneratorからのみ更新し、正本文書の責務を分散していない。

## 未対応・制約・リスク

- CIのFirefox／WebKit 4件とfull required 40件はcommit／push後に確認するまで未完了。
- 代表screen reader、native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機は未完了。
- #461統合後の再検証、FR-051／OQ-UI-002のowner判断、E2E tsconfig baseline、API C1 85%は未完了。
- PRとtaskはDraft／`do`を維持する。merge、deploy、release、force-pushは行わない。
