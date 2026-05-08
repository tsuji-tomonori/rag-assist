# agent-dreaming-memory Skill 導入

## 背景

ユーザーが作成した `agent-dreaming-memory.zip` を、Codex の repo-scoped Skill としてこのリポジトリへ導入する。

## 目的

AI agent がセッション間の作業記録を整理し、重複・矛盾・反復ミス候補を監査可能な形で扱うための Skill を `.agents/skills/` に配置する。

## スコープ

- `.workspace/agent-dreaming-memory.zip` の内容確認
- `.agents/skills/agent-dreaming-memory/` への配置
- Skill 仕様に必要な `SKILL.md` frontmatter と同梱リソースの確認
- 必要な最小修正
- 作業レポート、commit、PR 作成、受け入れ条件確認コメント、セルフレビューコメント

## 計画

1. zip の内容と単一トップレベルフォルダ構成を確認する。
2. `.agents/skills/agent-dreaming-memory/` に展開・配置する。
3. `SKILL.md`、`README.md`、`references/`、`scripts/`、`assets/`、`agents/openai.yaml` を確認する。
4. Skill 仕様または repo 運用に対して必要な最小修正を行う。
5. 変更範囲に応じた構文・差分検証を実行する。
6. 作業レポートを作成し、commit / push / PR / PR コメントまで進める。

## ドキュメント保守計画

Skill 自体が repository-local agent automation のドキュメント兼実装であるため、追加の README / AGENTS.md 更新が必要か確認する。既存ルールと矛盾しない場合は、追加 docs 更新は不要と判断する。

## 受け入れ条件

- [x] `.agents/skills/agent-dreaming-memory/SKILL.md` が存在し、`name` と `description` を持つ。
- [x] zip の主要同梱物である `references/`、`scripts/`、`assets/`、`agents/openai.yaml` が配置されている。
- [x] 同梱 Python スクリプトが構文エラーなくコンパイルできる。
- [x] `agents/openai.yaml` が YAML として読み込める。
- [x] `git diff --check` が pass する。
- [x] 作業完了レポートを `reports/working/` に保存する。
- [x] main 向け PR を作成し、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `python3 -m py_compile .agents/skills/agent-dreaming-memory/scripts/consolidate_memory.py`
- YAML shape inspection for `.agents/skills/agent-dreaming-memory/agents/openai.yaml`
- `git diff --check`
- 可能なら `pre-commit run --files <changed-files>`

## PR レビュー観点

- Skill 仕様の必須項目を満たしているか。
- `.codex-memory` の削除・圧縮を自動実行せず、人間レビュー前提になっているか。
- 既存の worktree / task / PR flow と矛盾していないか。
- 未実施の検証を実施済みとして書いていないか。

## リスク

- zip の内容が Skill 仕様と完全一致しない場合、最小修正が必要になる。
- GitHub Apps が利用できない場合、PR 作成またはコメント投稿が blocked になる可能性がある。

## 状態

done
