# 作業完了レポート: permission escalation policy hardening

- 指示: Aardvark 脆弱性の再現有無を HEAD で確認し、存在する場合は最小修正で対処する。
- 要件整理: repository 制御下の Taskfile/npm script 実行に対する自動 escalation と確認抑制を弱める必要がある。
- 実施内容:
  - `AGENTS.md` の Permission Delegation 節を更新し、escalation の都度確認と command chain 監査を必須化。
  - `skills/taskfile-command-runner/SKILL.md` を更新し、auto-retry escalation を禁止、委譲先スクリプト監査を必須化。
  - `skills/repository-test-runner/SKILL.md` を更新し、required check の escalation 前確認を必須化。
- 検証:
  - `git diff --check` 実行（pass）。
- 成果物: 上記 3 ファイルのポリシー修正。
- リスク/制約: 実コマンド実行系テストは不要（文書ポリシー変更のみ）。
- 指示への fit: 「脆弱性が HEAD に存在する場合の最小修正」に適合。
