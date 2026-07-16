# Issue #359 Phase B: session-local evidence server contract

- 状態: todo
- タスク種別: API・RAG・security 実装
- base: Phase A final head（docs-only stacked）、または Phase A が merge 済みならその時点の最新 `origin/main`
- 関連 PR: `#338`

## 目的

旧 PR #338 を機械適用せず、current main の conversation history、temporary attachment、evidence reauthorization、revocation cleanup に整合する server-side session-local evidence contract を実装する。

## 受け入れ条件

- [ ] authoritative session context schema/store は `tenantId + ownerUserId + sessionId` に binding し、client 指定 tenant/actor を authority にしない。
- [ ] context は active temporary scope/document reference、expiry、removed/revoked state を持ち、list/get/update が authenticated actor の tenant/user/session scope 外を返さない。
- [ ] MT-TEMP-001〜006: active scope 継承、base scope 合成、removed、TTL、session mismatch、user/tenant mismatch を normalization test で検証する。
- [ ] MT-CONTEXT-001〜006: previous citation anchor は source document/chunk 由来で、assistant 本文、expired/revoked/unauthorized evidence を根拠にしない。
- [ ] MT-RETRIEVE-001〜006: 複数 temporary scope と通常 scope の合成、current authorization、tenant/user/session isolation、revocation 後 deny を検証する。
- [ ] MT-ANSWER-001〜004 / MT-TRACE-001〜003: answer/citation は許可済み source に grounding され、trace は権限外存在や機微 ID を列挙しない。
- [ ] temporary evidence は通常 Document/Folder list API へ出ず、MT-TEMP-007 の API test を追加する。
- [ ] readOnly/権限なし actor の通常保存・移動・共有 mutation を server-side で拒否し、MT-TEMP-008 negative test を追加する。
- [ ] expired/removed/revoked/unknown/cross-tenant context は non-enumerating deny となり、durable cleanup/revocation state と不整合を残さない。
- [ ] route/schema/store 変更に必要な permission、owner boundary、response allowlist、`access-control-policy.test.ts` を同期する。
- [ ] REQ/DES/API/OPS、OpenAPI、source-backed API docs を current contract に同期する。
- [ ] targeted API/contract/security test、typecheck、docs check、root CI、GitHub Actions final-head CI が成功する。
- [ ] current main 向け draft PR、受け入れ条件コメント、セルフレビュー、task/report lifecycle を完了する。

## 対象外

- Web history restore、chip/remove、citation label、UI状態。Phase C で扱う。
- #338 の close/merge、旧 patch の cherry-pick、deploy/release。
