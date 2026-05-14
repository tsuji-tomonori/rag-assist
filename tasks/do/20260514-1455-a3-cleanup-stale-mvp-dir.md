# A3 stale MVP directory cleanup decision
状態: doing
タスク種別: 修正
発注元 wave: Wave 1
依存タスク: `tasks/done/20260514-1432-a2-chapter-to-req-map.md`

## 背景

plan では `memorag-bedrock-mvp/` 残骸 directory の処理方針を、削除または `.gitignore` として decision 付きで実施することが A3 として定義されている。

PR #284 で MemoRAG MVP は repository root へ移動済みであり、旧 `memorag-bedrock-mvp/` path は現行ソースの正規配置ではない。

## 目的

旧 `memorag-bedrock-mvp/` 配下の untracked 生成物が `git status` や作業判断を汚染しないよう、root 化後の正規配置を明示し、再発を防ぐ。

## スコープ

- 含む:
  - 旧 `memorag-bedrock-mvp/` path の存在状態と tracked 状態の確認。
  - `削除` と `.gitignore` の判断根拠を軽量なぜなぜ分析として記録。
  - `.gitignore` に root 化前 path の ignore を追加。
  - ADR に root 化後の stale path 取扱い decision を追加。
  - 作業完了レポート作成、PR 作成、受け入れ条件コメント、セルフレビューコメント。
- 含まない:
  - 元 worktree の untracked directory の物理削除。
  - root 化済みアプリ、API、infra、benchmark の実装変更。
  - 過去 reports 内の旧 path 参照の一括書き換え。

## なぜなぜ分析 summary

### 問題文

2026-05-14 時点で元 worktree の `git status --short --untracked-files=all` に `memorag-bedrock-mvp/infra/lambda-dist/...` が untracked として出現し、root 化後の正規配置と旧配置が混在して見える。

### 確認済み事実

- `origin/main` から作成した clean worktree には `memorag-bedrock-mvp/` directory は存在しない。
- `git ls-files memorag-bedrock-mvp` は空であり、旧 directory は tracked source ではない。
- 元 worktree の旧 directory には `node_modules/`、`coverage/`、`dist/`、`infra/cdk.out/`、`infra/lambda-dist/`、`.local-data/` など生成物・依存物・ローカルデータが存在する。
- 現行 `.gitignore` は root の `node_modules/`、`dist/`、`coverage/`、`cdk.out/`、`infra/lambda-dist/` を ignore するが、root 化前の `memorag-bedrock-mvp/` 全体は ignore していない。

### 推定原因

- root 化前に作られた生成物が未追跡のまま残り、root 化後の `.gitignore` が旧 top-level directory の再出現を明示的に遮断していない。

### 根本原因

- repository root 化の構造決定後、旧 `memorag-bedrock-mvp/` path を「正規 source ではない stale local artifact」として扱う ignore / decision が repository に残っていなかった。

### 対応方針

- tracked source がないため、PR では物理削除ではなく `.gitignore` で旧 path 全体を ignore する。
- ADR に、root 化後の正規配置と旧 path の扱いを decision として残す。
- ローカル削除は不可逆な作業環境 cleanup なので、この PR の自動実行対象から外す。

## 実装計画

1. `.gitignore` に `memorag-bedrock-mvp/` を追加し、旧 root path を再表示させない。
2. `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_003.md` を追加し、root 化後の stale path 取扱いを記録する。
3. `git status --short --untracked-files=all`、`git ls-files memorag-bedrock-mvp`、`git diff --check` で確認する。
4. 作業完了レポートを `reports/working/` に作成する。
5. PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを入れる。
6. task md を `tasks/done/` へ移動し、同じ PR branch に commit / push する。

## ドキュメント更新計画

- `.gitignore`: 旧 root path ignore を追加。
- `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_003.md`: decision を追加。
- `reports/working/20260514-1455-a3-cleanup-stale-mvp-dir.md`: 作業完了レポートを追加。

## 受け入れ条件

- [ ] `git ls-files memorag-bedrock-mvp` が空で、旧 path が tracked source ではないことを確認している。
- [ ] `.gitignore` に root 化前の `memorag-bedrock-mvp/` を ignore する規則が追加されている。
- [ ] ADR で `削除` ではなく `.gitignore` を選んだ decision と理由が記録されている。
- [ ] 元 worktree の untracked 実体を勝手に削除していない。
- [ ] `git diff --check` が pass している。

## 検証計画

- `git ls-files memorag-bedrock-mvp`
- `git status --short --untracked-files=all`
- `git diff --check`

## PR レビュー観点

- 旧 path を source として復活させる余地を作っていないか。
- 生成物・依存物・ローカルデータの ignore として妥当か。
- 物理削除を実行済みのように誤記していないか。
- root 化後の正規配置と矛盾しないか。

## リスク・open questions

- 元 worktree のローカル容量削減には別途削除操作が必要だが、不可逆操作のためこの PR では実施しない。
- 過去 reports には root 化前 path の履歴参照が多く残るが、履歴記録として扱い一括更新しない。
