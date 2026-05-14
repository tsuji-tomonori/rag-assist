# G3 async agent Codex provider

- 状態: done
- タスク種別: 機能追加
- 発注元 wave: Wave 7
- 依存タスク:
  - `tasks/done/20260514-2325-g1-async-agent-foundation.md`
  - `tasks/done/20260515-0032-g2-async-agent-claude-code.md`
- ブランチ: `codex/phase-g3-async-agent-codex`
- worktree: `.worktrees/phase-g3-async-agent-codex`
- 仕様参照:
  - `docs/spec/2026-chapter-spec.md` 4C
  - `docs/spec/gap-phase-g.md`

## 背景

G2 で provider adapter interface、registry、Claude Code command provider、artifact/log redaction、worker/service 実行経路が main に入った。G3 では同じ adapter interface を使って `codex` provider を実行可能にし、未設定時の正直な状態と No Mock Product UI の境界を維持する。

## 目的

Codex provider の設定解決、availability、command 実行、artifact/log/failure sanitize を API/service に接続し、G4 OpenCode provider でも再利用しやすい provider runner 境界にする。

## スコープ

- 含む:
  - `CODEX_COMMAND` / `CODEX_MODEL_IDS` / `CODEX_TIMEOUT_MS` の設定解決。
  - `codex` provider の `available` / `not_configured` availability。
  - AsyncAgentRun worker/service から Codex adapter を呼ぶ success/failure/timeout 経路。
  - stdout 由来 artifact、stderr/provider log、failure reason の secret/token/signed URL redaction。
  - G4 が流用できる command provider runner の整理。
  - API/service/worker の targeted tests、OpenAPI/docs 影響確認、作業レポート。
- 含まない:
  - OpenCode provider 実装。
  - Codex credential 管理 UI、Secrets rotation、tenant/user-level provider setting。
  - writeback 自動適用、writableCopy の実ファイル同期。
  - provider 外部 network policy の細粒度 enforcement。
  - async agent benchmark runner 本実装。

## 実装計画

1. G2 の Claude Code provider adapter と service 実行経路を確認する。
2. command 実行共通部分を G3/G4 が再利用できる形に整理する。
3. Codex provider adapter と config を追加し、default registry で Codex を設定連動にする。
4. Codex success/failure/timeout/not_configured の tests を追加する。
5. docs/spec gap、OpenAPI generated docs、作業レポートを更新する。
6. 検証、commit、PR、受け入れ条件コメント、セルフレビュー、task done、merge まで進める。

## 受け入れ条件

- [x] `codex` provider の availability が `CODEX_COMMAND` の設定有無に基づき `available` または `not_configured` を返し、未設定時に mock run/artifact を作らない。
- [x] AsyncAgentRun worker/service が Codex adapter を呼び、成功・失敗・timeout の run status と sanitized failure/log を保存できる。
- [x] Codex provider input に selected mount / instruction / model / budget が渡り、権限外・品質不適格な mount を追加しない。
- [x] artifact metadata は実行結果に由来し、固定 artifact / demo fallback / 架空 cost を本番経路に混入しない。
- [x] secret / token / signed URL が run failure、artifact metadata、log、debug へ露出しないことをテストで確認している。
- [x] Claude Code provider の既存挙動を壊さず、OpenCode は未設定状態を維持している。
- [x] 関連 API / worker / service tests、typecheck、lint、OpenAPI docs check、`git diff --check` が pass している。
- [x] 作業レポートを `reports/working/` に追加し、PR コメント後に task を `tasks/done/` へ移動している。

## 検証計画

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/agent-routes.test.ts apps/api/src/worker-contract.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- `npm run docs:openapi:check`
- API coverage threshold check if provider/service tests materially change shared coverage
- `git diff --check`

## PR レビュー観点

- Codex provider が設定値由来の model / artifact / log だけを返し、未設定時に mock product path を作らないこと。
- Claude Code の regression がなく、OpenCode の未設定状態が維持されること。
- Secret / token / signed URL / provider raw error がユーザー可視 schema や artifacts に漏れていないこと。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を実装へ入れていないこと。
- G4 OpenCode provider が流用できる command runner 境界になっていること。

## リスク・open questions

- Codex CLI / wrapper の実運用 command は環境側で用意する必要がある。
- この task では provider credential UI と Secrets rotation は扱わない。
- command line parsing は既存 G2 と同じく単純な whitespace split を踏襲する。
