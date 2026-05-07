# 作業完了レポート

保存先: `reports/working/20260507-0901-benchmark-timeout-extension.md`

## 1. 受けた指示

- 主な依頼: benchmark / QA 実行で発生した 29 秒前後の HTTP 504 を避けるため、タイムアウト時間を延ばす。
- 背景: benchmark report / summary / raw results では p50 latency 11.3 秒、p95 latency 20.6 秒、ans-001 が 29 秒で 504。主要劣化要因は誤拒否だが、今回の依頼対象は timeout 延長。
- 条件: RAG の answerability / conflict / retrieval / generation ロジック改善は今回の変更範囲に含めない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 29 秒前後の同期 API / benchmark query が 504 にならないよう timeout を延長する | 高 | 対応 |
| R2 | 変更範囲を timeout / infra 経路に限定する | 高 | 対応 |
| R3 | 変更範囲に対応する検証を実行する | 高 | 対応 |
| R4 | docs 更新要否を確認する | 中 | 対応 |
| R5 | 未実施検証を実施済み扱いしない | 高 | 対応 |

## 3. 検討・判断したこと

- 29 秒 504 と一致する設定として、`ApiFunction` の Lambda timeout と通常同期 API の API Gateway `LambdaIntegration` timeout がどちらも 29 秒だった。
- API Gateway は Regional REST API で 29 秒超の integration timeout が可能だが、quota 影響があるため、運用 docs にデプロイ前確認事項を追加した。
- chat event streaming と worker は既に 15 分 timeout の非同期 / streaming 経路であり、今回の 29 秒 504 の直接対象ではないため変更しなかった。
- 60 秒に延長し、今回の p95 20.6 秒と 29 秒失敗に対して十分な余裕を持たせた。ただし latency 自体の改善は別途 answerability / conflict loop 改善が必要。

## 4. 実施した作業

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` で同期 API timeout を `Duration.seconds(60)` に統一し、API Lambda と API Gateway integration に適用した。
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` に Lambda timeout 60 秒と API Gateway `TimeoutInMillis: 60000` の assertion を追加した。
- CDK snapshot を更新し、該当リソースの timeout が 60 秒に変わることを反映した。
- `memorag-bedrock-mvp/docs/OPERATIONS.md` に 29 秒超 timeout 利用時の API Gateway quota / throttle quota 確認事項を追加した。
- task md を `tasks/do/20260507-0857-benchmark-timeout-extension.md` に作成した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | 同期 API timeout を 60 秒へ延長 | R1, R2 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` | TypeScript test | timeout 設定の assertion 追加 | R3 |
| `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json` | JSON snapshot | synthesized template の timeout 60 秒化 | R3 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | API Gateway timeout quota 確認を追記 | R4 |
| `tasks/do/20260507-0857-benchmark-timeout-extension.md` | Markdown | 作業 task と受け入れ条件 | R5 |

## 6. 検証

| コマンド | 結果 | 補足 |
|---|---|---|
| `npm ci` | pass | worktree 内に `node_modules` がなかったため依存関係を復元 |
| `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra` | pass | snapshot 更新を含む infra test |
| `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra` | pass | snapshot 更新なしの再実行で 12 tests pass |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra` | pass | infra TypeScript typecheck |
| `git diff --check` | pass | trailing whitespace などなし |
| `pre-commit run --files ...` | pass | changed files の whitespace / EOF / merge conflict check |
| `task docs:check:changed` | 未実施 | Taskfile に該当 task が存在しなかったため実行不可 |

## 7. 指示へのfit評価

総合fit: 4.6 / 5.0（約92%）

理由: 29 秒 504 の直接原因になり得る同期 API の Lambda / API Gateway timeout を 60 秒へ延長し、infra test・snapshot・typecheck・pre-commit で確認した。API Gateway の 29 秒超 timeout はアカウント quota に依存するため、docs に運用確認事項を追記した。一方で、実 AWS アカウント上の quota 状態確認と本番 benchmark 再実行はこの作業内では未実施のため満点ではない。

## 8. 未対応・制約・リスク

- 未対応: 背景分析にある answerability gate、typed claim conflict、retrieval scope、extractive-first generation、latency loop 削減は別タスク。
- 未検証: 実 AWS アカウントで API Gateway integration timeout quota が 60 秒を許容するか、実 benchmark で ans-001 が 504 にならないかは未確認。
- 制約: `task docs:check:changed` は Taskfile に存在しなかった。
- リスク: timeout 延長は 504 を減らす対症療法であり、p95 latency や誤拒否の根本改善にはならない。
