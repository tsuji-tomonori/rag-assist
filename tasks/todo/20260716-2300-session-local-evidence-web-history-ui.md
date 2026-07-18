# Issue #359 Phase C: session-local evidence Web/history UI

- 状態: todo
- タスク種別: Web・history UX 実装
- base: Phase B2 PR head
- 関連 PR: `#338`

## 目的

Phase B1/B2 の authoritative context と RAG contract を使い、session-local attachment の継続表示、削除、履歴再開、citation 補助表示を production UI に実装する。

## 受け入れ条件

- [ ] MT-UI-001/002: active temporary attachment chip が送信後も同一 session の次ターンに残り、remove が server context/history state に反映される。
- [ ] MT-UI-003: authoritative citation metadata が temporary evidence を示す場合だけ「参照した一時添付」と表示する。
- [ ] MT-UI-004: history 再開時に同じ tenant/user/session の TTL 内 active attachment だけを復元し、expired/removed/revoked は復元しない。
- [ ] MT-TEMP-007 UI evidence: temporary attachment は通常 Document/Folder 一覧に表示しない。
- [ ] MT-TEMP-008 UI evidence: readOnly/権限なしの通常保存・移動・共有 control を表示または有効化せず、API deny を UI authorization の代替にしない。
- [ ] loading/empty/error/permission/expired/revoked/stale/retry state を API/history/props/state から正直に表示する。
- [ ] fake attachment、固定件数・日付・user、demo fallback、未実装 control を production path に追加しない。
- [ ] chip/remove/history/citation の keyboard、name/role/state、focus、mobile layout を component/E2E test で確認する。
- [ ] Web type/API client/contract、REQ/DES UI、generated Web trace/inventory を同期する。
- [ ] targeted Web test、coverage、typecheck、docs check、root CI、GitHub Actions final-head CI が成功する。
- [ ] Phase B2 head 向け stacked draft PR を作成し、B1→B2→C 順序を明記する。
- [ ] Phase B1/B2/C PR 作成後、#338 body/comment を replacement link と superseded 理由で更新する。#338 を close/merge しない。
- [ ] 受け入れ条件コメント、セルフレビュー、task/report lifecycle を完了する。

## 対象外

- server-side context/store/API contractの再設計はPhase B1、RAG normalization/reauthorization contractの再設計はPhase B2へ返す。
- #338 close/merge、deploy/release。
