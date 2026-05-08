# agent-dreaming-memory による作業記憶見直し

## 背景

`agent-dreaming-memory` Skill を main に導入したため、ユーザー依頼によりこの Skill を使ってリポジトリの直近作業記録を見直す。

## 目的

直近の task、作業レポート、agent 指示、git 履歴を読み返し、次回以降の Codex session が参照できる `.codex-memory` を監査可能な形で作成・更新する。

## スコープ

- リポジトリ全体の最近の作業記録
- `AGENTS.md`
- `.agents/skills/**/SKILL.md`
- `skills/**/SKILL.md`
- `tasks/todo/`, `tasks/do/`, `tasks/done/`
- `reports/working/`, `reports/bugs/`
- 最近の git log
- 既存 `.codex-memory/` があればその内容

## 計画

1. `agent-dreaming-memory` の source priority に沿って source inventory を作る。
2. `consolidate_memory.py` を first-pass scanner として実行する。
3. 重要 source を読み、durable claim、重複候補、矛盾候補、反復ミス候補を抽出する。
4. `.codex-memory/` 配下に durable memory files と dream report を作成・更新する。
5. 変更 Markdown を検証し、作業レポートを残す。
6. commit / push / PR / PR コメント / task done 移動まで進める。

## ドキュメント保守計画

今回の成果物は `.codex-memory/` 自体が durable memory document である。README、AGENTS.md、`memorag-bedrock-mvp/docs/` は動作・API・運用手順を変更しないため、必要なければ更新しない。

## 受け入れ条件

- [ ] `.codex-memory/dream-reports/2026-05-08-1211.md` が作成され、scope、sources read、durable facts、duplicates、contradictions、repeated mistakes、archive candidates、next-session context を含む。
- [ ] `.codex-memory/working-memory.md` が作成・更新され、次回 session の startup context を含む。
- [ ] `.codex-memory/decisions.md` が作成・更新され、現在有効な workflow / quality gate decision を含む。
- [ ] `.codex-memory/contradictions.md` が作成・更新され、未解決矛盾または none found を明示する。
- [ ] `.codex-memory/error-patterns.md` が作成・更新され、反復ミスと corrective rule を含む。
- [ ] `.codex-memory/archive-candidates.md` が作成・更新され、削除ではなく review 候補として記録する。
- [ ] `.codex-memory/audit-log.md` が作成・更新され、読んだ source と変更ファイルを記録する。
- [ ] `reports/working/` に作業完了レポートを保存する。
- [ ] `git diff --check`、対象 Markdown の `pre-commit run --files ...`、補助スクリプト実行が pass する。
- [ ] main 向け PR を作成し、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `python3 .agents/skills/agent-dreaming-memory/scripts/consolidate_memory.py --root . --out /tmp/dream-memory-review.md`
- `git diff --check`
- `pre-commit run --files <changed markdown files>`

## PR レビュー観点

- `.codex-memory` が source references を持ち、事実と解釈を分けているか。
- 古い記録や重複候補を自動削除していないか。
- 実施していないテストや CI を実施済みとして書いていないか。
- RAG、認可境界、benchmark 固有値を弱める指示を durable memory に入れていないか。

## リスク

- 初回 dreaming pass のため source が多く、候補抽出には noise が混ざる。
- 未追跡ファイルや古い worktree の情報は main に含まれない限り今回の authoritative source から外れる。

## 状態

in_progress
