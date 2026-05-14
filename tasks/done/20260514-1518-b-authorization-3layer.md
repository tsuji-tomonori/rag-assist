# B authorization 3-layer foundation
状態: done
タスク種別: 機能追加
発注元 wave: Wave 2
依存タスク: `tasks/done/20260514-1506-b-pre-gap.md`
仕様参照:
  - `docs/spec/2026-chapter-spec.md` の章 16 / 17 / 18 / 19 / 20 / 21 / 21A
  - `docs/spec/CHAPTER_TO_REQ_MAP.md` の 16 / 17 / 18 / 19 / 20 / 21 / 21A
  - `docs/spec/gap-phase-b.md`

## 背景

Wave 2 の認可基盤は後続 wave のブロッカーである。

B-pre で、現行実装は feature permission と一部 route 固有 resource check が分散しており、仕様 16 の 3 層認可と章 20 の operation matrix を表す型付き metadata が不足していることを確認した。

## スコープ

- 含む:
  - `authorization.ts` への `AccountStatus`、`EffectiveFolderPermission`、resource condition、operation metadata の追加。
  - route authorization metadata へ章 20 相当の operation key / resource condition / error disclosure を持たせる。
  - 403 error の既定 response を generic にし、internal permission 名を露出しにくくする。
  - `access-control-policy.test.ts` と `authorization.test.ts` の拡張。
  - B-pre gap doc / 作業レポートの更新。
- 含まない:
  - 仕様 18/19 の全 permission / role rename。
  - support / async agent / debug 4 tier / CI IAM / secret access の実装。
  - 新規 route 追加。
  - `benchmarkSeedListOrPermission` の visibility 変更。意図確認が必要な open question として維持する。

## 実装計画

1. `authorization.ts` に 3 層認可の foundation 型と helper を追加する。
2. `routeAuthorization` の metadata に operation key、resource condition、error disclosure を追加する。
3. `requirePermission` の既定 403 message を `Forbidden` に変更する。
4. 主要 route の metadata に operation/resource condition を追加する。
5. `access-control-policy.test.ts` で operation metadata と generic 403 docs を静的検証する。
6. `authorization.test.ts` に account status、folder permission comparator、generic 403 の回帰テストを追加する。
7. 対象テスト、API test、typecheck、diff check、spec recovery validator を実行する。
8. 作業完了レポートを作成する。
9. PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを入れる。
10. task md を `tasks/done/` へ移動し、同じ PR branch に commit / push する。

## ドキュメント更新計画

- `docs/spec/gap-phase-b.md`: B 実装で解消した gap と残した open question を追記。
- `reports/working/20260514-1518-b-authorization-3layer.md`: 作業完了レポートを追加。

## 受け入れ条件 (acceptance criteria)

- [x] `EffectiveFolderPermission` と resource permission comparator が実装・テストされている。
- [x] `AccountStatus` の active guard が `requirePermission` に含まれている。
- [x] route authorization metadata が operation key / resource condition / generic 403 error disclosure を表現できる。
- [x] `access-control-policy.test.ts` が route metadata と handler permission check に加え、operation/resource/error contract を検証している。
- [x] 既存の requester / owner / benchmark seed / upload session / document ingest run の例外を壊していない。
- [x] `benchmarkSeedListOrPermission` の visibility は変更せず、open question として記録している。
- [x] 関連 API tests と typecheck が pass している。
- [x] `git diff --check` が pass している。

## 検証結果

- pass: `npm exec -w @memorag-mvp/api -- tsx --test src/contract/api-contract.test.ts src/authorization.test.ts src/security/access-control-policy.test.ts`
- pass: `npm run test -w @memorag-mvp/api`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- pass: `git diff --check`

## 検証計画

- `npm exec -w @memorag-mvp/api -- tsx --test src/authorization.test.ts src/security/access-control-policy.test.ts`
- `npm run test -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/api`
- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- `git diff --check`

## PR レビュー観点

- 認可境界を弱めていないか。
- 403 response が内部 permission 名や resource 存在を示唆しにくくなっているか。
- `rolesWithAnyPermission` を最終認可として誤用していないか。
- benchmark / dataset 固有値を implementation に混ぜていないか。
- support / async agent / debug 4 tier など後続 Phase の範囲を B に混ぜていないか。

## リスク・open questions

- `benchmarkSeedListOrPermission` の `/documents` visibility は現行挙動を維持する。seed 限定へ変える場合は別途 product 意図確認と回帰テストが必要。
- `AccountStatus` の source of truth は現時点で token / local auth に限られ、user directory 連携は後続強化対象。
- operation metadata はまず既存 route subset を対象にし、未実装操作は planning gap のまま残す。
