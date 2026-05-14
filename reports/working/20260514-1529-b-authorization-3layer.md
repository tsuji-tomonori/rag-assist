# B authorization 3-layer foundation 作業完了レポート

- 作成日: 2026-05-14 15:29 JST
- 対象 task: `tasks/do/20260514-1518-b-authorization-3layer.md`
- 対象 branch: `codex/phase-b-authorization-3layer`

## 指示

`.workspace/wsl-localhost-ubuntu-home-t-tsuji-proje-vivid-cloud.md` の plan に従い、Wave 2 の `B-authorization-3layer` を完了まで進める。

## 要件整理

- 仕様 16 の account status / feature permission / resource permission の 3 層認可 foundation を追加する。
- 仕様 17 の `EffectiveFolderPermission` を型と comparator で表現する。
- route authorization metadata に operation key、resource condition、generic 403 contract を追加し、静的 policy test で検証する。
- requester / owner / benchmark seed / upload session / document ingest run の既存境界を弱めない。
- `benchmarkSeedListOrPermission` の `/documents` visibility は変更せず、open question として残す。

## 実施作業

- `apps/api/src/auth.ts` に `accountStatus` を追加し、local auth と Cognito custom claim から `AppUser` へ反映した。
- `apps/api/src/authorization.ts` に `AccountStatus`、`EffectiveFolderPermission`、resource condition、operation metadata、generic 403 helper を追加した。
- chat / history / question / document / benchmark / admin / debug routes の `x-memorag-authorization` metadata に operation key と resource condition を付与した。
- benchmark seed / document upload / upload session 周辺の一部 403 message を generic `Forbidden` に統一した。
- `access-control-policy.test.ts` に operation matrix subset、resource condition、error disclosure、generic 403 body の静的検証を追加した。
- `authorization.test.ts` と `api-contract.test.ts` に account status、folder permission、generic 403、benchmark seed 境界の回帰テストを追加・更新した。
- `docs/spec/gap-phase-b.md` に B 実装で解消した gap と残した open question を追記した。

## 成果物

- `apps/api/src/auth.ts`
- `apps/api/src/authorization.ts`
- `apps/api/src/openapi-doc-quality.ts`
- `apps/api/src/routes/*.ts`
- `apps/api/src/authorization.test.ts`
- `apps/api/src/contract/api-contract.test.ts`
- `apps/api/src/security/access-control-policy.test.ts`
- `docs/spec/gap-phase-b.md`
- `tasks/do/20260514-1518-b-authorization-3layer.md`

## 検証

- pass: `npm exec -w @memorag-mvp/api -- tsx --test src/contract/api-contract.test.ts src/authorization.test.ts src/security/access-control-policy.test.ts`
- pass: `npm run test -w @memorag-mvp/api`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- pass: `git diff --check`

## fit 評価

- 3 層認可 foundation と route metadata の静的検証は実装済み。
- 既存の resource boundary は API 全体テストで回帰なしを確認した。
- `benchmarkSeedListOrPermission` の visibility は plan 通り変更せず、B gap doc と task に open question として残した。

## 未対応・制約・リスク

- 仕様 18/19 の permission / role rename は互換影響が大きいため未実施。
- support / async agent / debug 4 tier / service secret 境界は後続 Phase の対象。
- `AccountStatus` の source of truth は token claim / local auth に限定され、user directory 連携は後続強化対象。
