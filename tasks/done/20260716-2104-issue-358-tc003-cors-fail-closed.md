# Issue #358 TC-003 design record / CORS fail-closed

- 状態: done
- タスク種別: 修正
- 起点: `codex/issue-358-guard-profile-validation` final head `a1291e23`
- branch: `codex/issue-358-tc003-cors-fail-closed`
- stacked merge 順: PR #365 → PR #369 → PR #374

## 背景・目的

`TC-003` は本番ブラウザ導線を CloudFront の same-origin 単一入口へ移行する方針を要求しているが、現行 IaC は API Lambda、API Gateway preflight、4xx/5xx GatewayResponse に wildcard CORS を設定し、API runtime は production の wildcard を許容している。目標構成と移行順を正規 design/ADR に固定し、本 PR では CORS 設定源と validation を統一して production 相当を fail-closed に戻す。

CloudFront `/api/*` behavior、Hosted UI + PKCE、WebSocket ticket、SPA の direct origin 除去、signup は後続実装とし、本 PR では実装しない。

## RCA / なぜなぜ分析

### 問題文

2026-07-16 時点の production runtime / synthesized stack では `CORS_ALLOWED_ORIGINS="*"` と API Gateway の wildcard CORS response が生成され、`TC-003` の「本番 wildcard CORS を使わない」契約から外れている。

### 確認済み事実

- `infra/lib/memorag-mvp-stack.ts` は API Lambda の `CORS_ALLOWED_ORIGINS` を `"*"` に固定している。
- 同 stack は API Gateway preflight と default 4xx/5xx response に `Access-Control-Allow-Origin: *` を固定している。
- `apps/api/src/config.ts` は production で未設定だけを拒否し、wildcard と malformed origin を拒否しない。
- `apps/api/src/security/access-control-policy.test.ts` は production wildcard の一時許容を期待している。
- `TC-003` と `ARC_ADR_005` は CloudFront same-origin、production CORS 最小化、Hosted UI PKCE、WebSocket ticket を目標としているが、実装単位と安全な移行順は正規 design として未固定である。

### 推定・未確定

- 推定: 2026-05 の一時 wildcard 復旧が期限・撤去 gate を持たず、runtime、IaC、security test の恒久契約へ残った。
- 解決済み: FR-089 PR は #369、本 task PR は #374 と確定した。

### 根本原因

一時的な CORS 例外を撤去する正規移行 design と、runtime / IaC が共有する machine-checkable origin validation が存在せず、IaC の複数箇所と API runtime が別々の契約を保持していた。

### 対策と対象範囲

- 目標構成、段階移行、後続 PR 境界、rollback 条件を正規 ADR/design に固定する。
- origin parser / validator を共有 contract とし、API runtime と IaC の両方で使用する。
- IaC では1つの検証済み CORS origin を Lambda env、preflight、GatewayResponse の唯一設定源にする。
- production 相当では unset、blank、wildcard、malformed、複数 origin を synth または起動前に拒否する。
- non-production は明示設定した exact origin または明示 wildcard のみを扱い、暗黙 wildcard default を廃止する。
- config / IaC / security static policy の negative test で再導入を防止する。

## 決定事項

1. 本番目標は CloudFront same-origin であり、CORS は direct origin 接続を成立させる代替手段にしない。
2. 本 PR の deployed IaC は CDK context `corsAllowedOrigins` を唯一設定源とし、production は明示したCloudFront public HTTPS origin 1件に限定する。repo default localhostはdev synth専用とし、prodでは拒否する。
3. API runtime と IaC は同じ origin validation contract を利用する。
4. local/dev/test の wildcard は `CORS_ALLOWED_ORIGINS=*` を明示した場合だけ許容し、unset/blank は CORS header を返さない。
5. 公開 endpoint、認証・認可、RAG、tenant、resource ownership の境界は変更しない。

## スコープ

### 対象

- `TC-003` の目標構成と移行順の正規 ADR/design 記録
- API CORS config の production fail-closed validation
- CDK の CORS 設定一元化と synth-time validation
- config / IaC / security negative tests
- contract export、Taskfile local dev 設定、generated infra docs / snapshot 同期
- task / report / PR lifecycle

### 対象外

- CloudFront `/api/*`・`/ws/*` behavior の実装
- Cognito Hosted UI + PKCE の実装
- WebSocket ticket / `$connect` authorizer の実装
- SPA direct origin 設定の除去
- signup 方針・実装
- benchmark、release-audit、Web UI、PR #338 の変更領域
- merge、deploy、release

## 実装計画

1. 正規 ADR/design に target topology、段階移行、CORS single source、後続実装 boundary を記録する。
2. shared CORS origin validation contract と unit test を追加する。
3. API runtime config を shared contract へ移行し、明示設定だけを扱う。
4. CDK context の明示 origin を唯一設定源とし、Lambda / API Gateway CORS を同一値から生成する。CloudFront token は依存循環を避けるため自動注入しない。
5. config / IaC / security negative tests と既存期待値を更新する。
6. snapshot と generated infra inventory を再生成する。
7. targeted checks、root CI、docs checks を実行し、失敗を修正して再実行する。
8. report、commit、push、stacked PR、受け入れ条件コメント、セルフレビュー、task done、final-head CI まで完了する。

## ドキュメント保守計画

- `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_005.md`: accepted target と移行順を補強する。
- `docs/3_設計_DES/01_高レベル設計_HLD/`: TC-003 migration / CORS contract の正規 design record を追加する。
- `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`: `design TBD` を正規 design 参照へ更新する。
- `docs/3_設計_DES/41_API_API/DES_API_001.md`: 一時 wildcard 許容記述を fail-closed contract へ更新する。
- `docs/generated/`: CDK snapshot から infra inventory を再生成する。
- README / UI docs / API examples: 公開 API shape と UI behavior を変えないため更新不要とする予定。差分後に再確認する。

## 受け入れ条件

- [x] `TC-003` の CloudFront `/api/*`、Hosted UI PKCE、WebSocket ticket、SPA direct origin 除去、CORS single source の目標と移行順が正規 ADR/design に記録される。
- [x] production 相当の unset、blank、wildcard、HTTP、malformed、複数 origin、localhost/loopback が API 起動前または CDK synth 前に拒否される。
- [x] non-production は暗黙 wildcard を持たず、明示した exact origin または開発用 wildcard だけを扱う。
- [x] Lambda env、API Gateway preflight、default error response が同じ検証済み CORS origin から生成される。
- [x] config / contract / IaC / security negative tests が failure timing と拒否ケースを固定する。
- [x] 公開 endpoint、route permission、tenant/resource boundary、RAG safety を弱めない。
- [x] benchmark、release-audit、Web UI、PR #338 領域を変更しない。
- [x] snapshot / generated infra docs と canonical docs が実装に同期する。
- [x] targeted API / contract / infra checks、root CI、docs checks が成功する。
- [x] PR 本文に PR #365 → PR #369 → PR #374 の merge 順を blocker として明記する。
- [x] 日本語の受け入れ条件コメント、セルフレビュー、task done、作業レポート、implementation-head GitHub CI 確認を完了する。

## 検証計画

- shared contract unit test
- `npm test -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/infra`
- `npm run typecheck -w @memorag-mvp/infra`
- `npm run docs:infra-inventory:check`
- `npm run docs:hidden-unicode:check`
- `python3 scripts/validate_docs.py`
- `npm run ci`
- `git diff --check`

Taskfile command を使う場合は実体を確認してから実行し、sandbox escalation は自動再実行しない。

## PR レビュー観点

- production CORS が fail-closed で、CDK と runtime の validation drift がないこと。
- API Gateway error responseだけが wildcardを残すなど、部分的な CORS drift がないこと。
- public route / OPTIONS bypass の既存認証境界を広げていないこと。
- 本 PR が TC-003 target を実装済みと誤認させず、後続実装と merge 順を明示すること。
- generated docs と snapshot の churn が CORS 設定変更に限定されること。

## リスク

- `CORS_ALLOWED_ORIGINS` を暗黙 wildcard に依存するローカル起動は、Taskfile/.env の明示設定が必要になる。
- CloudFront `/api/*` behavior は本 PR の対象外なので、ready 状態でも TC-003 全体は未達のまま。
- stacked predecessor の merge 前に本 PR を mergeすると、FR-089 / #365 の変更履歴と差分が混在する。

## 完了結果

- PR: `https://github.com/tsuji-tomonori/rag-assist/pull/374`（draft）
- merge順 blocker: `#365 → #369 → #374`
- implementation commit: `5390dd75`
- 受け入れ条件コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/374#issuecomment-4992272766`
- セルフレビュー: `https://github.com/tsuji-tomonori/rag-assist/pull/374#issuecomment-4992273375`
- GitHub Actions implementation-head run `29501173928`: main CI success、semver label check success、promotion gate skip
- latest-head CI: 本done更新commitのpush後に監視し、結果をPR commentへ追記する。

## Done 条件

- すべての受け入れ条件が pass し、未解決の validation failure がない。
- PR が作成され、受け入れ条件確認とセルフレビューが日本語 top-level comment として残る。
- PR 作成後に task を `tasks/done/` へ移動し、完了更新を同 branchへ commit/push する。
- final-head GitHub CI の完了結果を確認する。
