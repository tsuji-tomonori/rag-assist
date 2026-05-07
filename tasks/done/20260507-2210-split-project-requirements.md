# REQ_PROJECT_001 の原子要求分割

- 状態: done
- 作成日: 2026-05-07
- 対象ブランチ: `codex/split-project-requirements`

## 背景

`memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md` は、MemoRAG MVP のプロジェクト運営制約を扱う要求である。
現状は worktree、task file、docs 構成、検証、PR、セルフレビュー、RAG 品質、認可境界、作業レポート、commit など複数の要求が 1 ファイルに含まれている。

## 目的

`REQ_PROJECT_001.md` を親要求または索引へ縮小し、個別のプロジェクト運営要求を `REQ_PROJECT_002.md` 以降へ分割する。

## 対象範囲

- `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md`
- `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_002.md` 以降の新規要求ファイル
- 本 task file
- 作業完了レポート

## 方針

- `REQ_PROJECT_001.md` は要求群の背景、共通スコープ、分割後索引、根拠資料を中心にする。
- 旧 `PRJ-001-C-*` の制約は、近い責務ごとに `PRJ-002` 以降へ分ける。
- 各要求ファイルには、その要求専用の受け入れ条件を記載する。
- 製品機能、アーキテクチャ、設計、プロジェクト運営制約を混在させない。

## 必要情報

- `memorag-bedrock-mvp/docs/DOCS_STRUCTURE.md`
- `skills/docs-swebok-template-writer/SKILL.md`
- `skills/worktree-task-pr-flow/SKILL.md`
- `skills/implementation-test-selector/SKILL.md`
- `skills/repository-test-runner/SKILL.md`
- `skills/pr-review-self-review/SKILL.md`

## 実行計画

1. `REQ_PROJECT_001.md` を親要求 / 索引へ再構成する。
2. `REQ_PROJECT_002.md` から `REQ_PROJECT_008.md` を追加する。
3. 旧制約IDから新要求IDへの対応を残す。
4. Markdown 差分と docs 整合性を検証する。
5. 作業完了レポートを作成する。
6. commit / push / PR / 受け入れ条件確認コメント / セルフレビューコメントまで進める。
7. PR コメント後に task を done へ移動して同じ PR branch に反映する。

## ドキュメントメンテナンス計画

- `memorag-bedrock-mvp/docs` 配下の要求文書だけを更新する。
- README、API 例、運用手順、AGENTS.md は、今回の変更が既存 workflow の文書分割であり挙動変更ではないため更新不要と判断する。

## 受け入れ条件

- AC-001: `REQ_PROJECT_001.md` が複数の詳細制約を直接保持せず、プロジェクト要求群の親要求 / 索引として読めること。
- AC-002: worktree、task file、docs 構成、検証、security / RAG 品質、PR、レポート / commit が個別の `REQ_PROJECT_002.md` 以降へ分割されていること。
- AC-003: 分割後の各要求ファイルが専用の要求ID、要求属性、制約、受け入れ条件、妥当性確認、変更履歴を持つこと。
- AC-004: 旧 `PRJ-001-C-*` の対応先が追跡できること。
- AC-005: 実施した検証と未実施の検証を task、report、PR 本文または PR コメントで区別すること。

## 検証計画

- `git diff --check`
- Markdown 対象ファイルの目視確認
- `pre-commit run --files <changed-files>` は hook が利用可能な場合に実行する。

## PR レビュー観点

- 1 要件 1 ファイル方針に沿っていること。
- docs と実装の同期に影響がないこと。
- 実施していない検証を実施済み扱いしていないこと。
- RAG の根拠性、認可境界、benchmark 固有値ハードコード禁止の要求が失われていないこと。

## リスク

- 分割により旧 `PRJ-001-C-*` を参照していた文脈が読みづらくなる可能性があるため、対応表で緩和する。
- ドキュメントのみの変更であり、アプリケーション動作検証は対象外になる。
