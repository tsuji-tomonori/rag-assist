# FR-050 非同期エージェント実行

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/spec/2026-chapter-spec.md` 4C 章
- FR-050: Claude Code、Codex、OpenCode、custom provider を選択し、共有フォルダ内の original file、skills、agent profile を利用する非同期エージェント実行を管理できること。

## 要求

Claude Code、Codex、OpenCode、custom provider を選択し、共有フォルダ内の original file、skills、agent profile を利用する非同期エージェント実行を管理できること。

## 受け入れ条件

- [ ] `AsyncAgentRun`、runtime provider、workspace mount、artifact、writeback approval を表現できる。
- [ ] writeback は full 権限、明示承認、監査ログを必須とする。
- [ ] provider 実行は timeout、予算、最大 step、最大 tool call を超過した場合に安全に終了する。

## 備考

Phase G で詳細化する。
