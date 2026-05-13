# MemoRAG MVP プロジェクト運営要求群

- ファイル: `docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md`
- 種別: `REQ_PROJECT`
- 要求ID: `PRJ-001`
- 作成日: 2026-05-01
- 最終更新日: 2026-05-07
- 状態: Draft

## 背景

`memorag-bedrock-mvp` は、RAG 品質、認可境界、benchmark、docs、PR 運用を継続的に更新する MVP プロジェクトである。

過去の作業では、実装・検証・PR 作成が完了していても、作業前 task file、受け入れ条件確認コメント、task done 移動などのプロセス証跡が不足すると、レビュー時に完了条件と成果物の対応を追跡しづらくなることが確認された。

この要求群は、製品が提供すべき機能ではなく、プロジェクトが作業を進める際に常に満たすべき運営上の要求を定義する。

## 目的

- PRJ-001: MemoRAG MVP のプロジェクト運営要求は、要求、task、実装、検証、レポート、commit、PR、PR コメントの追跡可能性を保つため、個別の検証可能な要求として管理されなければならない。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `PRJ-001` |
| 説明 | MemoRAG MVP のプロジェクト運営要求群を束ねる親要求。 |
| 根拠 | 1 ファイルに複数のプロジェクト運営要求が混在すると、受け入れ条件、検証、PR コメントとの対応を追跡しづらくなるため。 |
| 源泉 | `AGENTS.md`、repository-local skills、`reports/bugs/20260506-1947-worktree-task-flow-miss.md`、関連作業レポート。 |
| 種類 | プロジェクト要求、プロセス制約、品質保証制約。 |
| 依存関係 | `docs/DOCS_STRUCTURE.md`、`skills/docs-swebok-template-writer/SKILL.md`、`skills/worktree-task-pr-flow/SKILL.md`。 |
| 衝突 | 純粋な質問回答、計画のみの依頼、ユーザーが明示的に worktree / commit / PR を禁止した依頼では、実施範囲に合わせて workflow を調整する。 |
| 受け入れ基準 | 本文の「受け入れ条件」を正とする。 |
| 優先度 | High |
| 安定性 | Stable。運用障害または repository-local workflow の変更時に見直す。 |
| 変更履歴 | 2026-05-07: 詳細制約を `REQ_PROJECT_002.md` 以降へ分割し、親要求へ変更。 |

## 要求一覧

| 要求ID | ファイル | 主題 |
|---|---|---|
| `PRJ-001` | `REQ_PROJECT_001.md` | プロジェクト運営要求群の親要求と索引 |
| `PRJ-002` | `REQ_PROJECT_002.md` | 専用 worktree と変更混入防止 |
| `PRJ-003` | `REQ_PROJECT_003.md` | task file と受け入れ条件の事前管理 |
| `PRJ-004` | `REQ_PROJECT_004.md` | SWEBOK-lite docs 構成と 1 要件 1 ファイル |
| `PRJ-005` | `REQ_PROJECT_005.md` | 変更範囲に見合う検証と未実施検証の明記 |
| `PRJ-006` | `REQ_PROJECT_006.md` | security access-control review と RAG 品質境界 |
| `PRJ-007` | `REQ_PROJECT_007.md` | PR 作成、GitHub Apps 優先、日本語 PR コメント |
| `PRJ-008` | `REQ_PROJECT_008.md` | 作業完了レポートと commit message の証跡性 |

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

## 旧制約ID対応表

| 旧制約ID | 分割後要求 |
|---|---|
| `PRJ-001-C-001` | `PRJ-002` |
| `PRJ-001-C-002` | `PRJ-002` |
| `PRJ-001-C-003` | `PRJ-003` |
| `PRJ-001-C-004` | `PRJ-003` |
| `PRJ-001-C-005` | `PRJ-003` |
| `PRJ-001-C-006` | `PRJ-004` |
| `PRJ-001-C-007` | `PRJ-004` |
| `PRJ-001-C-008` | `PRJ-004` |
| `PRJ-001-C-009` | `PRJ-005` |
| `PRJ-001-C-010` | `PRJ-005` |
| `PRJ-001-C-011` | `PRJ-006` |
| `PRJ-001-C-012` | `PRJ-007` |
| `PRJ-001-C-013` | `PRJ-006` |
| `PRJ-001-C-014` | `PRJ-006` |
| `PRJ-001-C-015` | `PRJ-007` |
| `PRJ-001-C-016` | `PRJ-007` |
| `PRJ-001-C-017` | `PRJ-008` |
| `PRJ-001-C-018` | `PRJ-008` |
| `PRJ-001-C-019` | `PRJ-007` |
| `PRJ-001-C-020` | `PRJ-003` |
| `PRJ-001-C-021` | `PRJ-005` |

## 根拠資料

| 資料 | 反映先 |
|---|---|
| `AGENTS.md` | `PRJ-002` から `PRJ-008` |
| `skills/worktree-task-pr-flow/SKILL.md` | `PRJ-002`, `PRJ-003`, `PRJ-005`, `PRJ-007` |
| `skills/task-file-writer/SKILL.md` | `PRJ-003` |
| `skills/docs-swebok-template-writer/SKILL.md` | `PRJ-004` |
| `skills/implementation-test-selector/SKILL.md` | `PRJ-005` |
| `skills/pr-review-self-review/SKILL.md` | `PRJ-006`, `PRJ-007` |
| `reports/bugs/20260506-1947-worktree-task-flow-miss.md` | `PRJ-002`, `PRJ-003`, `PRJ-007` |
| `reports/working/20260506-2019-enforce-worktree-task-pr-flow.md` | `PRJ-002`, `PRJ-003`, `PRJ-007` |
| `reports/working/20260506-1737-migrate-existing-tasks.md` | `PRJ-003` |
| `reports/working/20260506-1937-pr-review-self-review-skill.md` | `PRJ-006`, `PRJ-007` |
| `reports/working/20260501-0000-docs-restructure-report.md` | `PRJ-004` |

## 受け入れ条件

- PRJ-001-AC-001: このファイルが詳細な運営制約を直接保持せず、プロジェクト運営要求群の索引として機能していること。
- PRJ-001-AC-002: 分割後の要求一覧に、worktree、task file、docs 構成、検証、security / RAG 品質、PR、作業レポート、commit が含まれていること。
- PRJ-001-AC-003: 旧 `PRJ-001-C-*` の対応先が本文で追跡できること。
- PRJ-001-AC-004: 各分割要求が同一ディレクトリの個別 `REQ_PROJECT_*.md` として参照できること。

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | Pass | 作業証跡不足の再発防止には、運営要求群の追跡可能性が必要である。 |
| 十分性 | Pass | 詳細要求の索引、スコープ、旧制約ID対応、根拠資料を含む。 |
| 理解容易性 | Pass | 親要求と詳細要求を分離し、詳細は `PRJ-002` 以降へ委譲している。 |
| 一貫性 | Pass | `DOCS_STRUCTURE.md` の 1 要件 1 ファイル方針に合わせている。 |
| 標準・契約適合 | Pass | SWEBOK-lite の要求文書として、要求IDと受け入れ条件を持つ。 |
| 実現可能性 | Pass | 既存の AGENTS、skills、task、report、PR workflow を要求として整理している。 |
| 検証可能性 | Pass | 受け入れ条件により、分割と追跡可能性を確認できる。 |
| ニーズ適合 | Pass | 複数要求が 1 ファイルに混在している問題を解消する。 |

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-05-01 | Codex | 初版作成。 |
| 2026-05-07 | Codex | RAG 品質強化ロードマップ中心の内容を、プロジェクト運営制約へ全面修正。 |
| 2026-05-07 | Codex | 詳細制約を `REQ_PROJECT_002.md` 以降へ分割し、親要求へ変更。 |

## 分離された内容

旧本文に含まれていた Sufficient Context、回答根拠検証、retrieval evaluator、RRF、benchmark runner、section / document / concept memory などは、製品要求、アーキテクチャ、設計、または計画 task として扱うべき内容である。

この要求群では、それらの製品・実装ロードマップを直接定義せず、プロジェクトが要求変更や実装変更を行う際の制約だけを定義する。
