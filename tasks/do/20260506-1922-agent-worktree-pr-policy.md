# Agent worktree PR policy confirmation

保存先: `tasks/do/20260506-1922-agent-worktree-pr-policy.md`

## 状態

- do

## 背景

ユーザーから、worktree を作成して作業し、git commit と main 向け PR 作成まで進め、PR 作成には GitHub Apps を使うという依頼を agent が守るよう `skills` や `AGENTS.md` で設定されているか確認し、不足があれば対応するよう依頼された。

## 目的

既存の repository-local agent ルールが該当依頼を扱えることを確認し、今回のような「設定確認と不足時対応」依頼も同じ workflow の対象として明確にする。

## 対象範囲

- `AGENTS.md`
- `skills/worktree-task-pr-flow/SKILL.md`
- `skills/worktree-task-pr-flow/agents/openai.yaml`
- `tasks/do/`
- `tasks/done/`
- `reports/working/`

## 方針

- 既存ルールを確認し、すでに満たしている箇所は重複して書き換えない。
- 不足している trigger の明確化に限定して、agent が同種依頼を見落とさないようにする。
- アプリケーションコード、API、UI、インフラには触れない。

## 必要情報

- `AGENTS.md` には `Worktree Task PR Flow` があり、worktree、task md、commit、GitHub Apps による main 向け PR、PR コメント、`tasks/done` 移動が記載済み。
- `skills/worktree-task-pr-flow/SKILL.md` と `skills/worktree-task-pr-flow/agents/openai.yaml` も同 workflow を定義済み。
- 今回は agent 運用ドキュメントと skill metadata の補強が主対象。

## 実行計画

1. 専用 worktree を `origin/main` から作成する。
2. 既存の `AGENTS.md`、`skills/worktree-task-pr-flow/SKILL.md`、agent metadata を確認する。
3. 今回の確認依頼も workflow 対象と明示する最小差分を追加する。
4. Markdown/YAML と差分の検証を実行する。
5. 作業レポートを `reports/working/` に作成する。
6. commit / push し、GitHub Apps で main 向け PR を作成する。
7. PR に受け入れ条件確認コメントを追加する。
8. PR コメント後、この task md を `tasks/done/` へ移動し、状態を `done` に更新して追加 commit / push する。

## ドキュメントメンテナンス計画

- Repository-wide agent behavior の変更として `AGENTS.md` を更新する。
- workflow の詳細は `skills/worktree-task-pr-flow/SKILL.md` に集約する。
- `memorag-bedrock-mvp/docs`、README、API 例、運用手順はアプリケーション挙動に影響しないため更新不要と判断する。
- PR 本文でドキュメント影響範囲と未実施検証を明示する。

## 受け入れ条件

- `AGENTS.md` が、設定確認と不足時対応を含む同種依頼を `Worktree Task PR Flow` の対象として読める。
- `skills/worktree-task-pr-flow/SKILL.md` が、worktree、task md、commit、GitHub Apps による main 向け PR 作成を含む依頼の確認・補強作業にも適用される。
- `skills/worktree-task-pr-flow/agents/openai.yaml` の説明が、設定確認と不足時対応を含む workflow を示している。
- 既存の日本語 commit / PR / report / validation ルールと矛盾しない。
- Markdown/YAML の構文、末尾空白、差分チェックで既知の未解決失敗がない。
- main 向け PR が GitHub Apps で作成され、受け入れ条件確認コメントが日本語で投稿される。
- PR コメント後にこの task md が `tasks/done/` へ移動され、状態が `done` に更新される。

## 検証計画

- `rg -n "Worktree Task PR Flow|設定確認|GitHub Apps|worktree" AGENTS.md skills/worktree-task-pr-flow`
- `git diff --check`
- `pre-commit run --files <changed-files>` が利用可能なら実行する。

## PRレビュー観点

- `blocking`: agent が同種依頼で worktree、task md、commit、GitHub Apps PR 作成を実行する導線が明確であること。
- `blocking`: 「確認して、不足時だけ対応する」依頼で不要な設定重複を増やさないこと。
- `should fix`: `AGENTS.md`、skill 本文、agent metadata の trigger 表現が矛盾していないこと。
- `should fix`: 実施していない検証を PR 本文やコメントで実施済みとしていないこと。

## 未決事項・リスク

- 決定事項: 既存ルールは大部分を満たしているため、今回の変更は trigger 明確化に限定する。
- リスク: GitHub Apps connector が利用できない場合、PR 作成またはコメント追加が blocked になる。その場合は task を done にせず、未完了として報告する。
