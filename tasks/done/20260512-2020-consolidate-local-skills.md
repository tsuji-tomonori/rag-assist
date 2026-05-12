# repository-local skills の配置統一

## 背景

README は `skills/` をローカル skill 定義の置き場、`agents/` を Codex/PM 用途の agent 設定として定義している。一方で `AGENTS.md` と一部 skill 実体は `.agents/skills/` を参照・利用しており、配置ルールが分裂している。

## 目的

repository-local skill の実体を `skills/<skill-name>/SKILL.md` に集約し、Codex が読む入口・索引としての `AGENTS.md` と矛盾しない構成にする。

## スコープ

- `.agents/skills/` 配下の repository-local skill を `skills/` 配下へ移動する。
- `AGENTS.md` と移動対象 skill 内の旧パス参照を更新する。
- README の役割分担と矛盾しないことを確認する。
- 作業レポート、commit、PR、受け入れ条件コメント、セルフレビューコメントまで実施する。

## タスク種別

ドキュメント更新

## 作業計画

1. `.agents/skills/` と `skills/` の現状を確認する。
2. `.agents/skills/<name>/` を `skills/<name>/` へ移動する。
3. `AGENTS.md`、移動対象 skill、関連 README/script 参照を `skills/...` に更新する。
4. 旧参照と参照切れがないことを検証する。
5. 作業レポートを作成し、commit / push / PR / PR コメントを行う。

## ドキュメントメンテナンス計画

- `README.md`: 既に `skills/` の役割を定義済みのため、変更要否を確認する。
- `AGENTS.md`: `.agents/skills/...` 参照を `skills/...` に更新する。
- `docs/`: 永続的な運用ルール更新が必要な場合のみ最小範囲で更新する。
- `memorag-bedrock-mvp/docs/`: product behavior 変更ではないため更新不要見込み。

## 受け入れ条件

- [x] `.agents/skills/` 配下の repository-local skill 実体が `skills/<skill-name>/` へ移動されている。
- [x] `AGENTS.md` の `.agents/skills/...` 参照が `skills/...` に統一されている。
- [x] 移動対象 skill 内の自己参照、README、script 例が新しい `skills/...` パスに更新されている。
- [x] `rg "\.agents/skills|agents/skills"` で、意図した履歴・過去レポート以外に旧参照が残っていないことを確認している。
- [x] 変更した `SKILL.md` の frontmatter と Markdown 差分に明らかな破損がない。
- [x] `git diff --check` が pass している。
- [x] 作業レポートが `reports/working/` に保存され、PR 本文またはコメントに検証結果と未実施事項が反映されている。

## 検証計画

- `rg --files -g 'SKILL.md' skills .agents agents`
- `rg -n "\.agents/skills|agents/skills" AGENTS.md README.md skills .agents agents docs reports tasks -g '*.md' -g '*.py' -g '*.yaml' -g '*.yml'`
- `git diff --check`
- `pre-commit run --files <changed-files>` が利用可能なら実行する。

## 検証結果

- `python3 skills/skills_agents_updater/scripts/update_skills_agents.py --root . --validate`: pass
- `python3 -m py_compile skills/agent-dreaming-memory/scripts/consolidate_memory.py`: pass
- `git diff --check`: pass
- `git diff --cached --check`: pass
- `pre-commit run --files AGENTS.md README.md skills/agent-dreaming-memory/README.md skills/agent-dreaming-memory/SKILL.md skills/agent-dreaming-memory/agents/openai.yaml skills/agent-dreaming-memory/assets/templates/dream_report_template.md skills/agent-dreaming-memory/references/dreaming_protocol.md skills/agent-dreaming-memory/references/memory_schema.md skills/agent-dreaming-memory/scripts/README.md skills/agent-dreaming-memory/scripts/consolidate_memory.py skills/blocker-recovery/SKILL.md skills/completion-status-reporter/SKILL.md skills/milestone-exec-runner/SKILL.md skills/repository-test-runner/SKILL.md skills/task-completion-guardian/SKILL.md skills/taskfile-command-runner/SKILL.md skills/verification-repair-loop/SKILL.md tasks/do/20260512-2020-consolidate-local-skills.md reports/working/20260512-2020-consolidate-local-skills.md`: pass
- `rg -n "\.agents/skills|agents/skills" AGENTS.md README.md skills .agents agents docs -g '*.md' -g '*.py' -g '*.yaml' -g '*.yml'`: `docs/spec-recovery/12_report_reading_inventory.md` の過去レポート本文由来の旧参照のみ残存。監査用履歴のため変更対象外。

## PR レビュー観点

- README の役割分担と `AGENTS.md` の必読 skill パスが一致していること。
- `.agents/skills/` に新たな repository-local skill 実体を残していないこと。
- 過去レポート・履歴資料の参照は必要以上に書き換えず、現在有効な入口・skill 本体を優先していること。
- product code / RAG / 認可境界には影響しないこと。

## リスク

- 過去レポートや task の履歴参照まで機械的に書き換えると監査記録の意味が変わる可能性があるため、現在有効な運用ファイル・skill 本体・README/script 例を優先して更新する。
- GitHub Apps が利用できない場合、PR 作成・コメントが blocked になる可能性がある。

## PR

- https://github.com/tsuji-tomonori/rag-assist/pull/275
- 受け入れ条件確認コメント: posted
- セルフレビューコメント: posted

## 状態

done
