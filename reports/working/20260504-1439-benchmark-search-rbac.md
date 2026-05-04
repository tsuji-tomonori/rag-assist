# 作業完了レポート

保存先: `reports/working/20260504-1439-benchmark-search-rbac.md`

## 1. 受けた指示

- review で指摘された search benchmark の CodeBuild runner 403 リスクに対応する。
- `BENCHMARK_RUNNER` が agent benchmark だけでなく search benchmark も実行できるようにする。
- 通常 `/search` の利用者向け権限境界を広げない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | search benchmark runner の 403 リスクを解消する | 高 | 対応 |
| R2 | `BENCHMARK_RUNNER` に過剰な通常検索権限を付けない | 高 | 対応 |
| R3 | contract/static policy test で回帰検知する | 高 | 対応 |
| R4 | docs と実装の差分を同期する | 高 | 対応 |
| R5 | 変更範囲に応じた検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- `BENCHMARK_RUNNER` に `rag:doc:read` を追加すると、通常 `/search` だけでなく同 permission を使う他 route まで広がるため、最小権限として不適切と判断した。
- runner 専用 endpoint `POST /benchmark/search` を追加し、`benchmark:query` で保護する方針を採用した。
- `benchmark/search-run.ts` は通常 `/search` ではなく `/benchmark/search` を呼ぶように変更した。

## 4. 実施した作業

- API に `POST /benchmark/search` を追加し、`SearchRequestSchema` / `SearchResponseSchema` と既存 `service.search` を再利用した。
- `authMiddleware` と静的 access-control policy test に `/benchmark/search` を追加した。
- `BENCHMARK_RUNNER` contract test で `/benchmark/query` と `/benchmark/search` が 200、通常 `/search` と `/benchmark-runs` が 403 になることを確認するようにした。
- `benchmark/search-run.ts` の送信先を `/benchmark/search` に変更した。
- README、API examples、operations、GitHub Actions deploy、REQ/ARC/DES docs を agent/search benchmark runner の実装に同期した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | `/benchmark/search` runner endpoint を追加 | search runner 403 解消 |
| `memorag-bedrock-mvp/benchmark/search-run.ts` | TypeScript | search benchmark の呼び先を `/benchmark/search` に変更 | CodeBuild runner 経路修正 |
| `memorag-bedrock-mvp/apps/api/src/contract/api-contract.test.ts` | Test | runner positive と通常 `/search` negative を追加 | 回帰防止 |
| `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` | Test | 静的 policy に `/benchmark/search` を追加 | 回帰防止 |
| `memorag-bedrock-mvp/docs/`、`memorag-bedrock-mvp/README.md` | Markdown | endpoint と運用説明を同期 | docs 差分解消 |

## 6. 検証

| コマンド | 結果 | メモ |
|---|---|---|
| `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api` | pass | 81 tests |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark` | pass | search runner typecheck |
| `npm --prefix memorag-bedrock-mvp run lint` | pass | ESLint |
| `task memorag:verify` | pass | lint、全 workspace typecheck、build |
| `git diff --check` | pass | whitespace check |

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | blocking 指摘の search runner 権限ギャップを解消した |
| 制約遵守 | 5/5 | 最小権限を保ち、通常 `/search` の境界を広げなかった |
| 成果物品質 | 5/5 | positive/negative/static policy test を追加した |
| 説明責任 | 5/5 | docs と作業レポートに判断を記録した |
| 検収容易性 | 5/5 | 変更対象と検証結果を表で整理した |

**総合fit: 5.0/5（約100%）**

理由: 指摘されたリスクを最小権限設計で解消し、実装・テスト・docs・検証を揃えた。

## 8. 未対応・制約・リスク

- 未対応: なし。
- 制約: 実 AWS CodeBuild 実行は未実施。ローカル API contract と build/typecheck で代替した。
- リスク: 既存外部 token が通常 `/search` を直接呼ぶ運用をしている場合は、`/benchmark/search` へ endpoint 移行が必要。
