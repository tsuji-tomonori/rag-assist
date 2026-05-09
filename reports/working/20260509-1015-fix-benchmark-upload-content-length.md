# 作業完了レポート

保存先: `reports/working/20260509-1015-fix-benchmark-upload-content-length.md`

## 1. 受けた指示

- 主な依頼: CodeBuild benchmark 失敗ログをもとに、障害レポートを作成し、なぜなぜ分析を行い、原因を修正する。
- 成果物: 障害レポート、なぜなぜ分析、benchmark runner 修正、回帰テスト、検証結果。
- 形式・条件: リポジトリルールに従い、worktree/task/report/検証/commit/PR の flow で進める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | CodeBuild 失敗の障害レポートを作成する | 高 | 対応 |
| R2 | なぜなぜ分析を行う | 高 | 対応 |
| R3 | `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` の原因を修正する | 高 | 対応 |
| R4 | 再発防止のテストを追加・更新する | 高 | 対応 |
| R5 | 関連検証を実行する | 高 | 対応 |
| R6 | 作業レポートを保存する | 高 | 対応 |

## 3. 検討・判断したこと

- 失敗箇所は `benchmark/corpus.ts` の upload session 転送で、Node.js 22 / undici が request body と `Content-Length` header の不一致を検出したものと判断した。
- API 側には S3 upload URL が `Content-Length` を返さない test が既にあるが、runner 側は upload session headers を無条件に転送していたため、古い deployment や proxy 由来の stale header に耐えられない状態だった。
- 修正は runner 側の境界防御に絞り、`Content-Length`、`Host`、`Transfer-Encoding` を upload request へ引き継がないようにした。`Content-Type` と必要時の `Authorization` は維持した。
- 公開 API や運用手順は変えていないため、恒久 docs の更新は不要と判断した。障害内容と判断理由は `reports/bugs/` に記録した。

## 4. 実施した作業

- `reports/bugs/20260509-1011-benchmark-upload-content-length-mismatch.md` を作成し、障害サマリ、証拠、なぜなぜ分析、再発防止、JSON metadata を記録した。
- `tasks/do/20260509-1011-fix-benchmark-upload-content-length.md` を作成し、受け入れ条件と検証計画を明記した。
- `memorag-bedrock-mvp/benchmark/corpus.ts` に upload session header 正規化処理を追加した。
- `memorag-bedrock-mvp/benchmark/corpus.test.ts` の PDF upload session test を拡張し、stale `Content-Length` などが転送 request に残らず、body byte length が file content と一致することを検証した。
- worktree に依存関係がなかったため `npm ci` を実行してから検証した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `reports/bugs/20260509-1011-benchmark-upload-content-length-mismatch.md` | Markdown | 障害レポートとなぜなぜ分析 | R1, R2 |
| `memorag-bedrock-mvp/benchmark/corpus.ts` | TypeScript | upload session header 正規化 | R3 |
| `memorag-bedrock-mvp/benchmark/corpus.test.ts` | TypeScript test | stale `Content-Length` 回帰テスト | R4 |
| `tasks/do/20260509-1011-fix-benchmark-upload-content-length.md` | Markdown | タスク管理と受け入れ条件 | repository flow |
| `reports/working/20260509-1015-fix-benchmark-upload-content-length.md` | Markdown | 作業完了レポート | R6 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 障害レポート、なぜなぜ分析、修正、テストを実施した。 |
| 制約遵守 | 5 | worktree/task/report/検証 flow と日本語レポート方針に従った。 |
| 成果物品質 | 4 | 実 CodeBuild 再実行は未実施だが、失敗条件を unit test で固定した。 |
| 説明責任 | 5 | 原因仮説、根拠、未確認点を障害レポートに分離して記載した。 |
| 検収容易性 | 5 | 変更箇所、検証コマンド、未実施事項を明記した。 |

総合fit: 4.8 / 5.0（約96%）
理由: 主要要件は満たした。実 AWS CodeBuild での再実行はローカル作業範囲外のため未実施。

## 7. 実行した検証

- `npm ci`: pass。worktree 内に `tsx` / `tsc` が未導入だったため実行。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass。
- `git diff --check`: pass。

## 8. 未対応・制約・リスク

- 実 CodeBuild / 実 AWS 環境での `mmrag-docqa-v1` benchmark 再実行は未実施。修正 PR merge 後に必要に応じて確認する。
- `npm ci` の結果、既存依存関係に 3 vulnerabilities が報告されたが、今回の `Content-Length` 修正とは別件のため未対応。
