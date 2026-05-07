# PR 作成、GitHub Apps 優先、日本語 PR コメント

- ファイル: `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_007.md`
- 種別: `REQ_PROJECT`
- 要求ID: `PRJ-007`
- 作成日: 2026-05-07
- 最終更新日: 2026-05-07
- 状態: Draft

## 背景

PR 本文、コメント、セルフレビュー、受け入れ条件確認が不足すると、レビュー担当者が変更の目的、検証結果、未確認リスクを判断しづらくなる。

## 目的

- PRJ-007: MemoRAG MVP の PR は、GitHub Apps を優先して作成し、日本語の PR 本文、受け入れ条件確認コメント、セルフレビューコメントで検証結果とリスクを追跡可能にしなければならない。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `PRJ-007` |
| 説明 | PR 作成、GitHub Apps 優先、日本語文面、受け入れ条件確認コメント、セルフレビューコメントを定める要求。 |
| 根拠 | PR 上で受け入れ条件と検証結果を追跡できるようにするため。 |
| 源泉 | `AGENTS.md`、`skills/github-apps-pr-operator/SKILL.md`、`skills/japanese-pr-title-comment/SKILL.md`、`skills/pr-review-self-review/SKILL.md`。 |
| 種類 | プロジェクト要求、PR 運用制約。 |
| 依存関係 | `PRJ-001`, `PRJ-003`, `PRJ-005`, `PRJ-006` |
| 衝突 | GitHub Apps が利用できない場合は blocked または partially complete として理由を記録する。 |
| 受け入れ基準 | 本文の「受け入れ条件」を正とする。 |
| 優先度 | High |
| 安定性 | Stable。GitHub 操作手段または PR template 変更時に見直す。 |
| 旧制約ID | `PRJ-001-C-012`, `PRJ-001-C-015`, `PRJ-001-C-016`, `PRJ-001-C-019` |

## 制約

- PRJ-007-C-001: PR 作成または PR 更新時は、変更差分、PR 本文、検証結果を確認し、日本語のセルフレビュー結果を top-level PR comment として記載しなければならない。
- PRJ-007-C-002: Pull Request のタイトル、本文、コメント、レビューコメントは日本語で作成しなければならない。
- PRJ-007-C-003: PR 作成は GitHub Apps を優先し、利用できない場合は blocked または partially complete として理由を記録しなければならない。
- PRJ-007-C-004: PR 作成後、task の受け入れ条件を満たしたかを日本語 PR comment として記載しなければならない。

## 受け入れ条件

- PRJ-007-AC-001: PR タイトル、本文、top-level comment が日本語で作成されていること。
- PRJ-007-AC-002: GitHub Apps を使って PR 作成またはコメント投稿を試行し、利用可否が記録されていること。
- PRJ-007-AC-003: PR 作成後に、task の受け入れ条件確認コメントが pass、fail、not verified を区別して投稿されていること。
- PRJ-007-AC-004: PR 作成または PR 更新後に、セルフレビューコメントが投稿されていること。
- PRJ-007-AC-005: GitHub Apps 操作が失敗した場合は、blocked または partially complete として理由が記録されていること。

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | Pass | PR 上で受け入れ条件、検証、リスクを追跡するために必要である。 |
| 十分性 | Pass | PR 作成、言語、GitHub Apps 優先、受け入れ条件コメント、セルフレビューを含む。 |
| 理解容易性 | Pass | PR で必要な文面と操作を分けている。 |
| 一貫性 | Pass | GitHub Apps PR Operator と Japanese PR Title and Comment のルールに合う。 |
| 検証可能性 | Pass | PR 本文と top-level comments で確認できる。 |

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-05-07 | Codex | `PRJ-001` から PR 運用関連要求を分割。 |
