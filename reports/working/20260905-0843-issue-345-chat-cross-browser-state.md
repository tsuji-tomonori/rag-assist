# Issue #345 チャット cross-browser state 作業レポート

## 受けた指示

- Issue #345 を current main、前回差分、open PR／Issue、task、正本・生成文書から継続改善する。
- 既存作業と重複しない小さな改善を1件選び、task、実装、文書同期、検証、Draft PR、Issueコメントまで行う。
- 未検証・CI待ち・owner判断待ちを完了扱いせず、merge／deploy／releaseを行わない。

## 要件整理と判断

- `main@8e542b31` と前回 final head `8242412a` を確認し、PR #462 は main に対して behind 0／ahead 152 から開始した。
- Firefox／WebKit必須範囲ではチャットのkeyboard・semantic・reflow・content extremeは存在するが、主要非同期状態はChromiumだけだった。
- production UIを変更中のDraft PR #461との競合を避け、既存のdeterministic chat fixtureを独立した横断ブラウザ証跡へ移植した。
- 追跡IDは `chat → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-005` とした。

## 実施作業

- `cross-browser-state.spec.ts` に次の3シナリオを追加した。
  - initial→processing→SSE timeout→`Last-Event-ID` retry→recovered answer
  - HTTP 500の対象付き安全なerrorとprivate detail非表示
  - `chat:create`不足時のpermission、disabled送信、Enterを含むrequest非発行
- state JSON artifactへbrowser project、状態系列、event read count／retry header、fixture境界を記録した。
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`、E2E README、UI traceability／quality matrixを同期した。
- `npm run docs:web-inventory` で生成Web文書4件を更新した。
- 必須cross-browser scopeを44件から50件へ更新した。

## 検証結果

- pass: `git diff --check`
- pass: `npm run lint -- apps/web/e2e/cross-browser-state.spec.ts`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `TZ=UTC npm test -w @memorag-mvp/web`（62 files／449 tests）
- pass: `npm run build -w @memorag-mvp/web`
- pass: Firefox／WebKit required test discovery（50 tests）
- pass: `npm run docs:web-inventory:check`
- pass: `npm run docs:web-trace:test`（13 tests）
- pass: `npm run test:web-semantic-ui`（5 tests）
- pass: `python3 scripts/validate_docs.py`
- pass: `npm run docs:hidden-unicode:check`
- pass: `npm run check:taskfile-aliases`
- blocked locally: 追加6 E2Eの実走。正規起動は`tsx` IPC socketの`EPERM`、代替起動後はFirefox／WebKit host library不足によりbrowser page作成前で停止した。test assertionの失敗ではないが、CI成功までは未検証として扱う。

## 成果物

- task: `tasks/do/20260905-0843-issue-345-chat-cross-browser-state.md`
- 仕様分析: `reports/working/20260905-0843-issue-345-chat-cross-browser-state-spec-analysis.md`
- E2E: `apps/web/e2e/cross-browser-state.spec.ts`
- 正本: `REQ_SERVICE_QUALITY_016.md`、`REQ_NON_FUNCTIONAL_018.md`、`DES_UI_UX_001.md`
- join metadata／生成物: `tools/web-inventory/ui-*.json`、`docs/generated/web-*`

## 指示への fit 評価

- small improvement: production変更なしの独立した3 scenario／6 browser testに限定した。
- non-duplication: #461のproduction UI変更と重複せず、前回までのSTATE-001〜004とも別画面・別IDである。
- traceability: screen、REQ、AC、E2E、evidence pathを一意のjoinで同期した。
- honest completion: local browser実走、CI、manual evidence、owner判断を未完了として維持する。

## 未対応・制約・リスク

- 最終headのCI成功、PR／Issue証跡はcommit・push後に追記する。
- route fixtureはproduction incident、実API／SSE、実認可、RAG回答品質を証明しない。
- 代表screen reader、native AX tree、実ブラウザ200%／400% zoom、touch／実機は未検証である。
- #461統合後の再検証、FR-051／OQ-UI-002のowner判断、API C1 85%、既存E2E tsconfig不整合は未完了である。
- 累積task全体の未完了条件があるためtaskは`do`、PRはDraftを維持する。
