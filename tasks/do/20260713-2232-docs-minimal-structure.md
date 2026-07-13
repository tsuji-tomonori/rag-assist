# docs を実装準拠の最小構成へ統合

状態: do

タスク種別: ドキュメント更新

## 背景

`docs/` には SWEBOK-lite の `REQ` / `ARC` / `DES` / `OPS` と自動生成物の `generated` がある一方、root 直下の旧文書、`spec/`、`spec-recovery/`、複数の運用分類が併存している。ユーザーは、恒久文書を `1_要求_REQ`、`2_アーキテクチャ_ARC`、`3_設計_DES`、`4_運用_OPS/21_監視_MONITORING`、`generated` へ統合し、自動生成物以外を `generated` に置かず、実装済みの必要最小限へ合わせるよう求めている。

## 目的

現行実装、テスト、生成スクリプト、Taskfile を根拠として `docs/` の正規配置と内容を最小化し、必要だが未実装の要件は削除せず、追跡可能な todo task へ結び付ける。

## スコープ

- `docs/` 全体の構造・内容・参照の棚卸し。
- 旧 root 文書、`spec/`、`spec-recovery/`、監視以外の運用文書の正規区分への統合または削除。
- `docs/generated/` の生成元・自動生成マーカー確認と非生成物の排除。
- 実装・テストとの照合による過剰、重複、陳腐化記述の整理。
- 未実装だが維持すべき要件に対する `tasks/todo/` の作成または既存 task との対応付け。
- docs、README、Taskfile、生成スクリプト、検証スクリプト内の参照更新。
- 実装コードの機能変更は行わない。

## 計画

1. docs、実装、テスト、既存 task、reports、生成経路を棚卸しし、各文書を `confirmed` / `inferred` / `conflict` / `open_question` で評価する。
2. 正規配置、統合先、削除対象、未実装要件と todo 対応を一覧化する。
3. 正規 4 区分と `generated` へ内容を統合し、旧配置と不要物を削除する。
4. リポジトリ内の stale path、索引、生成先、検証設定を更新する。
5. 構造、リンク、生成物 provenance、Markdown、docs check を検証し、失敗を修復する。
6. 作業レポート、commit、push、PR、日本語セルフレビュー、受け入れ条件コメント、task 完了更新まで進める。

## ドキュメント保守方針

- 要件は 1 要件 1 ファイルとし、受け入れ条件を同一ファイルに維持する。
- 要件は「何を満たすか」、ARC は構造と判断、DES は実装方法、OPS/MONITORING は観測・診断・対応に限定する。
- 一時的な調査ログは `reports/working/` に置き、`docs/` へ残さない。
- `generated` は再生成可能で自動生成マーカーを持つ成果物だけに限定し、手編集しない。
- 未実装の必要要件は状態を偽らず保持し、具体的な todo task と双方向に追跡できるようにする。

## 受け入れ条件

- [ ] `docs/` の直下は `1_要求_REQ/`、`2_アーキテクチャ_ARC/`、`3_設計_DES/`、`4_運用_OPS/`、`generated/` のみである。
- [ ] `docs/4_運用_OPS/` の恒久文書は `21_監視_MONITORING/` に統合され、同階層の別分類や root 直下の運用文書が残っていない。
- [ ] `docs/generated/` の全ファイルが、リポジトリ内の生成コマンドまたは生成スクリプトへ追跡でき、自動生成物以外を含まない。
- [ ] 旧 root 文書、`spec/`、`spec-recovery/` の有効な情報が正規区分へ統合され、重複・陳腐化・不要なファイルは削除されている。
- [ ] docs の要求・ARC・DES・監視内容が現行実装とテストに照合され、実装済みでない内容を実装済みと記述していない。
- [ ] 実装が必要だが未実装の要件は要件文書に残り、各項目に対応する `tasks/todo/` が存在する。
- [ ] README、Taskfile、script、test、workflow、Markdown 内に削除済み docs path の意図しない参照が残っていない。
- [ ] 選定した docs 構造・リンク・生成 freshness・Markdown 検証がすべて pass している。
- [ ] 作業完了レポートを `reports/working/` に作成している。
- [ ] PR 作成後、日本語の受け入れ条件確認コメントとセルフレビューコメントを投稿している。

## 検証計画

- `git diff --check`
- `Taskfile.yml` と package scripts を確認後、該当する `task docs:check` または同等の docs 検証。
- 削除済み path の repository-wide `rg` 検査。
- `docs/` 許可構造と `generated` provenance の機械的検査。
- Markdown link checker またはリポジトリ既存のリンク検証。
- `python3 scripts/validate_docs.py` と単体テストを実行する。
- `pre-commit run --files <changed-files>`（利用可能な場合）。

## PR レビュー観点

- 正規配置への統合で有効な要求・設計・運用知識を失っていないか。
- docs が実装済み範囲を過大に表現していないか。
- 未実装要件と todo task の対応が具体的かつ追跡可能か。
- `generated` に手書き文書が混入せず、生成元が再現可能か。
- docs と実装、テスト、生成コマンドの参照が同期しているか。
- RAG の根拠性・回答不能制御・認可境界を弱める記述変更がないか。

## リスク

- 大量の移動・統合で相対リンクや CI の監視 path が stale になる可能性がある。
- 旧文書に実装済み・未実装・将来構想が混在しており、証拠なしに削ると要求を失う可能性がある。
- 既存 task と要件の対応が不十分な場合、同じ未実装内容の重複 todo を作る可能性がある。
- `generated` の一部に生成マーカーがなくても実際は生成物である場合があるため、内容だけでなく生成スクリプトの出力先を根拠に判定する。
