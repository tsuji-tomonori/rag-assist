# Open PR のレビュー・マージ可否監査

- 状態: do
- タスク種別: 調査
- 作成日: 2026-07-14
- ブランチ: `codex/pr-merge-audit-final-20260714`

## 背景

repository に複数の open PR が残っており、変更範囲、CI、レビュー指摘、競合、依存関係、古さが異なる。単に GitHub の `mergeable` だけで判断すると、draft・partial・obsolete・後続 PR と衝突する変更を main へ取り込むおそれがある。

## 目的

2026-07-14 時点の全 open PR を証拠ベースで確認し、merge 可能、保留、修正必要、重複または obsolete に分類する。ユーザーが承認した `#341` 以降の PR は依存順を定め、必要な修正と再検証を行い、exact head SHA を指定して一件ずつ取り込む。

## スコープ

- `tsuji-tomonori/rag-assist` の全 open PR
- PR 本文、head/base、draft、mergeability、changed files、差分、commit、labels
- GitHub Actions、review submission、unresolved review thread、top-level comment
- PR 間の変更重複、依存順、main へ既に入った実装との重複・obsolete 判定
- 承認された PR の merge と、各 merge 後の main / 残 PR 状態確認

## スコープ外

- 保留 PR の実装修正、rebase、conflict 解消
- PR close、branch delete、force-push
- deploy、release、production 変更
- ユーザー最終確認前の merge

## 調査計画

1. GitHub Apps で open PR を列挙し、head/base/draft/mergeability/labels を固定する。
2. 各 PR の changed files、patch、commit、関連 report、レビュー・コメント、CI を確認する。
3. current main と PR 間の重複・依存・順序を確認する。
4. security、RAG 根拠性、API compatibility、data migration、docs sync、test sufficiency を変更範囲に応じてレビューする。
5. merge 候補と保留理由を日本語で整理し、merge 対象・方式の最終確認を求める。
6. 承認後、各 PR の head SHA、CI、review、mergeability を再確認し、一件ずつ merge する。
7. 各 merge 後に main と残 PR を再評価し、結果を report に記録する。

## ドキュメント保守計画

- PR ごとの判定と merge 結果を `reports/working/` に残す。
- production behavior は本タスクで変更しないため、REQ/ARC/DES/OPS の更新は行わない。
- merge によって取り込まれる docs の整合性は各 PR の差分と CI で判定する。

## 受け入れ条件

- [x] 調査時点の全 open PR が漏れなく一覧化されている。
- [x] 各 PR の draft、mergeability、CI、レビュー・未解決 thread、変更範囲が確認されている。
- [x] 各 PR の current main との差分と、他 open PR との重複・依存順が確認されている。
- [x] 各 PR が merge 可能、保留、修正必要、重複/obsolete のいずれかに根拠付きで分類されている。
- [x] merge 候補について security、RAG 根拠性、API/data compatibility、docs、test の該当観点が確認されている。
- [x] PR merge の対象、head SHA、方式を提示し、`#341` 以降を必要に応じて修正・merge するユーザー承認を得ている。
- [x] 承認された PR は直前に CI・review・mergeability を再確認してから一件ずつ merge されている。
- [x] 各 merge 後に main と残 PR の状態が再確認されている。
- [x] 未マージ PR は理由と次の action が記録されている。
- [ ] 作業レポート、検証結果、GitHub Apps 操作、未実施事項が最終状態で記録されている。

## 検証計画

- GitHub Apps: PR metadata / changed files / reviews / threads / comments / workflow runs
- `git diff --stat`, `git diff --name-status`, `git log --left-right --cherry-pick`
- 必要に応じた merge-tree または一時 branch 上の競合確認
- 各 PR head の GitHub Actions 最終結果
- `git diff --check` と report/task の pre-commit

## PR レビュー観点

- draft/partial/未達条件を merge-ready と誤判定しないこと
- green CI だけで security、migration、互換性、依存順を省略しないこと
- docs と実装の同期、RAG の根拠性・認可境界を弱めないこと
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を取り込まないこと
- stale PR が current main の新しい仕様や実装を後退させないこと
- merge 済み内容の重複 PR を取り込まないこと

## リスク

- PR 間の依存関係は GitHub の mergeable flag だけでは分からない。
- 一つの merge で残 PR の mergeability や意味が変わるため、連続 merge 前に毎回再評価が必要である。
- 古い PR は CI が green でも current main の要件や docs 構造と衝突する可能性がある。
- branch protection や required review により、内容が問題なくても merge API が拒否する場合がある。

## 2026-07-14 監査スナップショット

- open PR は 8 件（`#344`, `#343`, `#342`, `#341`, `#339`, `#338`, `#286`, `#76`）。
- merge 候補は `#342` のみ。head は `50cfd6c9ccad5e1ab574e3cba9d16438ae814218`、GitHub 表示は `MERGEABLE / CLEAN`、最新 2 workflow は success、formal review と unresolved thread は 0 件。
- `#344` は単独では green だが、`#342` が削除・禁止する `docs/spec-recovery/` へ新規成果物を追加するため順序依存。`#342` 後に canonical docs へ移植・rebase が必要。
- `#343` と `#341` は Draft。`#343` の `docs/generated/api-code/` は `#342` の validator 許可集合外、`#341` は live operational acceptance と API C1 目標が未達。
- `#339` は current main より 3 commit 古く、UsageEvent の tenant context/filter がなく、DynamoDB Scan の 1,000 件上限で月次集計が欠落し得るため修正必要。
- `#338` は PR 本文で partial と明記され、task も `tasks/do/` のまま。履歴復元・補助表示・境界 test が未達。
- `#286` と `#76` は `CONFLICTING / DIRTY`。`#286` の調査内容は後続仕様回収で置換され、`#76` の alias API は current main に既に実装済みで旧 repository path を前提とするため obsolete。
- ユーザーは `#342` の merge と、`#341` 以降の PR を依存順に必要な修正後 merge することを承認した。
- 実行順は docs baseline の `#342`、production 要件実装の `#341`、その source に依存する API docs の `#343`、全三件を監査基準に使う `#344` とした。途中で新規 open になった `#346` は番号条件を満たすため、`#344` 後の current main へ再統合して続ける。

## 2026-07-14 承認後の実行状況

- [x] `#342`: head `50cfd6c9ccad5e1ab574e3cba9d16438ae814218` を merge commit `964c3a989f44a78a1cf36d3f8566da9bfab6b5ed` として merge。
- [x] `#341`: latest main と canonical docs へ再統合し、未取得の live operational evidence と API C1 目標を todo へ分離。final head `fa7dfb1df3d0bdf5c1f3500d9cc9de21440cb8c0`、MemoRAG CI run 982、Semver run 1435 成功後、merge commit `2b3fdb8514ef7fd4fa367fcc860327ed814b2571` として merge。
- [x] `#343`: latest main 対応、call graph 最短 depth 修正、canonical docs validator 対応を実施。final head `3e54dead041457ebe04f017ec043803f627a8b01`、MemoRAG CI run 984、Semver run 1438 成功後、merge commit `c6eff7deef0d8f3d06d66391be181e45b058aaaf` として merge。
- [x] `#344`: legacy docs root を復活させず、監査 bundle を非規範の report へ移し、36 gap を `resolved` 4 / `partially_resolved` 10 / `open` 22 に再判定。final head `68d44ad73a828cfc30b60aafe21ac5b9024462d7`、MemoRAG CI run 986、Semver run 1440 成功後、merge commit `e540dde76b0a3e6779462182bcbd8acd75647b2d` として merge。
- [x] `#346`: 初回登録導線を current main へ再統合し、authoritative permission 優先、read-only 空状態、No Mock Product UI の回帰を修正。final head `f08c18a7c5fece4918fd217d2b6c533a272d795c`、MemoRAG CI run 989、Semver run 1444 成功後、merge commit `748f5bd97eea4a02c3f798e16fecb7b8854fb550` として merge。
- `#339`、`#338`、`#286`、`#76` は最新ユーザー指定の merge 対象 `#341` 以降に含まれず、初回監査で記録した修正必要・保留・obsolete 判定のまま変更していない。
- `#346` merge 直後の再走査では、既存 open PR `#341` 以降は 0 件だった。監査 task/report を載せる本作業 PR は、同じ品質ゲートを通してから merge し、最終再走査を行う。
