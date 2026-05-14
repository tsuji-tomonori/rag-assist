# G2 async agent Claude Code provider

- 状態: done
- タスク種別: 機能追加
- 発注元 wave: Wave 7
- 依存タスク: `tasks/done/20260514-2325-g1-async-agent-foundation.md`
- ブランチ: `codex/phase-g2-async-agent-claude-code`
- worktree: `.worktrees/phase-g2-async-agent-claude-code`
- 仕様参照:
  - `docs/spec/2026-chapter-spec.md` 4C
  - `docs/spec/gap-phase-g.md`
  - `docs/spec/CHAPTER_TO_REQ_MAP.md`

## 背景

G1 で provider-neutral な AsyncAgentRun schema/API/worker contract と最小 Web 表示が main に入った。G2 では provider sub-PR の最初として `claude_code` provider を実行可能な provider adapter として接続し、未設定時に mock 実行へ落とさない正直な状態を保ちながら、workspace execution、log redaction、artifact metadata、timeout/budget の境界を固定する。

## 目的

Claude Code provider の実行契約を API/service/worker に実装し、後続 G3/G4 が同じ adapter interface を使える状態にする。

## スコープ

- 含む:
  - `claude_code` provider の設定解決、availability 判定、実行 adapter interface。
  - AsyncAgentRun worker から provider adapter を呼び、run status / failure reason / artifact metadata / sanitized log を保存する処理。
  - selected document/folder mount metadata を provider input に渡す前の権限・品質境界確認。
  - timeout / budget / max tool calls の enforcement 境界と failure reason の固定。
  - API / worker / service の targeted tests。
  - 必要最小の docs/spec gap 追記、OpenAPI 影響確認、作業レポート。
- 含まない:
  - Codex / OpenCode provider 実装。
  - provider credential の UI 管理画面。
  - writeback の自動適用。
  - 本番 UI に固定 run、固定 artifact、固定 cost、demo fallback を表示すること。

## 実装計画

1. G1 の AsyncAgentRun service / worker / route / Web 表示と Phase I CodeBuild/Secrets 基盤を確認する。
2. Claude Code provider の設定源と未設定時の availability を定義する。
3. provider adapter interface を追加し、worker から `claude_code` adapter を呼ぶ。
4. 実行時は secret / token / signed URL を log/artifact/debug に出さない redaction を適用する。
5. artifact metadata と run status の保存を service 層に追加し、provider 未設定時は mock artifact を作らない。
6. API / worker / service tests を追加し、G1 の route / ownership / artifact contract を壊さない。
7. docs / report / task を更新し、対象検証を実行する。
8. commit / push / PR / 受け入れ条件コメント / セルフレビューコメント / task done 更新まで完了する。

## ドキュメント更新計画

- `docs/spec/gap-phase-g.md` に G2 の実装範囲、scope-out、未設定時の正直な挙動を追記する。
- OpenAPI schema/route に変更が出る場合は generated docs を更新し、変更がない場合は作業レポートに理由を残す。
- README / OPERATIONS への運用手順追記が必要なら最小範囲で更新する。

## 受け入れ条件

- [x] `claude_code` provider の availability が設定有無に基づき `available` または `not_configured` を返し、未設定時に mock run/artifact を作らない。
- [x] AsyncAgentRun worker が `claude_code` adapter を呼び、成功・失敗・timeout/cancel の run status と sanitized failure/log を保存できる。
- [x] provider adapter input に selected mount / instruction / model / budget が渡り、権限外・品質不適格な mount を追加しない。
- [x] artifact metadata は実行結果に由来し、固定 artifact / demo fallback / 架空 cost を本番経路に混入しない。
- [x] secret / token / signed URL が run failure、artifact metadata、log、debug へ露出しないことをテストで確認している。
- [x] G3/G4 が再利用できる provider adapter interface が追加され、Codex/OpenCode は未設定状態を維持している。
- [x] 関連 API / worker / service tests、typecheck、lint、`git diff --check` が pass している。
- [x] 作業レポートを `reports/working/` に追加し、PR コメント後に task を `tasks/done/` へ移動している。

## 検証計画

- `./node_modules/.bin/tsx --test apps/api/src/agent-routes.test.ts apps/api/src/worker-contract.test.ts apps/api/src/rag/memorag-service.test.ts`
- 追加する provider adapter / worker tests
- `npm run typecheck -w @memorag-mvp/api`
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- `npm run docs:openapi:check` または OpenAPI 変更なしの確認
- `git diff --check`

## PR レビュー観点

- Claude Code provider の設定有無が正直に反映され、未設定時に mock product path が混入していないこと。
- 認可境界、品質境界、worker runId 契約、debug/log redaction を弱めていないこと。
- Secret / signed URL / provider raw error がユーザー可視 schema や artifacts に漏れていないこと。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を実装へ入れていないこと。
- G3/G4 の provider 実装へ流用可能な interface に留まっていること。

## リスク・open questions

- 実行環境で Claude Code CLI / SDK を必須にすると CI が不安定になるため、provider adapter は設定・実行境界を分離し、テスト fixture だけで成功経路を注入する。
- CodeBuild / Secrets の本番 infra 接続範囲は既存 Phase I 基盤との整合を見て、過剰な IAM 変更を避ける。
- writeback 適用は危険操作のため、この task では artifact metadata までに限定する。
