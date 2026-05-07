# プロジェクト要求をプロジェクト制約へ修正する

保存先: `tasks/done/20260507-2008-project-constraints-doc.md`

状態: done

## 背景

`memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md` はプロジェクト要求として配置されているが、現行本文は RAG 品質強化の製品要求、PM 方針、実装ロードマップを中心に記載している。

プロジェクト要求は、製品が提供すべき機能ではなく、プロジェクトが作業・検証・文書化・PR 運用で満たすべき制約を示す必要がある。

## 目的

`REQ_PROJECT_001.md` を、AGENTS、repository-local skills、過去レポートで確立されたプロジェクト運営制約に基づく要求文書へ書き換える。

## 対象範囲

- `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md`
- `tasks/do/20260507-2008-project-constraints-doc.md`
- 作業完了後の `reports/working/20260507-2008-project-constraints-doc.md`

## 方針

- 現行の RAG 品質強化ロードマップ本文はプロジェクト制約ではないため、本文の中心から外す。
- プロジェクト要求は「プロジェクトが常に満たすべき制約」を検証可能な粒度で記載する。
- 制約の根拠は、`AGENTS.md`、`skills/worktree-task-pr-flow/SKILL.md`、`skills/task-file-writer/SKILL.md`、`skills/pr-review-self-review/SKILL.md`、`skills/docs-swebok-template-writer/SKILL.md`、`skills/implementation-test-selector/SKILL.md`、関連作業・障害レポートから抽出する。
- 製品要求、実装タスク、RAG 改善ロードマップは、関連文書または別要求へ分離されるべき内容として扱う。

## 必要情報

- `AGENTS.md`: Completion Discipline、Worktree Task PR Flow、PR Self Review、Post Task Work Report、Docs Update Policy。
- `skills/worktree-task-pr-flow/SKILL.md`: task file、acceptance comment、PR、task done 移動までの完了条件。
- `skills/task-file-writer/SKILL.md`: task md の状態管理と必須セクション。
- `skills/docs-swebok-template-writer/SKILL.md`: SWEBOK-lite docs 構成と 1 要件 1 ファイル。
- `skills/pr-review-self-review/SKILL.md`: PR セルフレビュー観点。
- `skills/implementation-test-selector/SKILL.md`: 変更範囲に応じた検証選定。
- `reports/bugs/20260506-1947-worktree-task-flow-miss.md`: task file と PR 受け入れ条件コメント未実施の再発防止。
- `reports/working/20260506-2019-enforce-worktree-task-pr-flow.md`: Worktree Task PR Flow の常時適用。
- `reports/working/20260506-1737-migrate-existing-tasks.md`: `tasks/todo` / `tasks/do` / `tasks/done` 状態管理。
- `reports/working/20260506-1937-pr-review-self-review-skill.md`: PR セルフレビュー運用。
- `reports/working/20260501-0000-docs-restructure-report.md`: SWEBOK-lite docs と原子要件化。

## 実行計画

1. 対象文書と関連 skill / report の要点を確認する。
2. `REQ_PROJECT_001.md` をプロジェクト制約として全面修正する。
3. 要求属性、受け入れ条件、妥当性確認、変更履歴を整える。
4. docs 変更として最小十分な検証を実行する。
5. 作業完了レポートを作成する。
6. commit、push、GitHub Apps による PR 作成、PR コメント、task done 移動まで行う。

## ドキュメントメンテナンス計画

- `REQ_PROJECT_001.md` を直接更新する。
- 製品挙動、API、UI、RAG 実装、認可実装、運用手順は変更しないため、README、API examples、OpenAPI、設計文書の更新は不要と判断する。
- PR 本文では、今回の変更が docs の分類修正であり、製品機能の変更を含まないことを明記する。

## 受け入れ条件

- [ ] `REQ_PROJECT_001.md` が製品要求・実装ロードマップではなく、プロジェクト運営制約を中心に記載されている。
- [ ] `AGENTS.md`、skills、過去レポートに由来する制約が要求本文または根拠に反映されている。
- [ ] 要求属性、制約一覧、受け入れ条件、妥当性確認、変更履歴が含まれている。
- [ ] 実施していない検証を実施済みとして記載していない。
- [ ] docs 変更に対する最小十分な検証が実行され、結果または未実施理由が記録されている。
- [ ] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントが日本語で投稿されている。

## 検証計画

- `git diff --check`
- `pre-commit run --files memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md tasks/do/20260507-2008-project-constraints-doc.md reports/working/20260507-2008-project-constraints-doc.md`
- 必要に応じて対象 Markdown の末尾空白や見出し構成を `rg` / `sed` で確認する。

## PRレビュー観点

- プロジェクト要求と製品要求が混在していないこと。
- 要求が検証可能な制約として読めること。
- docs と既存 repository-local workflow の整合性があること。
- 未実施検証、CI 未確認、GitHub Apps 制約を実施済み扱いしていないこと。
- RAG の根拠性・認可境界を弱める変更が含まれていないこと。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を実装へ入れていないこと。

## 未決事項・リスク

- 旧本文の RAG 品質ロードマップは、この文書からは外す。必要な場合は別の製品要求、アーキテクチャ、設計、または計画レポートへ分離する。
- docs 変更のみのため、アプリケーションテストや benchmark 実行は対象外と判断する予定。

## 完了記録

- `REQ_PROJECT_001.md` をプロジェクト運営制約へ再分類した。
- `reports/working/20260507-2008-project-constraints-doc.md` に作業完了レポートを保存した。
- `git diff --check`、末尾空白確認、見出し・ID 確認、`pre-commit run --files ...` を実行し、docs 変更としての検証を通過した。
- PR #154 を GitHub Apps で作成し、`semver:patch` ラベルを付与した。
- PR #154 に受け入れ条件確認コメントとセルフレビューコメントを投稿した。
