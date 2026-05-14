# G1 async agent web coverage fix

- 状態: do
- タスク種別: CI 修正
- ブランチ: `codex/phase-g1-async-agent-coverage`
- worktree: `.worktrees/phase-g1-async-agent-coverage`

## 背景

PR #312 merge 後の MemoRAG CI で、lint/typecheck/test/build/synth は通過したが、Web coverage が statements 89.83%、branches 84.41% となり閾値 C0 90%、C1 85% を下回った。

## 目的

G1 で追加した非同期エージェント Web UI/API hook の実挙動をテストし、coverage 閾値を満たす。

## Scope

- `apps/web/src/features/agents/` の UI/hook/API 分岐に対するテストを追加する。
- 本番 UI/API の挙動は変更しない。
- 架空 provider/run/artifact/cost を本番経路へ追加しない。

## 受け入れ条件

- [ ] Web coverage が CI 閾値 C0 90%、C1 85% を満たす。
- [ ] 追加テストが non-mock product UI 方針に反しない。
- [ ] `npm test -w @memorag-mvp/web -- --coverage` または同等の coverage 検証が通る。
- [ ] `git diff --check` が通る。
- [ ] 作業レポートを `reports/working/` に追加し、PR コメント後に task を `tasks/done/` へ移動する。

## 検証計画

- `npm test -w @memorag-mvp/web -- --coverage`
- `git diff --check`
