# Repository Agent Instructions

このリポジトリで作業する Codex / AI agent は、以下のルールを守る。

## Git Commit Message

Git commit message、コミットメッセージ、コミットコメント、git comment、`git commit` に関する依頼では、必ず次の skill を読む。

- `skills/japanese-git-commit-gitmoji/SKILL.md`

適用ルール:

- ユーザーが「コメント」と言った場合も、Git の文脈では commit message として扱う。
- `git diff`、`git status`、変更ファイル一覧、PR 内容、ステージ済み差分から commit message を作る場合も、この skill を適用する。
- 実際に `git commit` する前に、`git diff --cached --name-only` でステージ済みファイルを確認する。
- ステージ済みファイルに `reports/working/*.md`、`reports/bugs/*.md`、または同等の作業・障害レポートが含まれる場合は、その本文を確認し、commit message の本文に要点を反映する。
- 変更目的が複数に分かれる場合は、1 commit にまとめず、目的別の分割を検討する。
- 1 行目は原則として `<emoji> <type>(<scope>): <日本語の要約>` の形式にする。scope が不要または不明な場合は省略してよい。
- 既存の commit message がこの形式でない場合でも、新規 commit ではこのルールを優先する。

この skill が Codex の利用可能 skill 一覧に自動表示されていない場合でも、リポジトリローカルの明示ルールとして上記ファイルを参照してから作業する。

## Post Task Work Report

実作業を伴う依頼では、ユーザーが明示的に不要と指示しない限り、主作業の完了後かつ最終回答の前に必ず次の skill を読む。

- `skills/post-task-fit-report/SKILL.md`

適用ルール:

- ファイル編集、コマンド実行、調査、検証、ドキュメント作成など、リポジトリに対する実作業を行ったタスクごとに 1 件の作業完了レポートを残す。
- レポートは原則として `reports/working/` 配下に Markdown (`.md`) で保存する。
- `reports/working/` が存在しない場合は作成してから保存する。
- ファイル名は `YYYYMMDD-HHMM-<task-summary>.md` を基本とし、`<task-summary>` は ASCII 小文字とハイフンで短く表す。
- レポートには、受けた指示、要件整理、検討・判断の要約、実施作業、成果物、指示への fit 評価、未対応・制約・リスクを簡潔に含める。
- 最終回答では、生成したレポートの保存先パスを明示する。
- ユーザーが「レポート不要」「reports には出さないで」などと明示した場合のみ、このレポート作成を省略してよい。

この skill が Codex の利用可能 skill 一覧に自動表示されていない場合でも、リポジトリローカルの明示ルールとして上記ファイルを参照してから作業する。
