# PR #130 受け入れ条件再確認

保存先: `tasks/done/20260506-2030-pr130-acceptance-check.md`

状態: done

## 背景

ユーザーから、今回の内容に紐づく tasks を作成し、その受け入れ条件を満たしているかチェックし、結果を PR コメントに記載する依頼があった。
対象 PR は `Worktree Task PR Flow` の常時適用ルールを明確化する PR #130 である。

## 目的

PR #130 に紐づく task と受け入れ条件を明確にし、条件充足状況を確認して PR 上で検収できる状態にする。

## 対象範囲

- PR #130: https://github.com/tsuji-tomonori/rag-assist/pull/130
- `tasks/done/20260506-2018-enforce-worktree-task-pr-flow.md`
- `AGENTS.md`
- `skills/worktree-task-pr-flow/SKILL.md`
- `skills/worktree-task-pr-flow/agents/openai.yaml`
- PR コメント

## 方針

- 今回の内容に直接紐づく既存 task を確認し、追加依頼分の確認 task を本ファイルとして作成する。
- 受け入れ条件は、PR #130 の変更内容とユーザーの追加依頼を検収可能な形に分解する。
- 満たしている条件のみ checked とし、未実施検証は実施済み扱いしない。

## 必要情報

- PR #130 の差分、本文、コメント
- 既存 task `tasks/done/20260506-2018-enforce-worktree-task-pr-flow.md`
- 実行済み検証結果

## 実行計画

1. 既存 task と PR #130 の状態を確認する。
2. 今回依頼に対応する追加 task file を作成する。
3. 受け入れ条件を定義し、根拠ファイル・PR 状態・検証結果に照らして確認する。
4. 確認結果を PR #130 の top-level comment として記載する。
5. task file と作業レポートを commit / push する。

## ドキュメントメンテナンス計画

- 今回は PR #130 の検収補助 task と PR コメントの追加であり、agent 運用ルール本文の追加変更は不要。
- durable docs は前回作業で `AGENTS.md` と `skills/worktree-task-pr-flow/` を更新済み。
- 製品挙動、API、Web UI、Infra、Benchmark への影響はないため、README や product docs の更新は不要。

## 受け入れ条件

- [x] PR #130 に紐づく task file が存在する。
  - 根拠: `tasks/done/20260506-2018-enforce-worktree-task-pr-flow.md`
- [x] 追加依頼に対応する task file が作成されている。
  - 根拠: 本ファイル `tasks/done/20260506-2030-pr130-acceptance-check.md`
- [x] `AGENTS.md` が実作業時の `Worktree Task PR Flow` 常時適用を明記している。
  - 根拠: `AGENTS.md` の `Worktree Task PR Flow` セクション
- [x] `skills/worktree-task-pr-flow/SKILL.md` が通常のリポジトリ実作業にも常時適用される起動条件を明記している。
  - 根拠: `skills/worktree-task-pr-flow/SKILL.md` の front matter と冒頭使用条件
- [x] `skills/worktree-task-pr-flow/agents/openai.yaml` の説明が常時適用の意図と一致している。
  - 根拠: `short_description` と `default_prompt`
- [x] 変更した Markdown / YAML の基本検証が通っている。
  - 根拠: `git diff --check` pass、`python skills/skills_agents_updater/scripts/update_skills_agents.py --root . --validate` pass、対象ファイルの `pre-commit run --files ...` pass
- [x] 受け入れ条件の確認結果が PR #130 のコメントに記載されている。
  - 根拠: GitHub Apps で PR #130 に top-level comment を追加

## 検証計画

- `git diff --check`
- `python skills/skills_agents_updater/scripts/update_skills_agents.py --root . --validate`
- `pre-commit run --files tasks/done/20260506-2030-pr130-acceptance-check.md reports/working/20260506-2030-pr130-acceptance-check.md`

## 検証結果

- `git diff --check`: pass
- `python skills/skills_agents_updater/scripts/update_skills_agents.py --root . --validate`: pass
- `pre-commit run --files tasks/done/20260506-2030-pr130-acceptance-check.md reports/working/20260506-2030-pr130-acceptance-check.md`: pass

## PRレビュー観点

- 追加 task が PR #130 の実際の内容に紐づいていること。
- 受け入れ条件がファイル、PR、検証コマンドで確認可能であること。
- PR コメントに未実施検証を実施済みとして書いていないこと。

## 未決事項・リスク

- 未決事項: なし。
- リスク: CI 状態は本 task では未確認。PR コメントでは CI 未確認として扱う。
