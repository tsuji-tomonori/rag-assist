# Agent Dreaming Memory Skill

Codexで「セッション間の作業記憶」を整理するためのAgent Skillです。

## Install

Repo単位で使う場合:

```bash
mkdir -p .agents/skills
cp -R agent-dreaming-memory .agents/skills/
```

個人環境全体で使う場合:

```bash
mkdir -p "$HOME/.agents/skills"
cp -R agent-dreaming-memory "$HOME/.agents/skills/"
```

## Invoke

Codexで次のように依頼します。

```text
$agent-dreaming-memory 直近の作業をdreamして、.codex-memoryを更新して
```

または:

```text
前回までの作業記録を整理し、重複・矛盾・繰り返しミスを検出して
```

## Output

デフォルトでは次のファイル群を作成・更新します。

```text
.codex-memory/
  working-memory.md
  decisions.md
  contradictions.md
  error-patterns.md
  archive-candidates.md
  audit-log.md
  dream-reports/*.md
```

## Notes

このSkillは自動削除を行いません。古い記録や重複候補は`archive-candidates.md`へ提案として残し、削除には人間のレビューを要求します。
