# G2 async agent Claude Code provider 作業レポート

## 受けた指示

- `.workspace/wsl-localhost-ubuntu-home-t-tsuji-proje-vivid-cloud.md` の plan を完了まで進める。
- G1 merge 後の Wave 7 として `G2-async-agent-claude-code` を Worktree Task PR Flow で実装する。
- provider 未設定時に mock / demo fallback を作らず、PR 作成・コメント・merge まで進める。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | `claude_code` provider の availability を設定有無で判定する | 対応 |
| R2 | AsyncAgentRun worker/service から provider adapter を呼ぶ | 対応 |
| R3 | artifact / provider log / failure reason の secret redaction を行う | 対応 |
| R4 | G3/G4 が再利用できる provider adapter interface を追加する | 対応 |
| R5 | Codex/OpenCode は未設定状態を維持し、mock product path を作らない | 対応 |
| R6 | docs / OpenAPI / task / report / tests を同期する | 対応 |

## 検討・判断

- Claude Code CLI / SDK を CI の実行前提にすると不安定になるため、実 provider は `CLAUDE_CODE_COMMAND` で設定される command adapter として切り出した。
- 未設定時は `not_configured` のまま blocked run とし、架空 artifact や固定 cost を生成しない方針を維持した。
- 成功経路のテストは provider adapter を dependency injection で差し替え、実行結果由来の artifact と sanitized log 保存を検証した。
- CodeBuild / Secrets の本格 IAM 追加は G2 では過剰なため、G3/G4 と共有できる adapter interface と config 境界に留めた。

## 実施作業

- `apps/api/src/async-agent/provider.ts` に provider adapter / registry / redaction helper を追加。
- `apps/api/src/async-agent/claude-code-provider.ts` に `CLAUDE_CODE_COMMAND` ベースの Claude Code command provider と default registry を追加し、設定された modelIds と stdout 由来の artifact だけを返すようにした。
- `MemoRagService` に provider registry 経由の availability / execution / artifact persistence / sanitized failure handling を接続。
- `Dependencies` と `config` に async agent provider registry と Claude Code 設定を追加。
- async agent route metadata / OpenAPI quality 文言を G2 の provider 実行境界に更新し、generated OpenAPI docs を再生成。
- service tests に configured / failure / not configured の Claude Code provider coverage を追加。
- `docs/spec/gap-phase-g.md` に G2 実装メモを追記。

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/async-agent/provider.ts` | provider adapter interface、registry、redaction helper |
| `apps/api/src/async-agent/claude-code-provider.ts` | Claude Code command provider と default registry |
| `apps/api/src/rag/memorag-service.ts` | provider execution、status 更新、artifact 保存 |
| `apps/api/src/rag/memorag-service.test.ts` | Claude Code provider の success/failure/not_configured tests |
| `docs/spec/gap-phase-g.md` | G2 実装メモ |
| `tasks/do/20260515-0032-g2-async-agent-claude-code.md` | task md |

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/agent-routes.test.ts apps/api/src/worker-contract.test.ts` passed
- `npm run typecheck -w @memorag-mvp/api` passed
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0` passed
- `npm run docs:openapi` passed
- `npm run docs:openapi:check` passed
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts` passed (Statements 93.72%, Branches 85.16%, Functions 93.9%, Lines 93.72%)
- `git diff --check` passed

## Fit 評価

総合fit: 4.7 / 5.0

G2 の受け入れ条件である Claude Code provider adapter、未設定時の正直な状態、sanitized artifacts/logs、worker/service 接続、G3/G4 再利用 interface は満たした。実際の Claude Code CLI / CodeBuild / Secrets 本番接続は環境依存が大きいため、`CLAUDE_CODE_COMMAND` による command adapter 境界として実装し、CI では injectable provider で成功経路を検証した。

## 未対応・制約・リスク

- `CLAUDE_CODE_COMMAND` の運用 wrapper は環境側で用意する必要がある。
- Codex / OpenCode provider は G3/G4 に残している。
- writeback 自動適用、writableCopy の実ファイル同期、provider credential UI、Secrets rotation は scope-out。
- `npm ci` で audit notice が表示されたが、この task では依存更新を行っていない。
