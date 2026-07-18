# Issue #358 FR-049 enabled tool pre-node permission gate

- 状態: done
- 対象: Issue #358 / FR-049
- ブランチ: `codex/issue-358-fr049-pre-node-permission-gate`
- 起点: PR #441 final head `c3f94999c9c9b12b9767f1727c793343d95fcd92`

## 背景

PR #441 で enabled graph-backed RAG tool の feature permission 語彙を正規 `ApplicationPermission` の `chat:create` に統一した。一方、chat orchestration の実行直前 boundary は resource operation 種別だけを再認可し、tool registry の `requiredFeaturePermission` / `requiredResourcePermission` を実行時に消費していない。sync / async 双方に現在 identity と search scope を再検証する seam があるため、metadata と実行境界を小さく接続する。

## 対象範囲

- enabled tool definition と graph node label の fail-closed lookup
- mapped enabled definition 全件の permission contract 検証
- 同一 feature/resource contract の pre-node 認可重複排除
- sync / async chat の current feature permission / current search scope 再認可
- unit / service regression tests、FR-049 evidence、作業レポート

対象外:

- denial trace / invocation status、専用 invocation store
- approval workflow / UI、disabled future tool の permission vocabulary
- route / public API / schema / role catalog の変更
- AWS、scanner、migration、retention、owner policy
- merge、deploy、release

## 受け入れ条件

- [x] AC1: 実行される graph node に mapping された enabled tool definition を、node body より前に全件検証する。
- [x] AC2: definition が missing、disabled、node mapping 不整合、または現在 runtime が扱えない resource permission contract の場合は fail closed とし、node body を実行しない。
- [x] AC3: 同じ node に複数 tool が mapping される場合も各 definition を検証し、同一 `requiredFeaturePermission` / `requiredResourcePermission` の current authorization は 1 回へ重複排除する。
- [x] AC4: sync / async chat は definition の `requiredFeaturePermission` と現在の search scope read authorization を再検証し、feature または resource revoke 後は node body / output を生成しない。
- [x] AC5: async の既存 `permission_revoked` minimized failure と sync の例外伝播を維持する。
- [x] AC6: disabled tool、unmapped node、trace/status/store/UI/approval/API/schema/role catalog/AWS/migration を変更しない。
- [x] AC7: FR-049 に本 unit の成立と denial trace / future executor の残差を区別して記録する。
- [x] AC8: security review で route、owner、resource scope、sensitive response、role grant を弱めていないことを確認する。
- [x] AC9: targeted tests、API lint/typecheck/full test/build、docs checks、repository CI、diff/pre-commit を成功させる。
- [x] AC10: 日本語 commit / Draft PR / AC comment / self-review / Issue #358 progress / two-head CI / task-report lifecycle を完遂する。
- [x] AC11: local HEAD / upstream / remote 一致と clean worktree を確認し、未実施・残リスクを正直に記録する。

## 完了証跡

- 実装 commit: `1406a3fe`
- Draft PR: #443
- 実装 head CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29637032367（green）
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/443#issuecomment-5010541099
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/443#issuecomment-5010541100
- Issue #358 progress: https://github.com/tsuji-tomonori/rag-assist/issues/358#issuecomment-5010563425
- local validation: targeted 2/2、API coverage 919/919 / Statements/Lines 90.69%、`task docs:check`、`task verify`、source audit、`npm run ci`、pre-commit、diff check はすべて成功。
- final lifecycle head CI と local/upstream/remote clean readback は、本 done 更新 commit の push 後に PR top-level comment と最終回答へ記録する。

## Done 条件

- AC1〜AC11 の deliverables と validation evidence が揃い、registry metadata が node 実行前の current authorization に実際に使われる。
- mapped definition を一部だけ無視せず、同一 contract の認可呼び出しだけを安全に重複排除する。
- FR-049 全体や denial trace / approval / future tool executor を完了と誤表現しない。
- PR 作成後の受け入れ条件確認、セルフレビュー、final-head CI、Issue 更新まで完了する。

## セキュリティレビュー観点

- route-level `chat:create` と service/worker current identity 再検証を迂回しない。
- `requiredFeaturePermission` は authoritative current role grant と照合する。
- `readOnly` は request snapshot だけでなく現在の search scope readable 判定へ接続する。
- unsupported permission contract は黙って許可せず拒否する。
- deny 後に node body、外部副作用、機微 output、永続化を進めない。

## 検証計画

- direct: tool registry mapping / contract dedupe、orchestrator before-body ordering、sync / async permission revoke。
- API: lint、typecheck、full test、build。
- docs: FR-049 / generated docs freshness / docs check。
- repository: `task verify` または同等の root CI、source audit、pre-commit、`git diff --check`。
- remote: implementation head / final task-report head の GitHub Actions。
