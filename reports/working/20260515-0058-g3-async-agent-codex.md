# G3 async agent Codex provider 作業レポート

## 受けた指示

- `.workspace/wsl-localhost-ubuntu-home-t-tsuji-proje-vivid-cloud.md` の plan を完了まで進める。
- G2 merge 後の Wave 7 として `G3-async-agent-codex` を Worktree Task PR Flow で実装する。
- provider 未設定時に mock / demo fallback を作らず、PR 作成・コメント・merge まで進める。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | `codex` provider の availability を設定有無で判定する | 対応 |
| R2 | AsyncAgentRun worker/service から Codex adapter を呼ぶ | 対応 |
| R3 | artifact / provider log / failure reason の secret redaction を行う | 対応 |
| R4 | G4 が再利用できる command provider runner を整理する | 対応 |
| R5 | OpenCode は未設定状態を維持し、mock product path を作らない | 対応 |
| R6 | docs / task / report / tests を同期する | 対応 |

## 検討・判断

- G2 の Claude Code provider と同じ実行契約を Codex でも使うため、command 実行処理を `CommandAsyncAgentProvider` に切り出した。
- Codex CLI / wrapper を CI の前提にしないため、実行 provider は `CODEX_COMMAND` で設定される command adapter とし、CI では fixture command で success/failure/timeout を検証した。
- stdout が空の場合は固定 artifact を作らず、stderr / failure reason は sanitize して保存する方針を維持した。
- 早期終了する provider command で stdin `EPIPE` が起きても provider exit code による failure として扱えるよう runner を補強した。

## 実施作業

- `apps/api/src/async-agent/command-provider.ts` に reusable command provider runner を追加。
- `apps/api/src/async-agent/claude-code-provider.ts` を共通 runner 利用へ切り替え、Codex provider を default registry に追加。
- `apps/api/src/config.ts` に `CODEX_COMMAND` / `CODEX_MODEL_IDS` / `CODEX_TIMEOUT_MS` を追加。
- `sanitizeProviderText` に `CODEX_TOKEN` redaction を追加。
- `apps/api/test-fixtures/async-agent-command.sh` と service tests に Codex success/failure/timeout/not_configured coverage を追加。
- `docs/spec/gap-phase-g.md` に G3 実装メモを追記。

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/async-agent/command-provider.ts` | Claude Code / Codex / OpenCode 共通の command provider runner |
| `apps/api/src/async-agent/claude-code-provider.ts` | Claude Code / Codex provider registry |
| `apps/api/src/config.ts` | Codex provider 設定 |
| `apps/api/src/rag/memorag-service.test.ts` | Codex provider の success/failure/timeout/not_configured tests |
| `docs/spec/gap-phase-g.md` | G3 実装メモ |
| `tasks/do/20260515-0058-g3-async-agent-codex.md` | task md |

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/agent-routes.test.ts apps/api/src/worker-contract.test.ts` passed (54 tests)
- `npm run typecheck -w @memorag-mvp/api` passed
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0` passed
- `npm run docs:openapi:check` passed
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts` passed (277 tests; Statements 94.2%, Branches 85.33%, Functions 94.09%, Lines 94.2%)
- `git diff --check` passed

## Fit 評価

総合fit: 4.7 / 5.0

G3 の受け入れ条件である Codex provider adapter、未設定時の正直な状態、sanitized artifacts/logs、worker/service 接続、G4 再利用 runner は満たした。実際の Codex CLI / credential / Secrets 本番接続は環境依存が大きいため、`CODEX_COMMAND` による command adapter 境界として実装し、CI では fixture command で成功・失敗・timeout 経路を検証した。

## 未対応・制約・リスク

- `CODEX_COMMAND` の運用 wrapper は環境側で用意する必要がある。
- OpenCode provider は G4 に残している。
- provider credential UI、Secrets rotation、tenant/user-level provider settings、writeback 自動適用、writableCopy の実ファイル同期は scope-out。
- `npm ci` で audit notice が表示されたが、この task では依存更新を行っていない。
