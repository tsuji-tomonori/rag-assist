# 作業完了レポート

保存先: `reports/working/20260505-1947-remove-rag-llm-hardcodes.md`

## 1. 受けた指示

- main 向けの worktree を作成する。
- RAG および LLM 判定周りで固定値を用いている箇所を撤廃し、MVP でも本番相当の運用に近づける。
- 実装後に git commit し、GitHub Apps を使って main 向け PR を作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
| --- | --- | ---: | --- |
| R1 | 最新 `origin/main` から作業 worktree を作る | 高 | 対応 |
| R2 | RAG / LLM 判定の直書き値を中央管理へ移す | 高 | 対応 |
| R3 | 本番運用で環境変数から調整できるようにする | 高 | 対応 |
| R4 | 関連ドキュメントに運用・設計方針を反映する | 中 | 対応 |
| R5 | 最小十分な検証を実行する | 高 | 対応 |
| R6 | commit と PR 作成を行う | 高 | 対応 |

## 3. 検討・判断したこと

- 固定値撤廃は、個別 node に値を分散させず `config.ts` と `agent/runtime-policy.ts` に集約する方針にした。
- `runtime-policy.ts` では環境変数値を clamp し、不正な運用値が workflow に直接流れないようにした。
- 既存 API / route / permission は変更せず、RAG runtime 内部の検索件数、LLM options、confidence、件数上限、score 正規化を対象にした。
- docs は恒久的な運用・設計情報として `README.md`、`docs/OPERATIONS.md`、`DES_DLD_001.md` に最小限追記した。

## 4. 実施した作業

- `.worktrees/remove-rag-llm-hardcodes` を `origin/main` から作成した。
- `RAG_*` 環境変数を `config.ts` に追加した。
- `agent/runtime-policy.ts` を追加し、RAG / LLM 判定値を集約した。
- 検索計画、retrieval evaluator、answerability gate、sufficient context gate、answer support verifier、clue / answer / memory card 生成、citation / clarification 上限を policy 参照へ変更した。
- README、運用ドキュメント、RAG 詳細設計に runtime policy と運用変数を追記した。
- commit を作成し、GitHub Apps で PR #116 を作成した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
| --- | --- | --- | --- |
| `memorag-bedrock-mvp/apps/api/src/agent/runtime-policy.ts` | TypeScript | RAG runtime policy と LLM options の中央管理 | R2, R3 |
| `memorag-bedrock-mvp/apps/api/src/config.ts` | TypeScript | `RAG_*` 環境変数の読み取り | R3 |
| RAG / LLM 関連 node の更新 | TypeScript | 直書き値を policy 参照へ変更 | R2 |
| `memorag-bedrock-mvp/README.md`、`docs/OPERATIONS.md`、`DES_DLD_001.md` | Markdown | 運用・設計方針の反映 | R4 |
| PR #116 | GitHub Pull Request | main 向け PR | R6 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
| --- | --- | --- |
| 指示網羅性 | 5 | worktree 作成、実装、検証、レポート、commit / PR 手順まで対応対象にした |
| 制約遵守 | 5 | 既存未追跡ファイルを触らず別 worktree で作業した |
| 成果物品質 | 4.5 | RAG / LLM 判定値は中央化したが、プロンプト文面そのもののチューニングは対象外 |
| 説明責任 | 5 | docs と本レポートに判断・検証・制約を記録した |
| 検収容易性 | 5 | 検証コマンドと差分範囲を明示した |

総合fit: 4.9 / 5.0（約98%）

## 7. 検証

- `npm install`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass（114 tests）
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`: pass
- `pre-commit run --files <changed-files>`: pass
- `git diff --check`: pass
- `task docs:check:changed`: not run。この Taskfile には存在しないため、`git diff --check` と pre-commit で代替確認した。
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/116

## 8. 未対応・制約・リスク

- Bedrock 実環境での latency / cost / answer quality は未検証。ローカル mock と API test による回帰確認まで実施した。
- API route、認可、返却 schema は追加・変更していないため、access-control policy test の更新は不要と判断した。API test 内の policy test は通過済み。
