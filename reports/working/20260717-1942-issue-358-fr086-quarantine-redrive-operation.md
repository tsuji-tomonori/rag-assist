# Issue #358 FR-086 quarantine 解除・手動再投入操作面 作業レポート

- 作業日: 2026-07-17
- 対象: Issue #358 P1-A / FR-086
- stacked base: PR #424 final head `cba627f18a442a4b68efd51459ef3579d7e61f42`
- 作業ブランチ: `codex/issue-358-fr086-quarantine-redrive-operation`

## 受けた指示

FR-086 の正本文書で open だった production reconciliation quarantine の解除・手動再投入操作面について、既存実装と sibling PR #422 を証拠ベースで RCA する。owner 判断なしで tenant-scoped authorization、audit、idempotency、fail-closed を安全に確定できる場合だけ、重複しない bounded unit として実装し、worktree、task、検証、Draft stacked PR、PR/Issue 証跡まで完遂する。actual AWS/manual operation、merge、deploy、release は行わない。

## 要件整理と RCA

### confirmed

- quarantine は tenant-prefixed の同一 schema-v1 intent object に保存され、S3/local object version CAS で更新される。
- `quarantined` は通常の `listPending` から除外され、既存 scheduled worker は `pending` / `finalization_pending` を処理する。
- `requestedCompletion` の有無で quarantine 前の状態を `finalization_pending` / `pending` に一意復元できる。
- verified `AppUser` が authoritative tenant を持つ。`SYSTEM_ADMIN` は system recovery を担い、`ACCESS_ADMIN` の責務は role/policy/audit export である。
- API Lambda は audit producer のため docs bucket read/write を既に持ち、新 queue、prefix、IAM action は不要である。
- sibling PR #422 final head `c2f2556244496f288f0818f7234eb5cbd375fff9` は administrative principal transfer resolver/worker/IAM/docs を変更するが、outbox/API/permission は変更しない。

### inferred / 採用判断

- operator audit と status 復元を同じ intent object の同一 CAS に含めれば、未監査 redrive を防げる。
- exact permission `access:audit:redrive` を `SYSTEM_ADMIN` だけへ付与し、request body から tenant を受け取らないことで least privilege と tenant boundary を固定できる。
- API は resolver/domain mutation を直接呼ばず、status 復元後の既存 scheduled reconciliation に委譲する。
- 同一 idempotency key・actor・reason・policy version は worker 完了後も保存済み応答へ収束させ、payload drift や別 key の active intent 操作は conflict とする。

### conflict / 不採用

- 既存 audit read/export permission の流用は recovery 権限と意味が異なるため不採用。
- `ACCESS_ADMIN` への recovery permission 付与は既存責務と一致しないため不採用。
- object 削除、別 prefix への copy、新 queue への enqueue は監査喪失、追加 IAM、二重処理境界を作るため不採用。

### 根本原因

bounded retry/quarantine の初回 unit は automatic failure containment を実装した一方、manual recovery を別 rollback unit に分け、permission、operator audit、idempotency、状態遷移を未定義の open item として残していた。

## 実施作業

- `POST /admin/security-audit/quarantines/{intentId}/redrive` を追加した。
- canonical role catalog を v3 に更新し、`access:audit:redrive` を `SYSTEM_ADMIN` だけへ割り当てた。
- service 境界で active permission、verified actor tenant、canonical intent ID、idempotency key、reason を検証した。
- outbox の同一 object CAS で actor、reason、idempotency key、policy version、requestedAt、復元 status、旧 quarantine reconciliation evidence を immutable history として追記した。
- `requestedCompletion` の有無により `finalization_pending` / `pending` を復元し、current reconciliation counter を reset した。
- duplicate replay、payload drift、concurrent/active conflict、missing/cross-tenant、corrupt record、write failure を fail-closed にした。
- response を intent ID、復元 status、idempotency key、requestedAt、redrive count に限定した。
- redrive operator audit を既存 admin audit read model に `security_audit.quarantine.redrive` として投影した。
- protected route static policy、OpenAPI、source-backed API docs、FR-079、FR-086、requirements trace を同期した。
- sibling PR #422 の resolver を重複実装していない。

## 成果物

- quarantine operation service: `apps/api/src/security/security-mutation-audit-quarantine-service.ts`
- durable CAS/history: `apps/api/src/security/security-mutation-audit-outbox.ts`
- route/schema/access catalog: `apps/api/src/routes/admin-routes.ts`、`apps/api/src/schemas.ts`、`packages/contract/src/access-control.ts`
- security/contract tests: service、outbox、static access-control、HTTP contract、role catalog tests
- canonical docs: `REQ_FUNCTIONAL_079.md`、`REQ_FUNCTIONAL_086.md`
- generated docs: runtime OpenAPI と 98 API / 588 source-backed API documents

README、Web UI、運用手順、infra/IAM の変更は不要と判断した。操作は既存 API と scheduled worker を再利用し、推測 UI、新 resource、新 IAM action を追加しないためである。infra inventory freshness check でも非影響を確認した。

## 検証結果

- selected outbox/service/static/requirements tests: 成功
- contract package tests: 4/4 成功
- selected HTTP contract（OpenAPI、malformed、duplicate、missing、permission、unauthenticated）: 3/3 成功
- `npm run test:coverage -w @memorag-mvp/api`: 896 tests 成功、失敗0、statements/lines 90.71%、functions 93.45%
- `task docs:check`: 成功。docs structure、OpenAPI、98 API / 588 documents、web/infra inventory、hidden Unicode を確認
- `task verify`: 成功。lint、全 workspace typecheck、全 workspace build
- `npm run rag:release:source-audit`: 成功。dataset-specific branch 0、artifact mismatch 0
- `npm run ci`: 成功。contract 4、API 896、Web 442、infra 38、benchmark 102 tests と全 workspace build
- `git diff --check`: 成功

HTTP contract test は sandbox 内で `/tmp/tsx-*/.pipe` の `listen EPERM` となるため、固定コマンドを承認済み sandbox 外実行した。これは test failure ではなく実行環境の bind 制約であり、sandbox 外では成功した。

## 指示への fit 評価

- owner 判断なしで契約を確定できる証拠が揃ったため、decision-only ではなく bounded implementation unit を完遂した。
- tenant は verified actor だけから取得し、permission は `SYSTEM_ADMIN` だけ、cross-tenant/missing は同じ404、corrupt/store failure は sanitized 503 とした。
- audit persistence と redrive state transition は同じ CAS で不可分にし、失敗時は quarantine を維持する。
- API から resolver/domain mutation を呼ばず、既存 scheduled worker へ委譲した。
- sibling PR #422 の administrative principal transfer resolver と重複していない。

## 未対応・制約・残存リスク

- actual AWS の S3 conditional write visibility、EventBridge 1分 schedule、Lambda duplicate delivery timing、実 operator 認証での手動操作は未検証である。
- 根本原因が未修復の intent は redrive 後に再び最大3回で quarantine される。原因自動修復や bulk redrive/purge は対象外である。
- sibling PR #422 が本 stack へ未統合の間、administrative principal transfer intent は redrive しても resolver selection failure へ戻り得る。
- API Lambda の docs bucket read/write は既存の比較的広い権限であり、本 unit は新 IAM を追加していない。route/service/store の exact tenant/intent 制約で利用範囲を限定する。
- `npm ci` は既存 dependency audit として 8 vulnerabilities（low 2、moderate 1、high 5）を報告した。本 unit では dependency 変更や `npm audit fix` を行っていない。
- merge、deploy、release、actual AWS/manual operation は実施しない。

## PR lifecycle

Draft stacked PR、semver label、日本語 AC/self-review、final-head CI、Issue #358 進捗、task done、upstream 一致は後続 lifecycle で追記する。
