# 本番 UI のモックデータ表示監査 作業レポート

## 指示

PR #233 と同様に、本番 UI/API 表示にモックデータを表示している箇所がないか調査し、見つかった場合は修正する。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | PR #233 と同種の固定人物名・部署・固定値 fallback を調査する | 対応 |
| R2 | 本番表示に残るモック値を実データ由来または honest state へ修正する | 対応 |
| R3 | 再発防止テストを追加・更新する | 対応 |
| R4 | 変更範囲に応じた検証を実行する | 対応 |
| R5 | 作業レポートを残す | 対応 |

## 検討・判断の要約

- PR #233 は固定の架空ユーザー名・部署を認証済みユーザー情報または `未設定` に置き換える修正だったため、同じ観点で固定部署、固定 benchmark suite、固定 dataset fallback を重点確認した。
- `DocumentWorkspace` は document group と document manifest に由来する表示へ更新済みで、固定フォルダ・容量・共有先の本番 fallback は確認されなかった。
- `BenchmarkWorkspace` は suite 未取得時に `standard-agent-v1` と `datasets/agent/standard-v1.jsonl` を表示していたため、API から suite が取れていない状態を明示し、実行も抑止する方針にした。
- `QuestionEscalationPanel` と question store は `総務部` を既定の担当部署として保存・表示し得たため、UI はユーザー入力に変更し、API store の未指定 fallback は `未設定` にした。
- 生成済み UI inventory docs は実装と同期が必要だったため、`docs:web-inventory` で再生成した。

## 実施作業

- benchmark suite 未取得時の固定 suite/dataset fallback を削除。
- selected suite が存在しない場合の benchmark 起動を抑止し、明示的なエラーを表示。
- 担当部署入力を固定部署 select から free text input に変更。
- question store の `assigneeDepartment` 未指定 fallback を `総務部` から `未設定` に変更。
- web/api の既存テストを更新し、benchmark fallback 回帰テストを追加。
- UI inventory 生成 docs を再生成。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx` | suite 未取得時の固定表示と実行を抑止 |
| `memorag-bedrock-mvp/apps/web/src/features/benchmark/hooks/useBenchmarkRuns.ts` | suite 未選択時の start 抑止 |
| `memorag-bedrock-mvp/apps/web/src/features/chat/components/QuestionEscalationPanel.tsx` | 固定部署 select を入力欄へ変更 |
| `memorag-bedrock-mvp/apps/api/src/adapters/*question-store.ts` | 担当部署 fallback を `未設定` へ変更 |
| `memorag-bedrock-mvp/apps/web/src/features/benchmark/components/BenchmarkWorkspace.test.tsx` | 固定 benchmark fallback が表示されない回帰テスト |
| `memorag-bedrock-mvp/docs/generated/*` | UI inventory docs を更新 |

## 実行した検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: fail -> テスト前提を修正後 pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass
- `rg -n "standard-agent-v1|datasets/agent/standard-v1|通常 1 営業日以内|総務部 / 人事部|情報システム部|経理部|assigneeDepartment: input\\.assigneeDepartment\\?\\.trim\\(\\) \\|\\| \\\"総務部\\\"" ... --glob '!**/*.test.ts' --glob '!**/*.test.tsx'`: 該当なし

## 指示への fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: PR #233 と同種の本番固定値表示を調査し、見つかった benchmark fallback と担当部署 fallback を修正し、テストと生成 docs も更新した。既存の npm audit 警告は今回の変更範囲外のため未対応。

## 未対応・制約・リスク

- `npm ci` で npm audit の既存通知（1 moderate, 2 high）が表示されたが、依存更新は今回のスコープ外。
- 担当部署は将来的には部署マスタ/API 由来の選択肢にする余地がある。現時点では固定部署を避けるため free text input とした。
