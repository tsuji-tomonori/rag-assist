# G4 async agent OpenCode provider 作業レポート

## 受けた指示

- `.workspace/wsl-localhost-ubuntu-home-t-tsuji-proje-vivid-cloud.md` の plan を完了まで進める。
- G3 merge 後の Wave 7 として `G4-async-agent-opencode` を Worktree Task PR Flow で実装する。
- provider 未設定時に mock / demo fallback を作らず、PR 作成・コメント・merge まで進める。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | `opencode` provider の availability を設定有無で判定する | 対応 |
| R2 | AsyncAgentRun worker/service から OpenCode adapter を呼ぶ | 対応 |
| R3 | artifact / provider log / failure reason の secret redaction を行う | 対応 |
| R4 | Claude Code / Codex 既存挙動を維持する | 対応 |
| R5 | custom は disabled を維持し、mock product path を作らない | 対応 |
| R6 | docs / task / report / tests を同期する | 対応 |

## 検討・判断

- G3 で追加した `CommandAsyncAgentProvider` をそのまま使い、OpenCode も Claude Code / Codex と同じ stdin JSON、stdout artifact、stderr log、timeout 境界に揃えた。
- OpenCode CLI / wrapper を CI の前提にしないため、実行 provider は `OPENCODE_COMMAND` で設定される command adapter とし、CI では fixture command で success/failure/timeout を検証した。
- stdout が空の場合は固定 artifact を作らず、stderr / failure reason は sanitize して保存する方針を維持した。
- timeout fixture は SIGTERM で即終了する形にし、provider timeout test が CI 時間を浪費しないようにした。

## 実施作業

- `apps/api/src/async-agent/claude-code-provider.ts` の default registry に OpenCode command provider を追加。
- `apps/api/src/config.ts` に `OPENCODE_COMMAND` / `OPENCODE_MODEL_IDS` / `OPENCODE_TIMEOUT_MS` を追加。
- `sanitizeProviderText` に `OPENCODE_TOKEN` / `OPENCODE_API_KEY` redaction を追加。
- `apps/api/test-fixtures/async-agent-command.sh` と service tests に OpenCode success/failure/timeout/not_configured coverage を追加。
- `docs/spec/gap-phase-g.md` に G4 実装メモを追記。

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/async-agent/claude-code-provider.ts` | Claude Code / Codex / OpenCode provider registry |
| `apps/api/src/config.ts` | OpenCode provider 設定 |
| `apps/api/src/rag/memorag-service.test.ts` | OpenCode provider の success/failure/timeout/not_configured tests |
| `apps/api/test-fixtures/async-agent-command.sh` | provider command fixture |
| `docs/spec/gap-phase-g.md` | G4 実装メモ |
| `tasks/do/20260515-0112-g4-async-agent-opencode.md` | task md |

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/agent-routes.test.ts apps/api/src/worker-contract.test.ts` passed (57 tests)
- `npm run typecheck -w @memorag-mvp/api` passed
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0` passed
- `npm run docs:openapi:check` passed
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts` passed (280 tests; Statements 94.26%, Branches 85.3%, Functions 94.17%, Lines 94.26%)
- `git diff --check` passed

## Fit 評価

総合fit: 4.7 / 5.0

G4 の受け入れ条件である OpenCode provider adapter、未設定時の正直な状態、sanitized artifacts/logs、worker/service 接続、Claude Code / Codex 既存挙動維持は満たした。実際の OpenCode CLI / credential / Secrets 本番接続は環境依存が大きいため、`OPENCODE_COMMAND` による command adapter 境界として実装し、CI では fixture command で成功・失敗・timeout 経路を検証した。

## 未対応・制約・リスク

- `OPENCODE_COMMAND` の運用 wrapper は環境側で用意する必要がある。
- provider credential UI、Secrets rotation、tenant/user-level provider settings、writeback 自動適用、writableCopy の実ファイル同期は scope-out。
- `npm ci` で audit notice が表示されたが、この task では依存更新を行っていない。
