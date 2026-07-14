# Open PR レビュー・マージ可否監査レポート

- 作成日時: 2026-07-14 00:45 JST
- 対象 repository: `tsuji-tomonori/rag-assist`
- 対象 branch: `codex/pr-merge-audit-final-20260714`
- 基点: `origin/main` `748f5bd97eea4a02c3f798e16fecb7b8854fb550`
- 状態: ユーザー承認範囲の `#342`、`#341`、`#343`、`#344`、`#346` を merge 済み。監査記録 PR `#347` の content CI／コメント完了、task done 更新中

## 受けた指示

open PR を順に確認し、問題がなくマージ可能なものを main へ取り込む。初回候補 `#342` の承認後、`#341` 以降の PR も依存順を決め、必要に応じて修正して merge する。

## 要件整理

- 全 open PR を漏れなく列挙する。
- GitHub の mergeable 表示だけでなく、Draft、未達の受け入れ条件、CI、review/thread、current main との差分、PR 間の依存順を確認する。
- runtime 変更では security、tenant/owner 境界、RAG 根拠性、API/data compatibility、No Mock Product UI、test/docs 同期を確認する。
- PR merge は対象、head SHA、方式を提示し、実行直前の確認後に一件ずつ行う。
- merge 後は main と残 PR を再評価する。

## 調査方法

- GitHub Apps を優先して PR metadata、changed files、workflow runs、formal reviews、review threads、top-level comments を取得した。
- `gh pr view` を補助的に使い、head/base、`mergeStateStatus`、check rollup、PR 本文を照合した。
- PR head を read-only 監査用 ref へ fetch し、`git rev-list --left-right --count`、`git diff --shortstat`、`git diff --name-only`、commit log、対象コードを current `origin/main` と比較した。
- PR 間の changed-file overlap と、同一ディレクトリに対する追加・削除・validator 制約を確認した。

## open PR 一覧と判定

| PR | GitHub 状態 | current main との差 | 判定 | 根拠・次 action |
| --- | --- | ---: | --- | --- |
| #344 | non-Draft, CLEAN, CI success | 0 behind / 2 ahead | 保留 | docs-only で単独品質は問題なし。ただし `docs/spec-recovery/` に 28 files を追加し、#342 が同 directory を削除・禁止する。#342 後に canonical REQ/ARC/DES/OPS または report/task へ移植して rebase する。 |
| #343 | Draft, CLEAN, CI success | 0 / 2 | 保留 | Draft。458 generated files を含む。#342 の validator は `docs/generated/api-code/` を許可せず、`docs/LOCAL_VERIFICATION.md` も削除対象のため、docs 構造確定後に再調整する。 |
| #342 | non-Draft, CLEAN, CI success | 0 / 2 | **merge 候補** | runtime 変更なし。正規 docs 構造、validator/test、CI、active trace を同期。formal review 0、unresolved thread 0、blocking comment なし。#344 より先に構造 baseline として取り込む。 |
| #341 | Draft, CLEAN, CI success | 1 / 8 | 保留 | 472 files の production-path 変更。PR 自身が live operational acceptance 未達、API C1 80.08%（目標 85%）未達、task `do` を明記している。 |
| #339 | non-Draft, CLEAN, CI success | 3 / 6 | **修正必要** | UsageEvent は `tenantId` を持つが tracking context が tenant を渡さず `default` を記録し、admin 集計は全 event を tenant filter なしで読む。DynamoDB は全 Scan 後 1,000 件で slice し、月次集計の silent truncation が起こり得る。固定 wildcard pricing の provenance/model 対応も再設計が必要。current main の再定義要件と #344 監査を反映して更新する。 |
| #338 | non-Draft, CLEAN, CI success | 3 / 3 | 保留 | PR 本文が partial と明記。履歴再開時の temporary attachment 復元、補助表示、通常文書一覧/readOnly 保存拒否 test が未達で task は `tasks/do/`。 |
| #286 | CONFLICTING, DIRTY, old CI success | 188 / 2 | obsolete | Phase A の旧 docs 調査。後続の #340/current docs でより包括的に回収され、#342 は対象 `docs/spec/` を廃止する。取り込まず、必要なら close 判断を別途行う。 |
| #76 | CONFLICTING, DIRTY, old CI success | 1025 / 4 | obsolete | 旧 `memorag-bedrock-mvp/` path 前提。alias 管理 API、review/publish/audit、Web/UI/test は current main に既に存在する。専用 audit bucket の未回収要件だけ必要なら新 task へ抽出する。 |

## merge 候補 #342 のレビュー

- 対象 head: `50cfd6c9ccad5e1ab574e3cba9d16438ae814218`。
- GitHub: `MERGEABLE / CLEAN`、`MemoRAG CI` success、`Validate Semver Label` success。
- review: formal review 0 件、unresolved review thread 0 件。日本語の受け入れ条件・セルフレビュー・最終 CI コメントあり。
- 差分: 164 files、1,394 insertions、21,206 deletions。削除の中心は重複した旧 docs、追加の中心は canonical index、requirements trace、todo、validator/test。
- production runtime: API/UI/auth/RAG execution path は変更しない。`apps/api/src/rag/requirements-coverage.test.ts` は削除済み docs path を canonical path/todo へ置換する test-only 変更。
- docs/implementation sync: README、AGENTS、Taskfile、CI、12 local skills、requirements coverage を同時更新している。
- security/RAG: runtime の認可・retrieval・grounding を変更せず、未実装要件を implemented とせず baseline/todo に残す。
- test: PR head の docs validator 6 tests、docs freshness、requirements coverage、skill validation、pre-commit、GitHub Actions が pass。Task wrapper 自体は proto/npm 10.9.2 不足で未実行だが、解決される 5 subcommands と CI は pass。
- 注意: merge 後、#344 は `docs/spec-recovery/` を復活させない形へ移植が必要。#343 の新 generator も validator 許可集合へ明示追加が必要。

## 判断

merge commit 履歴を維持している current main に合わせ、#342 を merge commit 方式で先に取り込むのが妥当である。#344 を先に取り込むと #342 の exact docs-root validator と衝突し、#342 と #344 を連続でそのまま取り込むことはできない。

## 承認後の merge 順序と実績

docs baseline、production source、source-backed docs、再検証監査、UI onboarding の依存関係から、`#342 → #341 → #343 → #344 → #346` とした。単に作成番号順にはせず、各 merge 後の main を次の PR へ統合し、final head の CI・review・thread・mergeability を再確認した。

| 順序 | PR | final head | final gate | 結果 |
| ---: | --- | --- | --- | --- |
| 1 | #342 | `50cfd6c9ccad5e1ab574e3cba9d16438ae814218` | MemoRAG CI / Semver 成功、review/thread 0、CLEAN | merge commit `964c3a989f44a78a1cf36d3f8566da9bfab6b5ed` |
| 2 | #341 | `fa7dfb1df3d0bdf5c1f3500d9cc9de21440cb8c0` | MemoRAG CI 982 / Semver 1435 成功、review/thread 0、mergeable | merge commit `2b3fdb8514ef7fd4fa367fcc860327ed814b2571` |
| 3 | #343 | `3e54dead041457ebe04f017ec043803f627a8b01` | MemoRAG CI 984 / Semver 1438 成功、review/thread 0、mergeable | merge commit `c6eff7deef0d8f3d06d66391be181e45b058aaaf` |
| 4 | #344 | `68d44ad73a828cfc30b60aafe21ac5b9024462d7` | MemoRAG CI 986 / Semver 1440 成功、review/thread 0、mergeable | merge commit `e540dde76b0a3e6779462182bcbd8acd75647b2d` |
| 5 | #346 | `f08c18a7c5fece4918fd217d2b6c533a272d795c` | MemoRAG CI 989 / Semver 1444 成功、review/thread 0、mergeable | merge commit `748f5bd97eea4a02c3f798e16fecb7b8854fb550` |

### 適宜修正した内容

- `#341`: #342 の canonical docs baseline を統合し、legacy docs root を復活させず、repository implementation と live operational acceptance を分離した。Web test teardown の pending fetch を修正し、再実行で解消した。
- `#343`: #341/#342 後の 95 APIs に再生成し、call graph が深い経路を先に走査すると主要分岐を落とす不具合を最短 depth 保持へ修正した。API code docs を canonical validator の許可構造へ追加した。
- `#344`: #341–#343 により改善済みとなった監査項目を補正し、削除済み `docs/spec-recovery/` を復活させず `reports/working/admin-ui-audit-202607/` へ非規範の履歴として移した。36 gap は resolved 4 / partially resolved 10 / open 22、残余を 3 todo へ分割した。
- `#346`: #341–#344 後の main と source／生成物の競合を解消し、文書 capability と read-only 共有 view を維持した。作成直後の一時保存先より authoritative `documentGroups` permission を優先し、read-only 空 response では作成 CTA と保存先を表示しない回帰 test を追加した。

## 実施作業・成果物

- 監査 task: `tasks/done/20260714-0037-open-pr-merge-audit.md`
- 本レポート: `reports/working/20260714-0045-open-pr-merge-audit.md`
- GitHub 上の状態変更: `#341`、`#343`、`#346` を Draft 解除し、各 PR 本文・semver label・日本語コメントを final evidence に合わせて更新した。`#344` も本文・label・コメントを更新した。`#346` の最終受け入れ条件コメントは `4964756880`、セルフレビューコメントは `4964756985`。
- merge: `#342`、`#341`、`#343`、`#344`、`#346` を exact expected head SHA の merge commit 方式で実施した。

## 監査記録 PR の検証

- PR `#347`: content head `b1aff1077a38c6b1bee598090f8ceb1bff732b2b`、MemoRAG CI run 990 成功、Semver run 1446 成功。
- Semver run 1445 は PR 作成直後のラベル未付与状態で失敗した。`semver:patch` 付与後の run 1446 は成功した。
- 受け入れ条件コメント `4964861926` とセルフレビューコメント `4964862025` を投稿し、blocking / should-fix なしと判定した。
- `task docs:check` の初回は task 内の禁止済み legacy path 引用を検出して失敗し、説明表現へ修正した。
- 2回目は clean worktree が親 worktree の古い contract package を参照して失敗した。専用 worktree で `npm install` して workspace link を同期後、canonical docs、OpenAPI、API code 95 APIs / 570 documents、Web／infra inventory、hidden Unicode の全 check が成功した。
- 対象2ファイルの pre-commit と `git diff --check` は成功した。`npm install` は tracked file を変更せず、audit は 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告した。互換性影響を伴う自動修正は実施していない。

## 指示への fit 評価

- 全 8 PR を列挙し、CI/mergeability だけでなく partial/Draft/obsolete/semantic dependency を確認した。
- green でも current requirement や concurrent PR と両立しない #339/#344 を merge-ready から除外した。
- 不可逆操作前の確認を残し、確認後に一件ずつ再検証する状態にした。

現時点の fit: partially complete。ユーザー承認範囲の修正・検証・merge、既存 open PR `#341` 以降が 0 件であることの再取得、PR `#347` の content CI／コメント、task done 更新まで完了した。残るのは metadata head の CI、exact head merge、最終再走査である。

## 未対応・制約・リスク

- `#346` merge 直後の再走査では、既存 open PR `#341` 以降は 0 件だった。
- 本監査記録 PR `#347` の metadata head CI と exact head merge を完了後、もう一度 open PR を再走査する。
- `#339`、`#338`、`#286`、`#76` は最新ユーザー指定の merge 範囲外であり、close、修正、merge は実施していない。
- branch delete、deploy、release は実施していない。
