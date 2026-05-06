# RAG policy/profile task completion report

## 受けた指示

- worktree を作成し、`reports/tasks` 配下のタスクをすべて対応する。
- 対応後に git commit し、GitHub App を利用して `main` 宛て PR を作成する。
- リポジトリ規約に従い、作業完了レポートを残す。

## 対象タスク

- `reports/tasks/20260506-1203-rag-policy-profile.md`
- `reports/tasks/20260506-1203-adaptive-retrieval-calibration.md`
- `reports/tasks/20260506-1203-benchmark-evaluator-profiles.md`
- `reports/tasks/20260506-1203-requirements-classification-policy.md`
- `reports/tasks/20260506-1203-structure-aware-context-memory.md`
- `reports/tasks/20260506-1203-structured-fact-planning.md`
- `reports/tasks/20260506-1203-typed-claim-conflict.md`

## 要件整理

- RAG 挙動を profile/policy として分離し、デフォルト挙動を後方互換に保つ。
- 検索重み、BM25/RRF、adaptive retrieval の判断材料を明示的に構成可能にする。
- SWEBOK 要求分類向けのルール注入を汎用プロンプトから分離する。
- required facts と評価時の claim/conflict を typed schema に寄せる。
- 文書構造統計を manifest/context/memory に反映する。
- benchmark の評価基準を evaluator profile として識別可能にする。

## 実施作業

- `memorag-bedrock-mvp/apps/api/src/rag/profiles.ts` を追加し、RAG profile、retrieval profile、answer policy を定義した。
- runtime policy と config に profile ID、domain policy ID、検索重み、BM25/RRF、adaptive retrieval の環境変数を追加した。
- hybrid search に BM25 由来の lexical score、RRF、score distribution、top gap、lexical/semantic overlap、adaptive decision diagnostics を追加した。
- answer policy に基づく SWEBOK classification rules の opt-in 注入に変更した。
- required fact planner に `factType`、`subject`、`scope`、`expectedValueType`、`confidence`、`plannerSource` を追加した。
- retrieval evaluator に typed claims と typed conflict candidates を追加し、同一 subject/predicate/scope 内の競合のみリスク化するようにした。
- chunk/manifest/context/memory に document statistics を追加し、見出し、箇条書き、表、コードブロックなどの構造情報を利用するようにした。
- benchmark に evaluator profile を追加し、summary/report/result rows と baseline mismatch check に反映した。
- 運用・検証・設計・データ設計ドキュメントを更新した。

## 成果物

- 実装: API RAG profile/policy、adaptive retrieval diagnostics、typed fact/claim/conflict、structure-aware context/memory、benchmark evaluator profile。
- テスト: API/benchmark の関連 unit test と graph test を更新。
- ドキュメント: `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md`、`memorag-bedrock-mvp/docs/OPERATIONS.md`、`DES_DLD_001.md`、`DES_DATA_001.md`。

## 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/agent/graph.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass
- `task benchmark:sample`: pass

## 未対応・制約・リスク

- `task docs:check` はこの worktree の Taskfile では定義されていないため実行不可だった。
- adaptive retrieval は後方互換のため opt-in とし、デフォルトでは固定検索設定を維持した。
- typed claim extraction は deterministic heuristic であり、将来ドメイン別 extractor を profile に追加する余地がある。

## fit 評価

- `reports/tasks` 配下の 7 件すべてについて実装、テスト更新、関連ドキュメント更新を実施した。
- 実施済みの検証のみを記載し、未実行の docs check は未実行理由を明記した。
