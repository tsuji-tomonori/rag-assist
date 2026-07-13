# docs 最小構成統合作業レポート

- 作成日時: 2026-07-13 23:13 JST
- 対象 branch: `codex/docs-minimal-structure`
- 基点: `origin/main` `9cd904d3c5203caf2400eb2ff654096d63f9d8fb`
- 状態: 実装・ローカル検証完了、PR workflow 実施中

## 受けた指示

`docs/` を `1_要求_REQ`、`2_アーキテクチャ_ARC`、`3_設計_DES`、`4_運用_OPS/21_監視_MONITORING`、`generated` だけに整理し、それ以外の有効情報は正規配置へ統合する。`generated` は自動生成物だけに限定し、不要物を削除する。文書を現行実装へ必要最小限に合わせ、必要だが未実装の要件は残して todo task を作成する。

## 要件整理と判断

- `docs/` 直下は指定された 5 ディレクトリの exact set とした。
- `4_運用_OPS/` の恒久文書は `21_監視_MONITORING/` の 1 ディレクトリだけとした。
- root の重複索引・手順、旧仕様計画、仕様復元の中間成果は、正規 README、2026-07 requirements baseline、変更管理、監視ランブックへ必要事項を統合した上で削除対象とした。
- OpenAPI、Web inventory、infra inventory の 127 ファイルは各 generator の出力であることと freshness を確認し、内容を手編集しなかった。
- 2026-07 requirements trace で完全実装と判定できない `FR-056`–`FR-093`、`SQ-005`–`SQ-015` は削除せず、24 件の gap と実装 todo の正規対応を baseline に統合した。
- 既存 folder/ingestion/CloudFront todo と重複する gap は既存 task を更新し、責務が異なる identity、authorization、sharing、retrieval、prompt/evidence、trace/evaluation、monitoring、signup、planning capability、open decision、responsive UI だけを新規 task に分けた。
- 調査途中の仕様抽出物は `reports/working/`、確定成果は正規 REQ/ARC/DES/OPS へ置くよう repository-local skills と `AGENTS.md` を更新した。

## 実施作業

- `docs/1_要求_REQ/README.md` と `docs/2_アーキテクチャ_ARC/README.md` を短い正規入口として作成した。
- `REQUIREMENTS_BASELINE_202607.md` に横断不変条件、旧復元 ID の統合先、24 gap、12 open question、todo trace を集約した。
- `OPS_MONITORING_001.md` を、現行の health/log/trace/benchmark/deploy/docs freshness と初動確認に限定して再構成した。未実装の本番 RAG control loop は todo と明記した。
- root 8 文書、`docs/spec/` 16 文書、`docs/spec-recovery/` 20 文書を削除した。
- canonical docs、root README、active task、API requirements coverage test の削除済み path を正規 path へ更新した。
- 未実装要件用 todo を 14 件追加し、既存 gap 関連 todo 8 件へ要求/gap trace を追記した。
- `scripts/validate_docs.py` と 6 件の単体テストを追加し、旧仕様復元専用 validator/test を削除した。
- `Taskfile.yml` に `docs:check` と不足していた Web inventory task を追加し、CI に canonical docs structure/hidden Unicode check を追加した。
- 12 repository-local skill と SWEBOK docs generator routing を正規構成へ更新した。

## 成果物

- 正規 docs: `docs/1_要求_REQ/` 142 files、`docs/2_アーキテクチャ_ARC/` 10 files、`docs/3_設計_DES/` 14 files、`docs/4_運用_OPS/` 1 file。
- 自動生成物: `docs/generated/` 127 files、差分なし。
- 構造 validator: `scripts/validate_docs.py`。
- validator test: `scripts/test_validate_docs.py`。
- 実装 gap todo: `tasks/todo/20260713-2250-*.md` から `20260713-2304-*.md` のうち 14 files。
- 作業 task: `tasks/do/20260713-2232-docs-minimal-structure.md`。

## 検証結果

| 検証 | 結果 | 備考 |
| --- | --- | --- |
| `python3 scripts/validate_docs.py` | pass | exact layout、OPS layout、generated provenance、要求形式、todo trace、旧 path、Markdown links |
| `python3 -m unittest scripts.test_validate_docs` | pass | 6 tests |
| `npm run docs:openapi:check` | pass | sandbox の tsx IPC `EPERM` 後、承認済み read-only 再実行で pass |
| `npm run docs:web-inventory:check` | pass | 最新 |
| `npm run docs:infra-inventory:check` | pass | 最新 |
| `npm run docs:hidden-unicode:check` | pass | 対象: docs/reports/tasks |
| requirements coverage targeted test | pass | 1 test、削除済み trace path を canonical docs/todo へ置換 |
| skill quick validation | pass | 変更した 12 skills 全件 |
| `task --list` | pass | `docs:check` と各 docs task を解決可能 |
| Taskfile/CI YAML parse | pass | Python `yaml.safe_load` |
| repository-wide stale path search | pass | `reports/` と `tasks/done/` の履歴を除く現役ファイルに該当なし |
| changed/untracked file pre-commit hooks | pass | secret、Unicode、whitespace、EOF、YAML、large file、merge marker、debug、line ending |
| `git diff --check` | pass | whitespace error なし |

`task docs:check` の初回実行は、proto が要求する npm 10.9.2 が worktree 環境に未導入で npm 起動前に停止した。global toolchain は変更せず、利用可能な Node 22.12.0 / npm 10.9.0 で target が解決する 5 コマンドを個別実行し、全件 pass を確認した。

`pre-commit run --all-files` は対象外の既存レポートにある Markdown hard-break の trailing spaces を一度変更したため、その変更だけ原状復帰した。その後、tracked changed files と untracked files に限定した全 hooks は pass した。

## 指示への fit 評価

- 構造: 指定 5 区分と OPS の唯一の子ディレクトリを validator で固定した。
- 最小化: 重複・中間・旧計画文書を 44 files、約 21,000 lines 削除し、正規入口と baseline/monitoring に要点を集約した。
- 実装準拠: 現行観測点と未実装 target を分離し、未実装を実装済みと記述していない。
- 要件保持: 新 requirements baseline の 49 項目を残し、24 gap と planning 要求を todo へ追跡可能にした。
- generated 制約: generator marker、許可 path、freshness を検証し、手書き差分を加えていない。

総合 fit: 5 / 5。依頼された構造、最小化、実装整合、未実装要件保持、todo 化を満たす。

## 未対応・制約・リスク

- 12 件の open question と各実装 gap は本 task では実装していない。`tasks/todo/` の対応 task で継続する。
- 品質/SLO/retention/break-glass/signup 方針は stakeholder 未承認のため、仮値を確定要求にしていない。
- product runtime は変更していないため、全 workspace test/build、実 AWS deploy、smoke、benchmark は実施していない。docs/trace に直接関係する targeted test と freshness checks を選定した。
- PR 作成、CI 結果確認、受け入れ条件コメント、セルフレビューコメント、task done 移動は、このレポート作成後の workflow で実施する。

## PR workflow 結果

- PR: 未作成
- 受け入れ条件コメント: 未実施
- セルフレビューコメント: 未実施
- task 完了更新: 未実施
