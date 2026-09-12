# Issue #345 チャット keyboard required gate 作業記録

- 保存先: `reports/working/20260810-0853-issue-345-chat-keyboard-required-gate.md`
- 対象: Issue #345 / Draft PR #462
- current main: `8e542b31da137129927c1ea8d21650b0c0d483c8`
- 作業起点のPR head: `c0b79d9ae5b7f70d8f9da6c065b24f04f555d715`

## 1. 受けた指示

- current main、前回差分、open PR / Issue、task、正本・生成文書を確認し、Issue #345を重複なく前進させる。
- 320px / 400% zoom、keyboard、screen reader、共通状態、画面からE2Eまでの追跡を優先する。
- 最新mainから分離したworktreeでtask、実装、文書同期、検証、Draft PR、Issueコメントまで進める。
- 未検証・CI待ち・owner判断を完了扱いせず、merge / deploy / release / force-push /破壊的変更を行わない。

## 2. 入力と選定

- current mainは前回と同じ`8e542b31`、PR #462はbehind 0 / ahead 44でDraft・mergeableだった。
- open PR #458 / #460 / #463〜#465は主にAPI・RAG・infra、#461は本番shared UI / Chat componentを変更する。今回のCSS、E2E、SQ-016、UI traceとは直接重複しない。
- quality matrixを8画面×8 ACで再集計し、chat / assignee / admin / documents / profileにautomated gapが残ることを確認した。
- chatは既存required state E2EとChromium AX baselineがある一方、`AC-SQ016-002`だけがkeyboard journey待ちで、本番`.composer textarea`の`outline: 0`に代替indicatorがないことをsourceから再現できた。この局所修正とrequired gate追加を今回の1件に選定した。

## 3. なぜなぜ分析

### confirmed

- ChatComposerはnative textareaと既定Enter送信を実装する。
- `.composer textarea`は`outline: 0`でbrowser既定focus indicatorを無効化する。
- 代替focus-visible / focus-within indicatorがなく、required `keyboard-navigation.spec.ts`もchat入力から回答までを通らない。

### 根本原因

- 発生原因: browser outlineを消した際に代替indicatorを同時定義しなかった。
- 流出原因: required keyboard gateがnavigation中心で、chat composerを対象にしていなかった。

### 対応

- `.composer:focus-within`へ3px solid / 2px offset indicatorを追加する。
- required `E2E-UI-KEYBOARD-NAV-001`へ質問textboxのTab focus、computed composer outline、Enter送信、処理中、回答復帰、startRun / SSE回数を追加する。

## 4. 実施内容

- current mainから専用worktreeを作り、受け入れ条件付きtaskを先にcommitしてからPR #462 headを非破壊統合した。
- `chat.css`へ入力領域全体の3px focus indicatorを追加した。Chat component、API、permission、RAG回答は変更していない。
- E2E内にstartRun / SSE fixtureを閉じ、処理中をdeterministicに観測してからfinal回答をreleaseするようにした。
- `SQ-016`、`DES_UI_UX_001`、`ui-traceability.json`、quality matrix、E2E READMEを同じ`E2E-UI-KEYBOARD-NAV-001`へ同期した。
- 正規generatorでWeb inventory、screen / trace / quality matrix生成物を更新した。
- chat / `AC-SQ016-002`のautomatedだけを`pass`へ更新し、manual / overallは`blocked`を維持した。

## 5. 正本基準レビュー

### 判定

- 今回のautomated slice: ローカル静的・unit・docs検証は合格、Chromium実走はfinal-head CI待ちのため条件付き。
- Issue #345 / `SQ-016`全体: 不合格（未完了）。manual evidence、他画面のautomated gap、FR-051 owner判断、API C1が残る。

### 観点別評価

| 観点 | 評価 | 根拠 |
| --- | --- | --- |
| 正本・実装・E2E整合 | 合格 | chat view→SQ-016→AC-SQ016-002→E2E-UI-KEYBOARD-NAV-001をauthored JSONと生成物へ同期 |
| keyboard focus | 条件付き | CSSとcomputed assertionを追加。Chromium実走はCI待ち |
| 競合回避 | 合格 | #461が触るChat componentを変更せず、局所CSS / E2E / UI正本だけを更新 |
| manual accessibility | 不合格 | pass 0 / blocked 3 / not_run 1 / ready false |
| scope / security | 合格 | production API、permission、RAG grounding、dataset分岐を変更しない |

## 6. 検証

### pass

- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`: 62 files / 446 tests
- `npm run build -w @memorag-mvp/web`: pass。既存chunk-size advisoryのみ
- `npm run docs:web-trace:test`: 13 tests
- `npm run test:web-semantic-ui`: 5 tests
- `python3 scripts/validate_docs.py`
- `node --import tsx apps/api/src/validate-openapi-docs.ts`
- API code docs: 98 APIs / 588 documents fresh
- manual evidence contract: 7 tests、baseline構造valid / release-ready false
- Web inventory / quality matrix / infra inventory / hidden Unicode / `git diff --check`
- required targeted Playwright discovery: Chromium 1 test

### blocked / 未実施

- targeted Chromium実走1回目: API scriptの`tsx` IPCが`listen EPERM`で停止した。
- IPCを使わない`node --import tsx`でAPI / Viteを同一sandbox内に起動して再試行し、Playwright Chromium executableが未導入であることを確認した。browser downloadや権限拡張は行わず、final-head Web UI Qualityを必須判定とする。
- `task docs:check`: `task` binary未導入のため実行不能。解決先の全9コマンドを直接実行し、OpenAPIだけ`tsx` IPCを避ける同一entrypointで確認した。
- representative screen reader、実browser 200% / 400% zoom、touch / 実機、Firefox / WebKitは未実施。

### 初回final-head CIと修正

- Web UI Quality run `31343805209`は36 / 37で失敗した。`processing-row`表示後もstartRun / SSE route callbackが完了していない場合があり、同期的な回数assertが0を観測した。
- 発生原因はE2Eの非同期route到達に対する待機不足で、本番実装の失敗ではない。`startRuns`と`eventReads`を`expect.poll`で1になるまで待つよう修正した。
- 修正後にlint、Web typecheck、対象Playwright discovery（Chromium 1件）を再確認した。Chromium実走はfinal-head CIで再判定する。

## 7. 残余リスクと次の作業

1. CI待機修正をGitHub AppsでDraft PR #462 branchへnon-force publishする。
2. 新しいfinal-head Web UI Quality、MemoRAG CI、semver検査を確認し、失敗時はlog根拠で修正またはblockerを記録する。
3. PR本文、受け入れ条件、セルフレビュー、Issue #345へfinal headと未完了事項を同期する。
4. representative screen reader、実browser zoom、touch / 実機は既存manual taskで取得する。
5. FR-051永続化とAPI C1は既存owner / coverage taskへ分離したままにする。

merge、deploy、release、force-push、破壊的変更は実施しない。
