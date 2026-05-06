# 作業完了レポート

保存先: `reports/working/20260506-2051-web-api-coverage-gates.md`

## 1. 受けた指示

- `web` / `api` の C0 を 90% 以上、C1 を 85% 以上にしたい。
- 現実的か確認したうえで、現実的な場合は未達時に CI を失敗させる。
- 要件をもとに、網羅されていない箇所のテストケースを追加する。
- worktree を作成し、作業後に commit と `main` 向け PR を GitHub App で作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 専用 worktree で作業する | 高 | 対応 |
| R2 | coverage 現状を確認して現実性を判断する | 高 | 対応 |
| R3 | 現実的な coverage gate を CI に反映する | 高 | 対応 |
| R4 | 要件ベースの未網羅検出と関連テストを追加する | 高 | 対応 |
| R5 | 検証を実行し、未実施・制約を明記する | 高 | 対応 |

## 3. 検討・判断したこと

- Web は初期実測 C0 87.39% / C1 80.77% で、hooks、auth、utility、app shell のテスト追加によりリベース後の最終実測で C0 91.87% / C1 85.05% へ到達したため、C0 90% / C1 85% gate は現実的と判断した。
- API は C0 93.36% で 90% を満たす一方、C1 は 81.00% で 85% まで約139 branch 分不足していた。`app.ts`、`memorag-service.ts`、RAG node 群にまたがる広範な分岐追加が必要なため、今回のスコープで API C1 85% gate は現実的でないと判断した。
- CI では Web C0/C1 と API C0 を gate し、API C1 は CI コメントで継続可視化する方針にした。
- API contract test は c8 実行時の overhead で server readiness timeout が発生したため、待機回数を 30 から 90 に拡大した。

## 4. 実施した作業

- `codex/web-api-coverage-gates` worktree/branch を作成した。
- `memorag-ci.yml` の Web coverage 実行を閾値付き `npm run test:coverage` に変更した。
- API CI coverage は C0 90% を gate し、C1 は実測値を出力するようにした。
- Web の `vitest.config.ts` で C0 90%、C1 85% の閾値へ引き上げた。
- API の `test:coverage` は C0 90% を gate し、C1 は現実性判断により出力に留める設定へ揃えた。
- API 要件 coverage test を、全 `FR-*` / `NFR-*` が coverage map に含まれることまで検査するよう強化した。
- Web hooks、auth、API stream、history、questions、documents、benchmark、format utility などのテストを追加・拡充した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `.github/workflows/memorag-ci.yml` | YAML | Web C0/C1 gate と API C0 gate | CI gate 要件に対応 |
| `memorag-bedrock-mvp/apps/web/vitest.config.ts` | TypeScript | Web coverage thresholds を C0 90 / C1 85 に変更 | Web coverage 要件に対応 |
| `memorag-bedrock-mvp/apps/api/package.json` | JSON | API coverage script を C0 90 gate / C1 report に変更 | API coverage 現実性判断に対応 |
| `memorag-bedrock-mvp/apps/api/src/rag/requirements-coverage.test.ts` | TypeScript test | 全要件IDの coverage map 完全性を検査 | 要件ベース網羅に対応 |
| `memorag-bedrock-mvp/apps/web/src/**/*.test.ts(x)` | TypeScript tests | Web の不足分岐と要件関連 UI hooks/API utility を補強 | テストケース追加に対応 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4/5 | Web C0/C1 と API C0 は gate 化したが、API C1 85% は現実性判断により未 gate |
| 制約遵守 | 5/5 | worktree、skill、レポート、検証結果の正直な記載を遵守 |
| 成果物品質 | 4/5 | Web は閾値到達、API C1 は今後の追加テスト対象として明確化 |
| 説明責任 | 5/5 | API C1 を未 gate とした根拠と実測値を記録 |
| 検収容易性 | 5/5 | 変更ファイル、検証コマンド、coverage 数値を明示 |

**総合fit: 4.6/5（約92%）**

理由: 主要な CI gate とテスト追加は完了したが、API C1 85% は現時点の差分量から今回スコープでは現実的でないため未 gate とした。

## 7. 未対応・制約・リスク

- 未対応: API C1 85% の CI gate 化。
- 制約: API C1 は 81.00% で、85% 到達には広範な API/RAG 分岐テスト追加が必要。
- リスク: API C1 は CI コメントで可視化されるが、未達でも CI は失敗しない。

## 8. 検証

- `npm run test:coverage -w @memorag-mvp/web`: pass。C0 91.87%、C1 85.05%。
- `npm run test -w @memorag-mvp/api`: pass。144 tests。
- `npm run test:coverage -w @memorag-mvp/api`: pass。C0 93.33%、C1 80.90%。
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 0 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`: pass。C0 93.36%、C1 81.00%。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass。
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass。
- `git diff --check`: pass。
