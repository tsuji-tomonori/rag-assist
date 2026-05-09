# 作業完了レポート

保存先: `reports/working/20260509-1023-architecture-drawing-benchmark-ui.md`

## 1. 受けた指示

- 主な依頼: Markdown 管理へ移行した建築図面 QARAG ベンチマークを UI から実行できるようにする。
- 成果物: API suite 定義、runner 準備スクリプト、CodeBuild buildspec 分岐、seed corpus 認可 whitelist、README 更新、task/report/PR 更新。
- 条件: 既存の worktree/task/PR flow に従い、実行していない検証を実施済みにしない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | UI の benchmark suite 一覧から選べる | 高 | 対応 |
| R2 | 選択した suite で run を起動できる | 高 | 対応 |
| R3 | runner が dataset と corpus を準備できる | 高 | 対応 |
| R4 | benchmark seed corpus の認可境界を維持する | 高 | 対応 |
| R5 | README に実行方法と制約を残す | 中 | 対応 |
| R6 | 関連テスト・typecheck を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- UI は `/benchmark-suites` の結果を選択肢に使うため、Web UI に固定値を追加せず API suite 定義を追加した。
- `architecture-drawing-qarag-v0.1` は外部 PDF corpus を必要とするため、既存の Allganize / MMRAG と同じく CodeBuild pre_build で準備する generated suite とした。
- Markdown の seed QA は管理正本として残し、runner 用 JSONL は `prepare:architecture-drawing-qarag` で生成することで二重管理を避けた。
- benchmark seed upload / delete の whitelist に suite ID を追加し、既存の `BENCHMARK_RUNNER` 隔離、`benchmark-corpus` metadata、safe file name 制約は維持した。
- `git-secrets` が既存の CDK test dummy account `111111111111` を false positive として検出したため、`.gitallowed` にこの既知ダミー値を最小追加した。

## 4. 実施した作業

- `MemoRagService` の `benchmarkSuites` に `architecture-drawing-qarag-v0.1` を追加した。
- `benchmark/architecture-drawing-qarag.ts` と unit test を追加し、Markdown から 82 件の dataset row を生成し、参照元 PDF を corpus dir に download できるようにした。
- benchmark package に `prepare:architecture-drawing-qarag` script を追加した。
- CodeBuild pre_build に当該 suite の dataset/corpus 準備分岐を追加し、snapshot を更新した。
- benchmark seed corpus whitelist に当該 suite を追加した。
- README の benchmark 節に UI 実行方法と外部 PDF / OCR 依存の制約を記載した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | UI に返る benchmark suite 定義追加 | UI から選択可能にした |
| `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts` | TypeScript | Markdown から JSONL dataset と corpus を準備 | runner 実行に対応 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | CodeBuild pre_build の suite 分岐追加 | UI 起動後の CodeBuild 実行に対応 |
| `memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts` | TypeScript | seed corpus 認可 whitelist 追加 | 認可境界維持 |
| `memorag-bedrock-mvp/README.md` | Markdown | 実行方法と制約の説明 | 運用者向け導線 |
| `.gitallowed` | text | 既存 dummy account の git-secrets false positive 許可 | pre-commit 通過に必要 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | UI suite 一覧、run 起動、CodeBuild 準備、認可、docs を一通り対応した |
| 制約遵守 | 5 | 既存 runner / suite / seed corpus の設計に沿って追加し、実施検証を明記した |
| 成果物品質 | 4 | Markdown 正本から JSONL を生成できる。実 PDF download / OCR は環境依存で未実行 |
| 説明責任 | 5 | 外部 URL と OCR 依存の制約を README と task に記載した |
| 検収容易性 | 5 | unit / API / Web / infra / typecheck / pre-commit の結果を記録した |

総合fit: 4.8 / 5.0（約96%）

理由: UI からの実行導線は実装・検証済み。実際の CodeBuild run と外部 PDF download は本番環境依存のため未実施。

## 7. 実行した検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- contract/api-contract.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- features/benchmark/hooks/useBenchmarkRuns.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `git diff --check`: pass
- `pre-commit run --files .gitallowed memorag-bedrock-mvp/README.md memorag-bedrock-mvp/apps/api/src/contract/api-contract.test.ts memorag-bedrock-mvp/apps/api/src/rag/memorag-service.test.ts memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.test.ts memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts memorag-bedrock-mvp/benchmark/package.json memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts tasks/do/20260509-1015-architecture-drawing-benchmark-ui.md reports/working/20260509-1023-architecture-drawing-benchmark-ui.md`: pass

## 8. 未対応・制約・リスク

- 本番またはローカル API を使った実際の `architecture-drawing-qarag-v0.1` CodeBuild run は未実施。
- 公開 PDF URL の到達性、ファイルサイズ、OCR / Textract 結果により、初回 run が失敗または一部 skip になる可能性がある。
- Markdown seed QA から生成する dataset は初期版であり、根拠 bbox / crop はまだ持たない。
- `npm ci` 後の audit は 3 vulnerabilities を報告したが、今回の変更範囲外であり `npm audit fix` は未実施。
