# Issue #359 Phase B1 session-local context store/API/security 作業レポート

## 受けた指示

- Phase A PR #377 final headをbaseに専用worktreeを作り、Phase B1を開始する。
- tenant+user+sessionへ束縛したauthoritative context store/API/securityを実装する。
- #338の旧patchを機械適用せず、B2 RAGとC Web UIを本PRへ混在させない。

## 要件整理と判断

- 会話履歴を既存のtenant+user物理partitionとして再利用し、`ConversationHistoryItem` v3へ`sessionDocumentContext`を追加した。
- temporary evidence referenceは最大20件とし、scope/document/status/expiry/update時刻を保持する。
- active referenceのtenant、owner、`scopeType=chat`、temporary scope、expiryはclient値をauthorityにせずmanifestで再検証する。
- `expired` / `removed` / `revoked` はterminal stateとして保存し、通常の履歴再保存だけでactiveへ復活させない。
- 個別GETとDELETEはowner partitionだけを参照し、unknown/cross-user/cross-tenant IDを同じ404にする。

## 実施作業

- Local/DynamoDB conversation history storeへowner-partitioned `get` を追加した。
- `GET /conversation-history/{id}`、OpenAPI authorization metadata、静的access-control policyを追加した。
- 保存時manifest再検証、read時TTL正規化、context省略時の既存state保持、terminal-state復活防止を実装した。
- chat evidenceを通常文書一覧から除外し、通常文書write mutationへ流用できないguardとMT-TEMP-007/008 testを追加した。
- REQ/DES DATA/DES API、OpenAPI、source-backed API docsを同期した。

## 検証結果

- API typecheck: 成功。
- targeted store/schema/temporary-boundary tests: 4 files成功。
- access-control policy: 19 tests成功。
- API full suite: 804 tests成功、失敗0。
- root `task verify`: lint、全workspace typecheck/build成功。初回lintでtest importのtype-only指摘1件を検出し、修正後に再実行して成功した。
- docs validation、OpenAPI quality/freshness、98 APIs / 588 source-backed API docs、Web trace/inventory、infra inventory、hidden Unicode: 成功。
- `task docs:openapi`はsandbox内のtsx IPC socketが`EPERM`となったため、同じgeneratorを`node --import tsx`で実行して成功した。生成物freshnessも成功した。

## 成果物

- v3 `SessionDocumentContext` type/schema/store/API/security implementation。
- `GET /conversation-history/{id}` とnon-enumerating owner boundary。
- MT-TEMP-007/008を含むtargeted test。
- current contractへ同期したREQ/DES/OpenAPI/source-backed generated docs。

## 指示へのfit評価

- B1のauthoritative persistence/API/securityだけを実装し、RAG normalization/answer/traceとWeb history/chip UIは変更していない。
- client指定tenant/actorを保存authorityにせず、manifestとauthenticated actorを再検証するdeny-first boundaryにした。
- temporary evidenceを通常文書へ見せるdemo fallbackや暗黙変換を追加していない。

## 未対応・制約・リスク

- B2の毎ターンnormalization、retrieval/answer確定前reauthorization、citation/traceは未着手である。
- Cのhistory restore/chip/remove/citation labelとUI state/a11yは未着手である。
- stacked draft PR、受け入れ条件comment、self-review、task done、GitHub Actions lifecycleはこの後に実施する。
- #338 close/merge、deploy/releaseは実施しない。
