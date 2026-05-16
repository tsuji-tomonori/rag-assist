# Temporary wildcard CORS

## 背景

2026-05-16 04:13:38Z の Lambda ログで、production 起動時に `CORS_ALLOWED_ORIGINS must not include * in production` が uncaught exception となっている。ユーザーから「いったん cors は `*` にして」と依頼された。

## 目的

独自ドメイン確定までの一時措置として、production の `CORS_ALLOWED_ORIGINS=*` で API Lambda が起動できるようにする。

## スコープ

- API runtime config の production CORS validation
- API contract / security static test の期待値
- 既存 docs との同期確認
- 作業レポート

## タスク種別

修正

## なぜなぜ分析

### 問題文

production Lambda が 2026-05-16 04:13:38Z に `CORS_ALLOWED_ORIGINS must not include * in production` で起動失敗し、API handler 読み込み前に例外終了している。

### confirmed

- `apps/api/src/config.ts` は production かつ `CORS_ALLOWED_ORIGINS` に `*` が含まれる場合に例外を投げる。
- CDK の API Lambda environment は `CORS_ALLOWED_ORIGINS: "*"` を設定している。
- `docs/OPERATIONS.md` と `docs/3_設計_DES/41_API_API/DES_API_001.md` は独自ドメイン未確定期間の一時措置として production `*` 許容を記載している。
- `apps/api/src/security/access-control-policy.test.ts` は production wildcard CORS 拒否を静的に期待している。

### inferred

- 2026-05-14 の J2 middleware hardening で production wildcard guard が再導入され、2026-05-10 の一時許容方針と矛盾した可能性が高い。

### open_question

- いつ具体 origin allowlist に戻すかは未確定。ドメイン確定後に別タスクで戻す必要がある。

### root_cause

runtime config の production validation が、現在の deployment environment と運用 docs の一時方針に同期しておらず、`CORS_ALLOWED_ORIGINS=*` を fail-closed として扱っていた。

### remediation

- production の `CORS_ALLOWED_ORIGINS=*` を一時的に許容し、未設定拒否は維持する。
- contract test を `*` 許容の期待に戻す。
- security static test は wildcard CORS が恒久安全策ではないことを確認しつつ、現在の一時許容方針と docs 同期を固定する。
- PR / report に外部公開面が広がる残リスクと、ドメイン確定後に allowlist へ戻す必要を明記する。

## 実施計画

1. `config.ts` の production wildcard 拒否を外し、未設定拒否を維持する。
2. API contract test と security static test を一時許容方針に合わせる。
3. 関連 docs を確認し、必要なら最小更新する。
4. 対象 API test と `git diff --check` を実行する。
5. 作業レポートを作成する。
6. commit / push / PR / 受け入れ条件コメント / セルフレビューコメントまで進める。

## ドキュメント保守計画

`docs/OPERATIONS.md` と `docs/3_設計_DES/41_API_API/DES_API_001.md` は既に一時許容方針を記載しているため、差分確認後、追記が必要な場合のみ更新する。

## 受け入れ条件

- [ ] production config が `CORS_ALLOWED_ORIGINS=*` で起動できる。
- [ ] production config が `CORS_ALLOWED_ORIGINS` 未設定の場合は引き続き起動失敗する。
- [ ] CORS allowed header の `Last-Event-ID` と public allowlist 境界を壊さない。
- [ ] 一時的な wildcard CORS の残リスクと、具体 origin allowlist へ戻す必要が report / PR に明記される。
- [ ] 対象テストと差分チェックが実行される。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/contract/api-hardening.test.ts src/security/access-control-policy.test.ts`
- `git diff --check`

## 実装結果

- `apps/api/src/config.ts` から production の wildcard CORS 拒否を外し、`CORS_ALLOWED_ORIGINS` 未設定拒否は維持した。
- `apps/api/src/contract/api-hardening.test.ts` を production `CORS_ALLOWED_ORIGINS=*` 許容の期待へ更新した。
- `apps/api/src/security/access-control-policy.test.ts` は public allowlist / `Last-Event-ID` / `OPTIONS` 境界を維持しつつ、production CORS origin の明示指定を確認する期待へ更新した。
- docs は既に一時許容方針を記載していたため追加更新しなかった。

## 検証結果

- `npm ci`: pass。worktree に `node_modules` がなかったため実行。npm audit は既存依存で 4 件の vulnerability を報告。
- `npm run test -w @memorag-mvp/api -- src/contract/api-hardening.test.ts src/security/access-control-policy.test.ts`: pass。script の glob により API tests 248 件が実行された。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。

## PR review points

- `AUTH_ENABLED=true` / Cognito 必須の production guard は維持されているか。
- wildcard CORS が認証・認可を緩める変更ではないこと。
- docs と test が一時許容方針に同期していること。

## リスク

- `CORS_ALLOWED_ORIGINS=*` は任意 origin からブラウザ API 呼び出しを許可するため、外部公開面は広がる。
- 機微データ保護は CORS ではなく Cognito 認証と route-level permission に依存する。
- ドメイン確定後に具体 origin allowlist へ戻す別対応が必要。

## 状態

done
