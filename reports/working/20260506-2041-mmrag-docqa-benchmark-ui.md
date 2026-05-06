# 作業完了レポート

保存先: `reports/working/20260506-2041-mmrag-docqa-benchmark-ui.md`

## 1. 受けた指示

- `worktree` を作成して作業する。
- `MMRAG-DocQA: A Multi-Modal Retrieval-Augmented Generation Method for Document Question-Answering with Hierarchical Index and Multi-Granularity Retrieval` を性能テストとして UI から実行できるようにする。
- 情報不足で実データセット化できない場合は確認用プロンプトを作成する。
- commit し、`main` 向け PR を GitHub Apps で作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 専用 worktree / branch を作る | 高 | 対応 |
| R2 | UI の性能テスト suite として `MMRAG-DocQA` を選択・実行できる | 高 | 対応 |
| R3 | CodeBuild runner が dataset と corpus を扱える | 高 | 対応 |
| R4 | 実 paper corpus / multimodal asset / ground truth 不足を確認プロンプト化する | 高 | 対応 |
| R5 | 関連 docs と tests を更新する | 中 | 対応 |
| R6 | commit と PR 作成を行う | 高 | commit 前時点。PR 作成はこの後実施 |

## 3. 検討・判断したこと

- 既存の管理画面は `/benchmark-suites` の suite 一覧を UI で選択し、`POST /benchmark-runs` で CodeBuild runner を起動する構成だったため、その導線に `mmrag-docqa-v1` を追加した。
- ユーザー指定は論文タイトルのみで、実評価に必要な paper corpus、画像・表・図などの multimodal assets、正解ラベル、閾値が不足していた。
- UI / runner 導線の確認用として sample dataset と sample corpus を追加し、本番評価には差し替えが必要であることを docs と確認プロンプトに明記した。
- 新規 route は追加していないが、benchmark seed 可能 suite を増やしたため、既存の benchmark seed metadata 境界に `mmrag-docqa-v1` を追加した。

## 4. 実施した作業

- `.worktrees/mmrag-docqa-benchmark-ui` を `origin/main` から作成した。
- API の benchmark suite 定義に `mmrag-docqa-v1` / `MMRAG-DocQA` を追加した。
- CDK の benchmark dataset deploy に `dataset.mmrag-docqa.sample.jsonl` を追加した。
- CodeBuild buildspec に `mmrag-docqa-v1` 用 corpus seed 設定を追加した。
- UI test mock と起動テストで `MMRAG-DocQA` 選択から `POST /benchmark-runs` されることを確認するよう更新した。
- README、運用 docs、API 設計 docs、ローカル検証 docs を更新した。
- 確認用プロンプト `MMRAG_DOCQA_CONFIRMATION_PROMPT.md` を追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | `mmrag-docqa-v1` suite 追加 | UI 実行導線 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript/CDK | dataset deploy と corpus seed 設定追加 | runner 実行導線 |
| `memorag-bedrock-mvp/benchmark/dataset.mmrag-docqa.sample.jsonl` | JSONL | MMRAG-DocQA sample dataset | 導線確認 |
| `memorag-bedrock-mvp/benchmark/corpus/mmrag-docqa-v1/mmrag-docqa-method.md` | Markdown | MMRAG-DocQA sample corpus | 導線確認 |
| `memorag-bedrock-mvp/docs/1_要求_REQ/31_変更管理_CHANGE/MMRAG_DOCQA_CONFIRMATION_PROMPT.md` | Markdown | 本番評価化に必要な確認プロンプト | 情報不足対応 |
| `reports/working/20260506-2041-mmrag-docqa-benchmark-ui.md` | Markdown | 作業完了レポート | repository rule 対応 |

## 6. 検証

| コマンド | 結果 |
|---|---|
| `npm ci` | pass |
| `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api` | pass |
| `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web` | pass |
| `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra` | pass |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api` | pass |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web` | pass |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra` | pass |
| `npm --prefix memorag-bedrock-mvp run lint` | pass |
| `git diff --check` | pass |

## 7. 指示へのfit評価

総合fit: 4.4 / 5.0（約88%）

理由: UI から `MMRAG-DocQA` suite を選択して CodeBuild benchmark run を起動する導線、dataset 配置、corpus seed、docs、tests は実装できた。一方で、ユーザーから与えられた情報は論文タイトルのみであり、実 paper corpus、multimodal assets、ground-truth answers、評価閾値は未確定のため、sample fixture と確認プロンプトを併用した。

## 8. 未対応・制約・リスク

- 本番評価としての MMRAG-DocQA dataset / corpus は未確定。
- multimodal assets の実ファイル、Textract JSON、図表 caption、ページ番号などの正解条件は未確定。
- `mmrag-docqa-v1` の sample 結果を論文手法の性能評価として使わないこと。
- PR 作成はこのレポート作成後に実施する。
