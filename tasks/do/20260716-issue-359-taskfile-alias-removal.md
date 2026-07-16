# Issue #359: `memorag:*` Taskfile alias の廃止

- 状態: do
- 対象 Issue: #359 Phase 1e
- 作業ブランチ: `codex/issue-359-taskfile-alias-removal`
- 起点: `origin/main` (`8a427a24`)

## 指示と目的

後方互換用に残っている `memorag:*` alias 10件を削除し、active な実行参照を正規 task 名へ移す。historical report / 完了 task の過去のコマンド表記は変更しない。

## 変更範囲

- `Taskfile.yml` の `memorag:*` alias 10件
- active な `README.md` と `skills/taskfile-command-runner/SKILL.md` の参照
- 再導入を防ぐ active-tree guard
- 本 task と作業レポート

## 受け入れ条件

- [ ] `Taskfile.yml` に `memorag:*` alias が0件である。
- [ ] active workflow / docs / skills / scripts に `task memorag:*` または `memorag:*` task key が残らない。
- [ ] historical `reports/working/` と `tasks/done/` を一括書換えしていない。
- [ ] alias の再導入を検出する guard を `verify` 経路へ追加する。
- [ ] `task --list` が成功し、正規 task 名が列挙される。
- [ ] `task dev:api --summary`、`task dev:web --summary`、`task smoke:api --summary` が非破壊で成功する。
- [ ] `task verify` が成功する。
- [ ] `npm run ci` 相当の GitHub Actions final-head CI が成功する。
- [ ] 日本語の PR 本文、受け入れ条件コメント、セルフレビュー、最終 head CI 証跡を残す。
- [ ] merge / deploy / release を実施しない。

## 検証計画

1. task/script の展開内容を確認してから非破壊コマンドを実行する。
2. `rg` で active tree と Taskfile key の0件を検査する。
3. `task --list` と `--summary` で Taskfile の構文と正規 entry を検査する。
4. `task verify` を通常 sandbox で実行する。権限問題時は自動 escalation しない。
5. PR 作成後に GitHub Actions の final head を確認する。

## ドキュメント影響

Taskfile の利用例と repository-local skill の例は挙動変更に直結するため同時更新する。API・UI・認可・RAG・generated docs の契約は変更しない。

## 実施結果（PR作成前）

- `memorag:*` alias 10件を削除し、README / skill の active reference を `task verify` へ変更した。
- `scripts/check-taskfile-legacy-aliases.mjs` を追加し、`npm run ci` と `task verify` の先頭へ接続した。
- intentional README probe は legacy reference を検出して exit 1。probe除去後は guard が成功した。
- `task --list`: 成功。legacy aliasは列挙されない。
- `task dev:api --summary` / `task dev:web --summary` / `task smoke:api --summary`: 成功。実サーバーやsmoke requestは起動していない。
- 初回 `task verify`: shared parentのdependency解決により別worktreeのcontractを参照し、typecheck失敗。成功扱いにしていない。
- worktree内で `npm ci`: 成功（504 packages）。lockfileは変更なし。npmは既存8 vulnerabilitiesを報告した。
- isolated dependency install後の `task verify`: 成功（guard / lint / 全workspace typecheck / build）。
- `task docs:check`: 成功（canonical docs、97 APIs / 582 API documents、Web trace/inventory、infra inventory、hidden Unicode）。
- GitHub Actions final-head CI、PRコメント、task done化はPR作成後に実施する。
