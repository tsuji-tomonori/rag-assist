# Worktree Task PR Flow の常時適用化

保存先: `tasks/do/20260506-2018-enforce-worktree-task-pr-flow.md`

状態: do

## 背景

ユーザーから、`Worktree Task PR Flow` を明示指示がなくても毎回行うようにし、`AGENTS.md` および skills を修正する依頼があった。
現状の `AGENTS.md` と `skills/worktree-task-pr-flow/SKILL.md` は、worktree や PR 作成の依頼がある場合には workflow を要求しているが、通常のリポジトリ実作業すべてに常時適用されることまでは明確ではない。

## 目的

このリポジトリで実作業を行う agent が、明示指示の有無に関係なく `Worktree Task PR Flow` を標準フローとして適用する状態にする。

## 対象範囲

- `AGENTS.md`
- `skills/worktree-task-pr-flow/SKILL.md`
- `skills/worktree-task-pr-flow/agents/openai.yaml`
- 本 task file
- 作業完了レポート

## 方針

- 既存の `Worktree Task PR Flow` skill を新規作成せず、起動条件と必須 workflow を明確化する。
- `AGENTS.md` には repository-wide の常時適用ルールとして記載する。
- 他の workflow や commit / PR / report ルールと矛盾しないよう、既存項目を残して狭く追記する。

## 必要情報

- `AGENTS.md` の `Worktree Task PR Flow` セクション
- `skills/worktree-task-pr-flow/SKILL.md`
- `skills/skills_agents_updater/SKILL.md`
- `skills/task-file-writer/SKILL.md`
- `skills/implementation-test-selector/SKILL.md`
- `skills/post-task-fit-report/SKILL.md`
- `skills/japanese-git-commit-gitmoji/SKILL.md`
- `skills/japanese-pr-title-comment/SKILL.md`

## 実行計画

1. `AGENTS.md` と対象 skill の現状を確認する。
2. `Worktree Task PR Flow` が常時適用されるよう `AGENTS.md` を更新する。
3. `skills/worktree-task-pr-flow/SKILL.md` と `agents/openai.yaml` の起動条件を更新する。
4. skill metadata の検証と Markdown 差分チェックを実行する。
5. 作業完了レポートを作成する。
6. commit、push、GitHub Apps による `main` 向け PR 作成、受け入れ条件コメント、task file の done 移動を行う。

## ドキュメントメンテナンス計画

- repository-wide agent behavior の変更なので `AGENTS.md` を更新する。
- skill behavior の変更なので `skills/worktree-task-pr-flow/SKILL.md` と `skills/worktree-task-pr-flow/agents/openai.yaml` を更新する。
- `README.md`、`docs/`、`memorag-bedrock-mvp/docs/` は製品挙動や開発者向けセットアップではなく agent 運用ルールの変更のため、更新不要と判断する。
- PR 本文には、ドキュメント更新対象が `AGENTS.md` と skill であること、製品挙動への影響がないことを記載する。

## 受け入れ条件

- [ ] `AGENTS.md` が、実作業を伴う依頼では明示指示がなくても `skills/worktree-task-pr-flow/SKILL.md` を必読にする。
- [ ] `skills/worktree-task-pr-flow/SKILL.md` が、通常のリポジトリ実作業にも常時適用される起動条件を明記する。
- [ ] `skills/worktree-task-pr-flow/agents/openai.yaml` の説明が常時適用の意図と一致する。
- [ ] 変更した Markdown / YAML に対して `git diff --check` と skill validation が通る。
- [ ] GitHub Apps を使って `main` 向け PR を作成し、受け入れ条件確認コメントを記載する。
- [ ] PR コメント後に task file を `tasks/done/` へ移動し、同じ PR branch に commit / push する。

## 検証計画

- `python skills/skills_agents_updater/scripts/update_skills_agents.py --root . --validate`
- `git diff --check`
- `git diff --cached --name-only`

## PRレビュー観点

- `Worktree Task PR Flow` の常時適用範囲が曖昧でないこと。
- worktree / task file / commit / PR / PR comment / done 移動の順序が矛盾しないこと。
- 実施していない検証を PR 本文、作業レポート、最終回答で実施済み扱いしていないこと。
- 製品挙動や API 変更がないことが明確であること。

## 未決事項・リスク

- 決定事項: `Worktree Task PR Flow` は実作業を伴うリポジトリ作業に常時適用し、純粋な質問回答や計画のみの依頼は対象外として明記する。
- リスク: GitHub Apps の PR 作成・コメント操作が利用できない場合は blocked として報告する必要がある。
