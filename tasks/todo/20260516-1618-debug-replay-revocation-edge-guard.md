# debug replay・権限失効中断・edge rate limit 方針を実装する

保存先: `tasks/todo/20260516-1618-debug-replay-revocation-edge-guard.md`

## 状態

- todo

## タスク種別

- 機能追加

## 背景

Phase J2 で DebugTrace 4 tier metadata、public allowlist、CORS guard、SSE reconnect、worker contract は実装済み。残 scope-out として debug replay 実行 API、監査ログ記録、resource permission revoked 中断、edge/WAF/CDN rate limit が残っている。

## 目的

debug/trace の安全な replay と、実行中の権限失効・public endpoint abuse 対策を運用可能な形にする。

## 対象範囲

- `apps/api/src/routes/debug-routes.ts`
- chat / ingest / async agent run status handling
- audit log
- infra / edge docs
- OpenAPI docs

## 実行計画

1. replay 対象、入力、redaction、権限を定義する。
2. replay API は sanitize 済み trace のみに限定し、raw prompt/secret/権限外文書を再投入しない。
3. run 中に resource permission が失効した場合の中断・記録・SSE 通知を設計する。
4. `/openapi.json` など public endpoint の rate limit / WAF / CDN 方針を infra/docs に追加する。
5. replay / revoked / abuse guard の audit log を追加する。

## 受け入れ条件

- debug replay は `debug:replay` など明示権限で保護される。
- replay 入力に raw secret、raw prompt、権限外文書内容を含めない。
- 実行中に必要 resource permission を失った場合、継続利用せず中断または安全側に倒れる。
- replay と permission revoked は audit log に残る。
- public endpoint rate limit / edge guard の実装または未実施理由が docs/PR に記録される。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/routes/debug-routes.test.ts`
- `npm run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts`
- `npm run docs:openapi:check`
- `git diff --check`

## PRレビュー観点

- replay が debug trace の redaction 境界を越えていないか。
- permission revoked 後に権限外 evidence や file mount が継続利用されないか。
- public endpoint の abuse guard を実装済みと過大表現していないか。

## 関連

- `docs/spec/gap-phase-j2.md`
- `docs/spec/gap-phase-j1.md` `J1-REM-003`
