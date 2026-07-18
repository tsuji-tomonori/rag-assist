# Issue #359 Phase B1: session-local context store / API / security

- 状態: todo
- タスク種別: contract・store・API・security 実装
- base: Phase A final head（docs-only stacked）、または Phase A が merge 済みならその時点の最新 `origin/main`
- 関連 PR: `#338`

## 目的

旧 PR #338 を機械適用せず、current main の tenant+user partitioned conversation history と temporary attachment lifecycle に整合する authoritative session context の保存・API・security boundary を実装する。

## 受け入れ条件

- [ ] session context schema/store は `tenantId + ownerUserId + sessionId` に binding し、client 指定 tenant/actor を authority にしない。
- [ ] context は active temporary scope/document reference、expiry、removed/revoked stateを保持し、schema version/migration/size limitを定義する。
- [ ] save/list/get/deleteは authenticated actor の tenant/user/session scope 外を返さず、unknown/cross-tenant/cross-user IDをnon-enumerating denyにする。
- [ ] MT-TEMP-001〜006 の storage側: active scope persistence、removed、TTL、session mismatch、user/tenant mismatchをstore/service/API testで検証する。
- [ ] expired/removed/revoked contextはhistory再読時にactiveとして返さず、durable cleanup/revocation stateと不整合を残さない。
- [ ] temporary evidenceは通常 Document/Folder list APIへ出ず、MT-TEMP-007 API negative testを追加する。
- [ ] readOnly/権限なし actorの通常保存・移動・共有 mutationをserver-sideで拒否し、MT-TEMP-008 negative testを追加する。
- [ ] route/schema/store変更に必要なpermission、owner boundary、response allowlist、`access-control-policy.test.ts`を同期する。
- [ ] contract/REQ/DES DATA/API/OPS、OpenAPI、source-backed API docsをcurrent contractに同期する。
- [ ] targeted contract/store/API/security test、typecheck、docs check、root CI、GitHub Actions final-head CIが成功する。
- [ ] Phase A final head向けstacked draft PR、受け入れ条件comment、self-review、task/report lifecycleを完了する。

## 対象外

- RAG normalization/retrieval/answer/trace接続。Phase B2で扱う。
- Web history restore/chip/remove/citation label。Phase Cで扱う。
- #338 close/merge、旧patchのcherry-pick、deploy/release。
