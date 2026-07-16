# Issue #359 PR #338 / #339 current-main 収束 Phase A 作業レポート

## 受けた指示

- origin/main の専用 worktree で #339 vs merged #357/current main を再監査し、#339 を superseded draft として整理する。
- #338 の古い42-file patchは適用せず、session-local evidence の原要求・未完 ID・current main evidenceを回収する。
- large replacement PRを避け、Phase A evidence/docs、Phase B server/security、Phase C Web/history UI の3段へ分割する。
- #338/#339 は close/mergeせず、deploy/releaseも行わない。

## 要件整理

- #339 は file overlap だけでなく、UsageEvent、pricing、completeness、export の semantic contractと executable testで包含を証明する。
- #338 は MT-TEMP/CONTEXT/RETRIEVE/ANSWER/TRACE/UI と未完 MT-UI-003/004・MT-TEMP-007/008 を current architectureへ割り当てる。
- Phase A は production codeを変更せず、task/report/PR metadataだけを成果物とする。

## 検討・判断

### #339

- GitHub Appsで全 changed filename pageを比較した。#339は115 files、#357は457 files、直接 overlapは49 filesだった。
- #339-only 66 filesのうち production pathは9 filesだった。旧 pricing/usage trackingの4 API pathは current canonical pathへの移動前の名称であり、残る5 Web pathは current mainに存在する。
- current mainには tenant-scoped UsageEvent/idempotency/query、provider/tokenizer/missing measurement、versioned pricing、missing/unpriced completeness、独立した usage/cost export permission、tenant audit、expiry/shadow運用、honest UI state、DynamoDB/IAMが揃う。
- #339固有の durable product requirementは確認できず、旧 schema/generated docs/infra snapshotの適用は現行 contractを巻き戻すため、#357/current mainを canonical replacementと判断した。

### #338

- current mainは同一会話の次ターンへの単一 temporary scope継承、tenant/owner/conversation/expiry retrieval boundary、tenant+user partitioned history、通常 document listからchat scopeを除く実装を持つ。
- authoritative session context、removed/revoked state、複数 scope normalization、history restore、temporary citation label、TEMP007/008 dedicated evidenceは未完である。
- server securityとWeb stateを同一PRにせず、Phase B/Cへ分割した。Phase BはPhase A final headからstack可能で、Phase A merge待ちを条件にしない。

## 実施作業

- Phase A taskに#339 evidence matrixと#338 requirement/current evidence traceを記録した。
- Phase B server contract taskとPhase C Web/history UI taskをatomic AC付きで作成した。
- GitHub Appsで#339をdraftへ変更し、bodyへsuperseded noticeを追記した。
- #339にcurrent-main再監査commentを投稿した: https://github.com/tsuji-tomonori/rag-assist/pull/339#issuecomment-4992878724
- #339はopen/draftのまま維持し、close/mergeしていない。
- GitHub Appsのdraft変換は応答に約160秒かかったが成功したため、`gh` fallbackは使用しなかった。

## 検証結果

- current-main API targeted 6 files: 成功。
  - `usage-event-store.test.ts`
  - `dynamodb-usage-event-store.test.ts`
  - `usage-pricing-catalog.test.ts`
  - `authorization.test.ts`
  - `access-control-policy.test.ts`
  - `memorag-service.test.ts`
- current-main Web targeted: 4 files / 34 tests 成功。
- `task docs:check`: 成功。docs validation、OpenAPI、97 APIs / 582 source-backed docs、Web trace/inventory、infra inventory、hidden Unicodeを確認した。
- infra test: 37/38成功。唯一の失敗はoffline install環境のCDK custom resource runtimeが`nodejs24.x`を生成し、repository snapshotの`nodejs22.x`と異なる環境依存差分だった。Usage/Costを含むresource testと残る37 testsは成功した。snapshotは変更せず、lockfile準拠のGitHub Actionsで最終判定する。
- dependencyは`npm install --offline --ignore-scripts --package-lock=false`で準備し、dependency versionと`package-lock.json`は変更していない。

## 成果物

- `tasks/do/20260716-2300-issue-359-pr338-pr339-convergence.md`
- `tasks/todo/20260716-2300-session-local-evidence-server-contract.md`
- `tasks/todo/20260716-2300-session-local-evidence-web-history-ui.md`
- #339 draft/body/comment metadata update。

## 指示へのfit評価

- production codeを変更せず、古いlarge PRをcurrent mainへ機械適用しない判断をevidence化した。
- server/securityとWeb/historyを分離し、No Mock UIとtenant/user/session/TTL/revocation/readOnly boundaryを後続ACへ落とした。
- 実施していない#338 replacement実装やinfra snapshot成功を完了扱いにしていない。

## 未対応・制約・リスク

- #338 body/commentのsuperseded link更新はPhase B/C replacement PR作成後に実施する。
- Phase B/Cの実装、product docs/OpenAPI/generated docs更新は未着手である。
- Phase A draft PR、受け入れ条件comment、self-review、task done、GitHub Actions final-head CIはこの後に実施する。
- #338/#339 close/merge、deploy、releaseは実施しない。
