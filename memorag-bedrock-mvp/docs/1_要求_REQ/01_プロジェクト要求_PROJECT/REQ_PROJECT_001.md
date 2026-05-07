# MemoRAG MVP プロジェクト運営制約

- ファイル: `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md`
- 種別: `REQ_PROJECT`
- 要求ID: `PRJ-001`
- 作成日: 2026-05-01
- 最終更新日: 2026-05-07
- 状態: Draft

## 背景

`memorag-bedrock-mvp` は、RAG 品質、認可境界、benchmark、docs、PR 運用を継続的に更新する MVP プロジェクトである。

過去の作業では、実装・検証・PR 作成が完了していても、作業前 task file、受け入れ条件確認コメント、task done 移動などのプロセス証跡が不足すると、レビュー時に完了条件と成果物の対応を追跡しづらくなることが確認された。

この要求は、製品が提供すべき機能ではなく、プロジェクトが作業を進める際に常に満たすべき制約を定義する。

## 目的

- PRJ-001: MemoRAG MVP の作業は、要求、task、実装、検証、レポート、commit、PR、PR コメントの追跡可能性を保つプロジェクト運営制約に従わなければならない。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `PRJ-001` |
| 説明 | MemoRAG MVP の作業単位が、事前受け入れ条件、変更範囲、検証結果、PR 上の確認結果まで追跡できるようにするプロジェクト制約。 |
| 根拠 | Worktree Task PR Flow の未実施により、PR 上で受け入れ条件と実装結果の対応が追跡しづらくなった障害が発生したため。 |
| 源泉 | `AGENTS.md`、repository-local skills、`reports/bugs/20260506-1947-worktree-task-flow-miss.md`、関連作業レポート。 |
| 種類 | プロジェクト要求、プロセス制約、品質保証制約。 |
| 依存関係 | `memorag-bedrock-mvp/docs/DOCS_STRUCTURE.md`、`skills/worktree-task-pr-flow/SKILL.md`、`skills/task-file-writer/SKILL.md`、`skills/pr-review-self-review/SKILL.md`、`skills/implementation-test-selector/SKILL.md`。 |
| 衝突 | 純粋な質問回答、計画のみの依頼、ユーザーが明示的に worktree / commit / PR を禁止した依頼では、実施範囲に合わせて workflow を調整する。 |
| 受け入れ基準 | 本文の「受け入れ条件」を正とする。 |
| 優先度 | High |
| 安定性 | Stable。運用障害または repository-local workflow の変更時に見直す。 |
| 変更履歴 | 2026-05-07: 製品要求・実装ロードマップ中心の内容を、プロジェクト運営制約へ再分類して全面更新。 |

## 制約

- PRJ-001-C-001: 実作業を伴う依頼は、原則として `origin/main` から作成した専用 worktree で実施しなければならない。
- PRJ-001-C-002: 専用 worktree は、元 worktree の未追跡変更または未コミット変更を混入してはならない。
- PRJ-001-C-003: 実作業前に、作業 task を `tasks/do/` に Markdown で作成しなければならない。
- PRJ-001-C-004: 作業 task には、背景、目的、対象範囲、方針、必要情報、実行計画、ドキュメントメンテナンス計画、受け入れ条件、検証計画、PR レビュー観点、リスクを記載しなければならない。
- PRJ-001-C-005: 作業 task の受け入れ条件は、実装前に検証可能な条件として記載しなければならない。
- PRJ-001-C-006: 要件ドキュメントは、1 要件 1 ファイルを原則とし、同一ファイル内に当該要件の受け入れ条件を含めなければならない。
- PRJ-001-C-007: 要件、アーキテクチャ、設計、運用の内容は、`memorag-bedrock-mvp/docs/DOCS_STRUCTURE.md` の SWEBOK-lite 構成に従って分離しなければならない。
- PRJ-001-C-008: 要求文書は、製品が満たすべき機能、技術制約、サービス品質制約、プロジェクト運営制約を混在させてはならない。
- PRJ-001-C-009: 実装、修正、設定変更、ドキュメント変更の完了前に、変更範囲に見合う最小十分な検証を選定し、実行または未実施理由を記録しなければならない。
- PRJ-001-C-010: 実施していないテスト、確認、CI、GitHub 操作を、実施済みとして task、report、commit message、PR 本文、PR コメント、最終回答に記載してはならない。
- PRJ-001-C-011: API route、middleware、認証、認可、RBAC、所有者境界、benchmark、debug trace、機微データ返却範囲に影響する変更は、security access-control review を実施しなければならない。
- PRJ-001-C-012: PR 作成または PR 更新時は、変更差分、PR 本文、検証結果を確認し、日本語のセルフレビュー結果を top-level PR comment として記載しなければならない。
- PRJ-001-C-013: PR セルフレビューでは、docs と実装の同期、変更範囲に見合うテスト、RAG の根拠性、認可境界を確認しなければならない。
- PRJ-001-C-014: RAG 品質修正では、benchmark 期待語句、QA sample 固有値、dataset 固有分岐、根拠選択を迂回する domain word list を実装へ入れてはならない。
- PRJ-001-C-015: Pull Request のタイトル、本文、コメント、レビューコメントは日本語で作成しなければならない。
- PRJ-001-C-016: PR 作成は GitHub Apps を優先し、利用できない場合は blocked または partially complete として理由を記録しなければならない。
- PRJ-001-C-017: 作業完了後、最終回答前に `reports/working/` へ作業完了レポートを 1 件保存しなければならない。
- PRJ-001-C-018: commit 前に staged file を確認し、commit message は変更目的と作業レポートの要点を反映した日本語 Conventional Commit + gitmoji 形式にしなければならない。
- PRJ-001-C-019: PR 作成後、task の受け入れ条件を満たしたかを日本語 PR comment として記載しなければならない。
- PRJ-001-C-020: PR への受け入れ条件確認コメント後、完了条件を満たした task は `tasks/done/` へ移動し、状態を `done` に更新しなければならない。
- PRJ-001-C-021: 検証失敗、GitHub Apps 操作失敗、未解決 blocking 指摘が残る場合は、完了ではなく blocked または partially complete として報告しなければならない。

## スコープ

### 対象

- repository-local skills に従う Codex / AI agent 作業。
- `memorag-bedrock-mvp` の要求、設計、実装、テスト、benchmark、運用、PR 作成、PR 更新を伴う作業。
- `rag-assist` リポジトリの workflow、skills、AGENTS、task、report を変更する作業。

### 対象外

- 純粋な質問回答。
- ユーザーが明示的に計画のみを依頼した作業。
- ユーザーが明示的に worktree、commit、push、PR 作成を行わないよう指示した作業。

対象外の場合でも、実施した範囲と省略した workflow ステップの理由を記録する。

## 根拠資料

| 資料 | 反映した制約 |
|---|---|
| `AGENTS.md` | Completion Discipline、Worktree Task PR Flow、Git commit message、PR 日本語文面、PR Self Review、Post Task Work Report、Implementation Docs Maintenance、Implementation Test Selection、Security Access-Control Review。 |
| `skills/worktree-task-pr-flow/SKILL.md` | 専用 worktree、task file、受け入れ条件、検証、commit、push、GitHub Apps PR、PR 受け入れ条件コメント、task done 移動。 |
| `skills/task-file-writer/SKILL.md` | `tasks/todo` / `tasks/do` / `tasks/done` の状態管理、task file 必須セクション。 |
| `skills/docs-swebok-template-writer/SKILL.md` | SWEBOK-lite docs 構成、1 要件 1 ファイル、要求内受け入れ条件。 |
| `skills/implementation-test-selector/SKILL.md` | 変更範囲に応じた最小十分な検証選定と未実施理由の記録。 |
| `skills/pr-review-self-review/SKILL.md` | PR 作成・更新時のセルフレビュー、RAG 根拠性、認可境界、benchmark 固有値ハードコード禁止。 |
| `reports/bugs/20260506-1947-worktree-task-flow-miss.md` | task file と PR 受け入れ条件コメント欠落の再発防止。 |
| `reports/working/20260506-2019-enforce-worktree-task-pr-flow.md` | 実作業時の Worktree Task PR Flow 常時適用。 |
| `reports/working/20260506-1737-migrate-existing-tasks.md` | task 状態ディレクトリへの移行と履歴管理。 |
| `reports/working/20260506-1937-pr-review-self-review-skill.md` | PR セルフレビューの repository-local skill 化。 |
| `reports/working/20260501-0000-docs-restructure-report.md` | SWEBOK-lite 構成、原子要件化、docs 継続更新方針。 |

## 受け入れ条件

- PRJ-001-AC-001: `REQ_PROJECT_001.md` の制約一覧が、製品機能や実装ロードマップではなくプロジェクト運営上の制約を記載していること。
- PRJ-001-AC-002: 制約一覧が、worktree、task file、受け入れ条件、検証、作業レポート、commit、PR、PR コメント、task done 移動を含んでいること。
- PRJ-001-AC-003: 制約一覧が、docs 構成、1 要件 1 ファイル、要求種別の分離、未実施検証の扱いを含んでいること。
- PRJ-001-AC-004: 制約一覧が、PR セルフレビュー、RAG 根拠性、認可境界、benchmark 固有値ハードコード禁止を含んでいること。
- PRJ-001-AC-005: 根拠資料に、参照した AGENTS、skills、作業レポート、障害レポートが記載されていること。
- PRJ-001-AC-006: この要求の更新 PR では、実施した検証と未実施検証が PR 本文または PR コメントで区別されていること。

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | Pass | 作業証跡不足の障害を再発防止するため、プロジェクト運営制約として必要である。 |
| 十分性 | Pass | worktree、task、docs、検証、PR、レポート、セルフレビュー、security / RAG 品質観点を含む。 |
| 理解容易性 | Pass | 各制約を `PRJ-001-C-*` として個別に記載している。 |
| 一貫性 | Pass | `AGENTS.md` と repository-local skills の運用に合わせている。 |
| 標準・契約適合 | Pass | `DOCS_STRUCTURE.md` の SWEBOK-lite 方針と 1 要件 1 ファイル方針に従っている。 |
| 実現可能性 | Pass | 既に AGENTS、skills、task 状態管理、PR コメント運用として実施済みの workflow を制約化している。 |
| 検証可能性 | Pass | 受け入れ条件を PR・task・report・検証結果で確認できる。 |
| ニーズ適合 | Pass | 指摘された「プロジェクト要求が製品要求になっている」問題に対し、プロジェクト制約へ再分類している。 |

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-05-01 | Codex | 初版作成。 |
| 2026-05-07 | Codex | RAG 品質強化ロードマップ中心の内容を、プロジェクト運営制約へ全面修正。 |

## 分離された内容

旧本文に含まれていた Sufficient Context、回答根拠検証、retrieval evaluator、RRF、benchmark runner、section / document / concept memory などは、製品要求、アーキテクチャ、設計、または計画 task として扱うべき内容である。

この要求では、それらの製品・実装ロードマップを直接定義せず、プロジェクトが要求変更や実装変更を行う際の制約だけを定義する。
