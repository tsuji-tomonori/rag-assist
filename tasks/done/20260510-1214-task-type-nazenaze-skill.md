# task 種別判定となぜなぜ分析 skill 連携

保存先: `tasks/done/20260510-1214-task-type-nazenaze-skill.md`

状態: done

タスク種別: ドキュメント更新

## 背景

タスク作成時に、その作業が機能追加、修正、調査、ドキュメント更新のいずれかを明示する運用が skill に固定されていない。特に修正タスクでは、表層的な対処に入る前に不具合の真因を特定する手順を明文化する必要がある。

## 目的

task ファイルと worktree PR flow の skill に、タスク種別の必須記載と修正タスク時のなぜなぜ分析先行を組み込む。指定 zip をもとに、なぜなぜ分析を再利用可能な skill として導入する。

## 対象範囲

- `skills/task-file-writer/SKILL.md`
- `skills/worktree-task-pr-flow/SKILL.md`
- `skills/nazenaze-analysis/`
- 本 task ファイル
- 作業完了レポート

## 方針

既存の task file 必須セクションに `タスク種別` を追加し、判定候補を `機能追加`、`修正`、`調査`、`ドキュメント更新` に限定する。修正タスクでは `skills/nazenaze-analysis/SKILL.md` を先に読み、真因・影響範囲・全量対応方針を task md と PR 説明に反映するルールにする。

## 必要情報

- ユーザー指定 zip: `.workspace/nazenaze_analysis_skill_pack.zip`
- 既存 skill: `skills/task-file-writer/SKILL.md`
- 既存 skill: `skills/worktree-task-pr-flow/SKILL.md`
- 既存運用: task md は `tasks/todo/`、`tasks/do/`、`tasks/done/` で状態管理する

## 実行計画

1. 指定 zip の内容を確認し、なぜなぜ分析 skill として配置する。
2. task file writer に `タスク種別` 必須記載と判定基準を追加する。
3. worktree task PR flow に task 種別確認と修正時のなぜなぜ分析ゲートを追加する。
4. Markdown と差分の整合性を検証する。
5. 作業レポートを作成し、commit、push、PR 作成、受け入れ条件コメント、task done 更新を行う。

## ドキュメントメンテナンス計画

この変更は agent / skill の運用ドキュメント更新であり、アプリの挙動、API、RAG 品質、認可境界、データ schema には影響しない。README や `memorag-bedrock-mvp/docs/` の更新は不要と判断する。PR 本文では、未実行検証があれば理由を明記する。

## 受け入れ条件

- [x] task file writer が、task ごとに `タスク種別` を必須記載として要求している。
- [x] task 種別の候補として `機能追加`、`修正`、`調査`、`ドキュメント更新` が明記されている。
- [x] 修正タスクでは、なぜなぜ分析を先に行い、不具合の真因を特定してから全量対応するルールが明記されている。
- [x] 指定 zip をもとに `skills/nazenaze-analysis/` が導入されている。
- [x] `git diff --check` が pass している。

## 検証計画

- `git diff --check`
- 変更した Markdown / skill ファイルの必須記載とリンク先を目視確認する。

## 検証結果

- `git diff --check`: pass
- `rg -n "[ \t]+$" <changed files>`: pass
- `pre-commit run --files <changed files>`: pass
- PR #235 に受け入れ条件確認コメントを投稿済み。
- PR #235 にセルフレビューコメントを投稿済み。

## PRレビュー観点

- `blocking`: 修正タスク時の真因分析が任意扱いになっていないこと。
- `blocking`: task 種別が task md の必須項目として明示されていること。
- `should fix`: なぜなぜ分析 skill の配置や参照パスが実際のリポジトリ構造と一致していること。
- `suggestion`: 将来、task md 形式の機械検証が必要なら validator 追加を検討できること。

## 未決事項・リスク

- 決定事項: 今回の作業種別は、アプリ挙動ではなく repository-local skill の運用変更なので `ドキュメント更新` と扱う。
- リスク: 既存 task md には `タスク種別` がないものが多いが、今回は今後作成・更新する task の skill ルール変更に限定し、既存 task の一括移行は行わない。
