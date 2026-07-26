# Issue #358 要件 evidence・coverage 同期 作業レポート

## 受けた指示

- Issue #358 のうち `FR-018`, `FR-020`, `FR-024`, `FR-053`, `FR-054`, `FR-055`, `FR-088`, `NFR-012` の要件文書と coverage trace を現行 source/test/CI evidence に同期する。
- PR #365 → PR #369 → 本 PR の stack を維持し、draft PR、受け入れ条件コメント、セルフレビュー、task lifecycle、final-head CI まで進める。
- production 実装、benchmark 固有分岐、PR #338 / #339 の変更 path、merge / deploy / release は対象外とする。

## 要件整理

- 要件状態、checkbox、実装適合、coverage path を evidence 単位で照合し、`confirmed`, `inferred`, `conflict`, `open_question` を区別する。
- FR-020 の path-only coverage は public ingest の直接 behavior test へ置き換える。
- repository source だけで確認できない deploy setting、全量 API drift、横断 worker contract は実施済み扱いにせず、検証可能な後続 todo に残す。
- 新しい API source test が generated API docs の trace に含まれる場合は公式 generator 出力を同期する。

## 検討・判断

- FR-018 は現行 `rrfFuse` と利用箇所を source of truth とし、存在しない `rank-fusion.ts` と max-score merge の記述を stale と判定した。
- FR-024 は Issue #358 で決定済みの Phase 2 管理パネルを正規契約とし、permission UI と API authorization の両方を受け入れ条件に残した。
- FR-053/054/055 は部分 evidence を confirmed とした一方、全量 equivalence、deploy smoke/external setting、共通 worker contract は unchecked のまま維持した。
- NFR-012 は `sanitizeAuthorizedResourceMetadata` の reader allowlist を公開 metadata policy の source of truth とし、`tenantId` を公開 response から除外する判断を明記した。
- FR-088 は sanitizer unit test と service integration test の直接 evidence に基づき confidence を reconciled した。
- PR #366 の coverage patch は `FR-045` / `SQ-003` だけで、本タスク対象 key と重複しないことを GitHub Apps で確認した。

## 実施作業

- 対象8要件の canonical requirement docs を更新した。
- `requirements-coverage.test.ts` の stale/indirect reference を実在する source/test/todo に更新した。
- `multi-abstraction-memory.test.ts` を追加し、public ingest から document/section/concept memory、raw chunk trace、section path、業務 metadata、memory/evidence 分離、両 vector record の security envelope を検証した。
- FR-054 の deploy smoke/external setting todo を追加し、既存 API lifecycle todo に worker contract の受け入れ条件を追記した。
- 公式 API docs generator を実行し、該当 ingest API の generated detail/unit-test trace と manifest を同期した。
- commit `985b5705` を push し、PR #369 head branch を base とする draft PR #375 を GitHub Apps で作成した。`semver:patch` label も GitHub Apps で付与した。

## 検証結果

- FR-020 dedicated test: 最終差分で3回連続成功。
- requirements coverage test: 成功。
- targeted API tests: 9 files 成功。
- AdminWorkspace test: 22/22 成功。最初の invocation は path 誤りで test file を発見できず、直後に正しい workspace-relative path で再実行して成功した。
- API typecheck: 成功。
- `task docs:check`: 成功。docs validation、OpenAPI quality、97 APIs / 582 generated API documents freshness、Web trace/inventory、infra inventory、hidden Unicode を確認した。
- `git diff --check`: 成功。
- pre-commit hooks: 成功。
- full API test: 807/807 成功。ただし FR-020 security assertion の最終補正前であり、補正対象は test assertion のみ、production code は不変である。
- full API coverage の一試行では Statements/Lines 90.45%、Functions 92.93% の threshold を達成したが、当該試行の FR-020 assertion が失敗したため全体成功として扱わない。
- 最終補正後の coverage/root CI 再実行は、`questions-access.test.ts` が子 `tsx` process を起動する際に sandbox 内の IPC socket `/tmp/tsx-1000/2.pipe` で `EPERM` となるため、成功として扱わない。sandbox 外実行は行わず、GitHub Actions の final-head full CI を最終判定に用いる。
- `scripts/validate_spec_recovery.py` は base に存在せず、spec-recovery artifact を変更していないため適用しなかった。
- GitHub Actions: 初回 head `985b5705` の run `29502596156` は8分9秒で成功した。API/Web coverage、lint、typecheck、docs gate、infra/benchmark test、全 build、CDK synth を含む。task/report 完了 commit 後の final head も再確認する。

## 成果物

- 対象8要件の更新済み requirement docs。
- FR-020 public ingest 直接回帰 test と更新済み requirements coverage trace。
- FR-054 と worker contract の acceptance-driven todo。
- 更新済み source-backed generated API docs。
- draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/375
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/375#issuecomment-4992583700
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/375#issuecomment-4992586524
- task: `tasks/done/20260716-2141-issue-358-requirements-evidence-sync.md`

## 指示への fit 評価

- production 実装を変更せず、要件と evidence の不整合を source/test/CI に基づいて是正した。
- 未実装・未検証項目を checked/confirmed として過大評価せず、後続 todo と残余リスクへ分離した。
- RAG の根拠性・認可境界を弱めず、FR-020 test で tenant/document/version/authorization/source locator を直接確認した。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐、mock product UI は追加していない。
- PR #338 / #339 の変更 path、merge、deploy、release は変更・実行していない。

## 未対応・制約・リスク

- PR #365 と PR #369 の先行 merge が必要であり、本 PR 単独では merge しない。
- FR-053 の全 REST/oRPC/shared equivalence、FR-054 の deploy smoke/external setting evidence、FR-055 の横断 worker contract は後続 todo のままである。
- local sandbox では子 `tsx` IPC socket の `EPERM` により final full coverage/root CI を完遂できない。GitHub Actions final-head CI が未成功の場合は task を done としない。
- dependency は offline install し、dependency version と `package-lock.json` は変更していない。
