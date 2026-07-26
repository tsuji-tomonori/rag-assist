# Issue #359 Web root API barrel の feature/shared entry 収束

- 状態: todo
- 種別: リファクタリング
- Issue: #359 Phase 1b follow-up
- 依存: PR #338 の merge / close / supersede 方針確定

## 背景

`apps/web/src/api.ts` は production から直接参照されていないが、root test 群が広範囲に依存し、open PR #338 も変更対象の `App.test.tsx` で type import を維持している。auth root shim 削除と同時に扱うと、約700行の API client test architecture と open PR rebase を混ぜるため、独立した rollback/review 単位にする。

## 作業前参照

- `apps/web/src/api.test.ts`: value/type export、動的 import、全 feature/shared client 契約
- `apps/web/src/App.test.tsx`: admin/benchmark/history/questions/shared type import
- `apps/web/src/authClient.test.ts`: documents API と runtime config helper import（auth test 移管後は feature test 側の参照になる）
- open PR #338: `apps/web/src/App.test.tsx` を変更中

## 実施方針

1. PR #338 の収束後の main で source/test/open PR/dynamic import を再棚卸しする。
2. type import を各 feature `types.ts` / shared type entry へ移行する。
3. API client test を feature/shared 実体と同居する test へ分割し、barrel export 自体を確認する legacy test を削除する。
4. runtime config module isolation test は正規 module を直接 dynamic import する。
5. root `api.ts` を削除し、legacy path 再導入 guard を追加する。

## 受け入れ条件

- [ ] active source/test/open PR に `apps/web/src/api.ts` 参照が0件。
- [ ] 全 type/value/dynamic import が feature/shared 正規 path を参照する。
- [ ] API client 契約 test が正規実体と同居し、既存 failure mode を維持する。
- [ ] root `api.ts` が存在せず、再導入 guard がある。
- [ ] root CI、Web coverage/typecheck/build、Web inventory/trace/semantic が成功する。
- [ ] 対象 API journey の E2E/smoke が成功する。
