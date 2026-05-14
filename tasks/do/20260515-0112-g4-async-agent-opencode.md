# G4 async agent OpenCode provider

- 状態: do
- タスク種別: 機能追加
- 発注元 wave: Wave 7
- 依存タスク:
  - `tasks/done/20260514-2325-g1-async-agent-foundation.md`
  - `tasks/done/20260515-0032-g2-async-agent-claude-code.md`
  - `tasks/done/20260515-0058-g3-async-agent-codex.md`
- ブランチ: `codex/phase-g4-async-agent-opencode`
- worktree: `.worktrees/phase-g4-async-agent-opencode`
- 仕様参照:
  - `docs/spec/2026-chapter-spec.md` 4C
  - `docs/spec/gap-phase-g.md`

## 背景

G3 で Claude Code / Codex が共通 `CommandAsyncAgentProvider` に載った。G4 では Phase G provider sub-PR の最後として `opencode` provider を同じ runner に接続し、未設定時の正直な状態、secret redaction、artifact/log 保存境界を揃える。

## 目的

OpenCode provider の設定解決、availability、command 実行、artifact/log/failure sanitize を API/service に接続し、Phase G の provider adapter sub-PR を完了させる。

## スコープ

- 含む:
  - `OPENCODE_COMMAND` / `OPENCODE_MODEL_IDS` / `OPENCODE_TIMEOUT_MS` の設定解決。
  - `opencode` provider の `available` / `not_configured` availability。
  - AsyncAgentRun worker/service から OpenCode adapter を呼ぶ success/failure/timeout 経路。
  - stdout 由来 artifact、stderr/provider log、failure reason の secret/token/signed URL redaction。
  - Claude Code / Codex の既存 provider 挙動の regression 確認。
  - API/service/worker の targeted tests、OpenAPI/docs 影響確認、作業レポート。
- 含まない:
  - provider credential 管理 UI、Secrets rotation、tenant/user-level provider setting。
  - writeback 自動適用、writableCopy の実ファイル同期。
  - provider 外部 network policy の細粒度 enforcement。
  - async agent benchmark runner 本実装。

## 実装計画

1. G3 の command provider runner と registry を確認する。
2. OpenCode provider adapter と config を追加し、default registry で OpenCode を設定連動にする。
3. OpenCode success/failure/timeout/not_configured の tests を追加する。
4. docs/spec gap、作業レポートを更新する。
5. 検証、commit、PR、受け入れ条件コメント、セルフレビュー、task done、merge まで進める。

## 受け入れ条件

- [ ] `opencode` provider の availability が `OPENCODE_COMMAND` の設定有無に基づき `available` または `not_configured` を返し、未設定時に mock run/artifact を作らない。
- [ ] AsyncAgentRun worker/service が OpenCode adapter を呼び、成功・失敗・timeout の run status と sanitized failure/log を保存できる。
- [ ] OpenCode provider input に selected mount / instruction / model / budget が渡り、権限外・品質不適格な mount を追加しない。
- [ ] artifact metadata は実行結果に由来し、固定 artifact / demo fallback / 架空 cost を本番経路に混入しない。
- [ ] secret / token / signed URL が run failure、artifact metadata、log、debug へ露出しないことをテストで確認している。
- [ ] Claude Code / Codex provider の既存挙動を壊さず、custom は disabled を維持している。
- [ ] 関連 API / worker / service tests、typecheck、lint、OpenAPI docs check、`git diff --check` が pass している。
- [ ] 作業レポートを `reports/working/` に追加し、PR コメント後に task を `tasks/done/` へ移動している。

## 検証計画

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/agent-routes.test.ts apps/api/src/worker-contract.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- `npm run docs:openapi:check`
- API coverage threshold check
- `git diff --check`

## PR レビュー観点

- OpenCode provider が設定値由来の model / artifact / log だけを返し、未設定時に mock product path を作らないこと。
- Claude Code / Codex の regression がないこと。
- Secret / token / signed URL / provider raw error がユーザー可視 schema や artifacts に漏れていないこと。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を実装へ入れていないこと。

## リスク・open questions

- OpenCode CLI / wrapper の実運用 command は環境側で用意する必要がある。
- この task では provider credential UI と Secrets rotation は扱わない。
- command line parsing は G2/G3 と同じく単純な whitespace split を踏襲する。
