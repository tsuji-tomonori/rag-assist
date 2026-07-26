# FR-049 enabled tool pre-node permission gate 作業完了レポート

## 受けた指示

- Issue #358 / FR-049 の bounded unit として、PR #441 final head `c3f94999c9c9b12b9767f1727c793343d95fcd92` を起点に enabled graph-backed tool の permission metadata を node 実行直前の current authorization へ接続する。
- mapped enabled definition を全件検証し、等価な contract の認可呼び出しだけを重複排除する。
- sync / async の既存 failure semantics を維持し、trace/UI/approval/AWS/migration/future tool executor は対象外とする。
- worktree/task/日本語 commit/Draft PR/受け入れ条件コメント/self-review/Issue progress/two-head CI/clean readback まで行う。

## 要件整理と判断

- 現在 enabled な graph-backed RAG tool の contract はすべて `chat:create` + `readOnly` であり、sync / async service が既に持つ `authorizeProtectedRead` は authoritative current identity の `chat:create` と現在 search scope の readable 判定を再実行する。
- そのため新しい route/API/schema/store seam は増やさず、registry の mapped definition を node boundary で解決・検証し、同一 node 内の等価 contract を 1 回へまとめて既存 current-authorization callback を呼ぶ構成とした。
- missing / disabled / placeholder / non-RAG / approval-required / unknown feature / unsupported resource contract は許可へ倒さず `PermissionRevokedError` として fail closed にする。registry 内部詳細は利用者へ開示しない。
- 将来異なる feature/resource permission を持つ tool は、この unit では未対応 contract として拒否する。future executor、approval、denial trace 永続化は未完了のまま明示する。

## 実施作業と成果物

- `apps/api/src/chat-orchestration/tool-registry.ts`
  - graph node label から mapped tool contract を解決する lookup を追加。
  - mapping/definition の整合性と、全 mapped definition の enabled/implemented/RAG/non-approval/`chat:create`/`readOnly` contract を検証。
  - 同一 feature/resource contract を tool ID 一覧つきで重複排除。
- `apps/api/src/rag/orchestration/chat-rag-orchestrator.ts`
  - node body より前の boundary に registry lookup と current authorization を追加。
  - auth enabled 時に callback が欠落する場合、および registry contract が不正な場合を fail closed 化。
  - 既存 resource-operation boundary と sync exception / async minimized `permission_revoked` semantics は維持。
- tests
  - rerank node の 2 definition が全件検証されたうえで 1 contract へ集約されること、全 mapping の coverage、disabled/missing reject を追加。
  - mapped node body より前に拒否され、認可が 1 回だけ呼ばれることを追加。
  - pre-node check 増加後も既存 FR-074 late revoke が post-answer replay 時点で成立するよう回帰テストの revoke timing を同期。
- docs
  - `REQ_FUNCTIONAL_049.md` に enabled graph-backed tool gate の成立と、future executor / approval / denial trace の残差を分離して記録。
  - source 変更に合わせて API-code 文書 588 件のうち影響投影分を generator で更新。
  - README、public API、運用手順、UI、role catalog は挙動・契約を変更しないため更新不要と判断。

## セキュリティレビュー

- route / middleware / `apps/api/src/app.ts` / `apps/api/src/routes/` / `access-control-policy.test.ts` / public schema / store / Infra / Web に差分なし。
- route-level `chat:create` を迂回せず、既存 service/worker callback を通じて現在 identity、tenant、account/role grant、現在 search scope readable を再検証する。
- node body、外部 side effect、回答出力より先に拒否し、不正 contract の tool ID や内部理由を応答へ露出しない。
- owner/tenant/resource scope、機微 response、role grant を拡張していない。
- auth disabled の明示的 local/test mode は既存 callback optional semantics を維持し、auth enabled で boundary 欠落時だけ fail closed とする。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を実装へ追加していない。

## 検証結果

- PASS: FR-049 + FR-074 targeted test、2 files / 2 pass。
- PASS: API coverage、919 tests / 919 pass。Statements 90.69%、Branches 80.31%、Functions 93.47%、Lines 90.69%。
- PASS: `task docs:check`。docs validation、OpenAPI、98 APIs / 588 API docs freshness、web trace/inventory、infra inventory、hidden unicode。
- PASS: `task verify`。全 workspace lint/typecheck/build。
- PASS: `npm run rag:release:source-audit`。dataset-specific branch 0、artifact manifest mismatch 0。
- PASS: `npm run ci`。contract 4、API 919、Web 444、Infra/Benchmark 102 tests と全 build。
- PASS: `git diff --check`、対象外 security/public surface の no-diff 確認。
- PASS: 実装 head `1406a3fe` の remote CI。https://github.com/tsuji-tomonori/rag-assist/actions/runs/29637032367
- NOTE: 初回 graph file 単独実行で既存 FR-074 の固定された 3 回目 revoke が新 gate の追加で早過ぎることを検出し、post-answer replay 相当の 16 回目へ同期して再検証した。
- NOTE: 初回 coverage は先行 full suite と誤って重複実行し共有 test state が競合したため失敗。両 process 終了後の単独再実行で上記 919/919 と閾値成功を確認した。
- WARN: `npm ci` が報告した既存 dependency vulnerability 8 件、既存 web chunk / Lambda bundle size warning は本変更外。

## 指示への fit 評価

- enabled graph-backed tool の metadata を実行直前の current authorization に接続する bounded unit は満たす。
- mapped definition の一部を無視せず、等価 contract の認可だけを重複排除している。
- sync / async の service/worker authorization seam と failure semantics を再利用し、API/UI/store/AWS/migration へ範囲を広げていない。
- FR-049 全体、future tool executor、approval、denial trace を完了とは扱わない。

## 未対応・制約・リスク

- future / disabled tool executor の個別 feature/resource/approval/credential enforcement は未実装。
- tool permission denial の sanitize 済み `ChatToolInvocation` status / trace 永続化は未実装。
- GitHub Apps callable capability がこの session に公開されていないため、GitHub 操作は repository skill の fallback として `gh` を使用した。

## GitHub lifecycle 証跡

- 実装 commit: `1406a3fe`
- stacked Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/443
- base PR: https://github.com/tsuji-tomonori/rag-assist/pull/441 (`c3f94999`)
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/443#issuecomment-5010541099
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/443#issuecomment-5010541100
- Issue #358 progress: https://github.com/tsuji-tomonori/rag-assist/issues/358#issuecomment-5010563425
- 実装 head CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29637032367（green）
- final lifecycle head CI と local/upstream/remote clean readback は、本 report/task done 更新 commit の push 後に PR top-level comment と最終回答へ記録する。
