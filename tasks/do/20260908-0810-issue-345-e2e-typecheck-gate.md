# Issue #345 E2E TypeScript を必須 gate にする

- 状態: do
- タスク種別: 修正
- 対象Issue: #345
- 対象PR: #470
- 作成日時: 2026-09-08 08:10 JST

## 背景

Draft PR #470 head `313a5382` は current `main@8e542b31` を祖先に含み、behind 0である。Firefox／WebKit required scopeは60件まで拡張されたが、通常のWeb typecheckは`apps/web/src/`とVite設定だけを対象とし、`apps/web/e2e/tsconfig.json`を実行するpackage script／CI stepがない。このためE2E sourceの型不整合はPlaywright実行時まで検出されず、browser install後に初めて失敗する可能性がある。

並行PR #341〜#344はmerge済みであり、open PR #461はshared UI／benchmark production sourceを変更する。今回sliceはproduction source、test scenario、正本のUI挙動を変更せず、既存E2E sourceの静的検査経路だけを追加する。

## 目的

`apps/web/e2e/tsconfig.json`を一意なE2E型検査設定としてpackage scriptとWeb UI Qualityに接続し、Chromium／Firefox／WebKitのbrowser install・実走前にrequired E2E source全体の型不整合を検出する。

## スコープ

### 対象

- `apps/web/package.json`のE2E専用typecheck script
- `.github/workflows/web-ui-quality.yml`の必須E2E TypeScript jobとbrowser job依存
- `apps/web/e2e/README.md`
- `NFR-018`／`DES_UI_UX_001`の品質gate実装記録
- task／spec analysis／working report

### 対象外

- production component／CSS／API／authorization／RAG contract
- E2E scenario、required件数、browser matrixの変更
- profileのFR-051永続化／状態分類
- representative screen reader、実browser 200%／400% zoom、touch／実機
- #461統合後のproduction DOM再検証
- API typecheck／test／build、API C1 85%
- merge、deploy、release、force-push

## 入力と確定事項

- `confirmed`: current `main@8e542b31`、#470 head `313a5382`、behind 0。
- `confirmed`: `npm run typecheck -w @memorag-mvp/web`は`apps/web/tsconfig.json`により`src/**/*.ts(x)`と`vite.config.ts`だけを検査する。
- `confirmed`: `npx tsc -p apps/web/e2e/tsconfig.json --noEmit`は現headで成功する。
- `confirmed`: Web UI Qualityは各browser jobで`npm ci`後にbrowserをinstallし、E2E sourceの明示的typecheckを実行しない。
- `open_question`: representative screen reader／OS／browser／device matrixとownerは`OQ-UI-002`未決。

## 実施計画

1. Web workspaceへ`typecheck:e2e`を追加し、既存E2E tsconfigを明示的に実行する。
2. Web UI Qualityへbrowser非依存のE2E TypeScript jobを追加する。
3. Chromium／required cross-browser／scheduled cross-browser jobを型検査jobに依存させ、型不整合時にbrowser installへ進まない。
4. E2E README、NFR-018、UI設計へcommand、責務、failure境界を同期する。
5. lint、Web／E2E typecheck、Web unit／build、Playwright discovery、docs checks、workflow構文を検証する。
6. Draft PR、受け入れ確認、セルフレビュー、Issue #345へ結果と未完了事項を記録する。

## ドキュメント保守計画

- 要件自体は変更せず、既存`NFR-018`の自動品質gate実装へE2E source typecheckを追記する。
- `DES_UI_UX_001`にtypecheck責務とbrowser jobのfail-fast順序を記録する。
- `apps/web/e2e/README.md`をローカル実行の手順書として更新する。
- UI trace／quality matrix／generated Web inventoryは挙動・E2E ID・件数を変更しないため再生成差分なしをcheckで確認する。

## 受け入れ条件

- [x] `npm run typecheck:e2e -w @memorag-mvp/web`が`apps/web/e2e/tsconfig.json`を使って全E2E TypeScript sourceを検査する。
- [x] Web UI QualityがPR／schedule／manual dispatchでE2E TypeScript jobを実行し、非0ならbrowser jobを開始しない。
- [x] Chromium required、Firefox／WebKit required、scheduled Firefox／WebKitの全jobが同じ型検査jobへ依存する。
- [x] E2E README、NFR-018、DES_UI_UX_001でcommand、責務、実行順が一致する。
- [x] E2E scenario／required件数、production source、UI trace／quality statusを変更しない。
- [x] 選定したlint、Web／E2E typecheck、Web unit／build、E2E discovery、docs checks、workflow構文、`git diff --check`が成功する。
- [ ] Draft PR #470、PR受け入れコメント、セルフレビュー、Issue #345進捗を更新する。

## ローカル検証結果

- PASS: `npm run typecheck:e2e -w @memorag-mvp/web`。
- PASS: Web typecheck、66 files／473 unit tests、Web build。
- PASS: E2E source ESLint、required Firefox／WebKit 60 tests／6 files discovery。
- PASS: workflow YAML parseと`e2e-typecheck`への3 job dependency assertion。
- PASS: trace 13件、semantic UI 5件、manual evidence contract 7件、Web inventory freshness、canonical docs structure、OpenAPI quality、API code 99 APIs／594 documents、infra inventory、hidden Unicode、Taskfile alias、`git diff --check`。
- INFO: `task docs:check`はTask runner不在で起動不可。同Taskfileの構成commandを直接実行した。OpenAPI npm scriptは`tsx` IPCがsandboxで`EPERM`となったため、同じsourceを`node --import tsx`で実行して成功した。
- BLOCKED: final-head GitHub Actions、branch protectionへの新job status登録要否のowner確認。

## 検証計画

- `npm run typecheck:e2e -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- repository lint／Web unit／build
- required Playwright 60件 discovery
- Web trace／semantic UI／inventory freshness／canonical docs／hidden Unicode／Taskfile alias
- workflow YAML parse／`git diff --check`
- final-head Web UI Quality／MemoRAG CI／semver

## PRレビュー観点

- E2E tsconfigを複製せず、package scriptが既存正本を参照すること。
- typecheckがbrowser installより前に一度だけ実行され、browser jobが同じ前提へ依存すること。
- production挙動、E2E scope、manual evidence statusを過大変更しないこと。
- #461のproduction ownershipと競合しないこと。

## リスク・未完了境界

- TypeScript成功はbrowser runtime、representative screen reader、実zoom、実機を保証しない。
- workflow job追加によりbranch protectionのrequired status設定確認がowner作業として必要になる可能性がある。
- API既存失敗とAPI C1 85%、FR-051、OQ-UI-002、#461統合後の再検証は未完了を維持する。
- 累積PRにmanual／owner判断待ちが残るため、本taskは自動受け入れ条件完了後も`do`を維持する。
