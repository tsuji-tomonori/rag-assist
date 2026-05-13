# 作業完了レポートと commit message の証跡性

- ファイル: `docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_008.md`
- 種別: `REQ_PROJECT`
- 要求ID: `PRJ-008`
- 作成日: 2026-05-07
- 最終更新日: 2026-05-07
- 状態: Draft

## 背景

作業完了レポートと commit message が変更目的、判断、成果物、検証結果を反映していないと、後から変更理由を追跡しづらくなる。

## 目的

- PRJ-008: MemoRAG MVP の実作業後は、作業完了レポートを保存し、commit message に変更目的とレポートの要点を反映しなければならない。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `PRJ-008` |
| 説明 | `reports/working/` の作業完了レポート作成と、日本語 Conventional Commit + gitmoji 形式の commit message を定める要求。 |
| 根拠 | 変更目的、検証結果、未対応事項、判断理由を後から追跡できるようにするため。 |
| 源泉 | `AGENTS.md`、`skills/post-task-fit-report/SKILL.md`、`skills/japanese-git-commit-gitmoji/SKILL.md`。 |
| 種類 | プロジェクト要求、証跡管理制約。 |
| 依存関係 | `PRJ-001`, `PRJ-005` |
| 衝突 | ユーザーが明示的に作業レポート不要と指示した場合は、最終回答または PR 本文に省略理由を記録する。 |
| 受け入れ基準 | 本文の「受け入れ条件」を正とする。 |
| 優先度 | High |
| 安定性 | Stable。レポートまたは commit message ルール変更時に見直す。 |
| 旧制約ID | `PRJ-001-C-017`, `PRJ-001-C-018` |

## 制約

- PRJ-008-C-001: 作業完了後、最終回答前に `reports/working/` へ作業完了レポートを 1 件保存しなければならない。
- PRJ-008-C-002: commit 前に staged file を確認し、commit message は変更目的と作業レポートの要点を反映した日本語 Conventional Commit + gitmoji 形式にしなければならない。

## 受け入れ条件

- PRJ-008-AC-001: 実作業後、`reports/working/` に作業完了レポートが保存されていること。
- PRJ-008-AC-002: 作業完了レポートに、受けた指示、要件整理、検討・判断、実施作業、成果物、fit 評価、未対応・制約・リスクが含まれていること。
- PRJ-008-AC-003: commit 前に staged file が確認されていること。
- PRJ-008-AC-004: commit message が日本語 Conventional Commit + gitmoji 形式であり、作業レポートの要点を本文へ反映していること。

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | Pass | 変更理由と検証結果を後から追跡するために必要である。 |
| 十分性 | Pass | 作業レポート、staged file 確認、commit message 形式、本文反映を含む。 |
| 理解容易性 | Pass | レポートと commit message の役割を分けている。 |
| 一貫性 | Pass | post-task fit report と Japanese git commit rule に合う。 |
| 検証可能性 | Pass | report file、staged file 確認ログ、commit message で確認できる。 |

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-05-07 | Codex | `PRJ-001` から作業レポート / commit 関連要求を分割。 |
