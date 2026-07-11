# 認可・文書共有・RAG 要件の再定義

状態: done

## 背景

現行実装は機能追加が先行し、特に権限境界、文書・フォルダ・グループの共有、RAG の品質・安全性・運用に関する要求が、実装・既存文書・テスト間で分散または不整合になっている。現行コードと `.workspace/rag-engineering-guide.pdf` を根拠に現状を再評価し、`.workspace/swebok-v4.pdf` の要求工学観点を用いて要件を再定義する。

## 目的

現状の実装を追認するだけでなく、利用者ニーズと安全境界から「満たすべき状態」を原子的・検証可能な要求として定義し、実装との差分を次の改善作業へ渡せる状態にする。

## タスク種別

ドキュメント更新

## スコープ

- 現行コード、既存要求・設計・テスト・作業/障害レポートの調査
- `.workspace/rag-engineering-guide.pdf` と `.workspace/swebok-v4.pdf` の関連章の調査
- 認証、RBAC、resource scope、owner/tenant 境界、文書・フォルダ・グループ共有の再定義
- RAG の文書ライフサイクル、解析、chunking、indexing、retrieval、rerank、回答生成、引用、拒否、評価、監視、安全性の再定義
- SWEBOK-lite の原子要件、要件属性、受け入れ条件、トレーサビリティ、gap/open question の作成・更新
- docs 検証、作業レポート、commit、push、PR、PR コメント

### 対象外

- 今回再定義した要件を満たすためのアプリケーションコード実装
- 本番環境への deploy、データ移行、既存 PR の merge/close
- 根拠のない性能閾値、容量上限、品質目標値の確定

## 計画

1. 入力資料と現行実装を棚卸しし、確認済み事実・推定・矛盾・未確定点を分離する。
2. ステークホルダー、対象資産、信頼境界、文書共有モデル、RAG ライフサイクルを整理する。
3. 原子的な機能要求・サービス品質要求を正規 docs 配下へ作成し、各ファイルに要件属性と受け入れ条件を記載する。
4. `docs/spec-recovery/` に根拠一覧、トレーサビリティ、現状 gap、open question を更新する。
5. validator と docs 向け検証を実行し、作業レポートを作成する。
6. 日本語 commit、main 向け PR、受け入れ条件確認コメント、セルフレビューコメント、task の done 化まで行う。

## ドキュメント保守計画

- 要件本文の正本は `docs/1_要求_REQ/` 配下の「1 要件 = 1 ファイル」とする。
- 調査根拠、実装対応状況、矛盾、未確定事項、横断トレースは `docs/spec-recovery/` に置く。
- 既存の索引、章マップ、README は、新しい正本への導線に必要な範囲で更新する。
- 一時的な作業判断と検証結果は `reports/working/` に置く。
- アプリケーション挙動を変更しないため、API/Web/infra の実装手順書は原則変更せず、現状との差は gap として記録する。

## 受け入れ条件

- [x] 現行コード、関連 docs/tests/reports、2 つの PDF が入力根拠として識別され、参照箇所と信頼度が記録されている。
- [x] ステークホルダー、資産、認証境界、RBAC、resource scope、owner/tenant 境界が区別されている。
- [x] 文書・フォルダ・グループ共有について、作成・参照・更新・削除・移動・共有変更・検索利用の許可/拒否条件が定義されている。
- [x] RAG について、取り込みから削除までのライフサイクル、検索、回答、引用、根拠不足時の拒否、権限フィルタ、prompt injection 対策、評価、監視が定義されている。
- [x] 要件本文は原則 1 要件 1 ファイルで、識別子、要求文、根拠、源泉、優先度、安定性、依存/衝突、confidence、受け入れ条件を持つ。
- [x] 閾値やプロダクト判断を資料から確定できない項目は、架空値で埋めず `inferred`、`conflict`、`open_question` のいずれかとして可視化されている。
- [x] 要件からコード・テスト・PDF・既存文書へのトレーサビリティと、実装済み/部分実装/未実装/矛盾/未検証の gap が記録されている。
- [x] `scripts/validate_spec_recovery.py` の適用可否を確認して実行し、変更範囲に適した docs 検証と `git diff --check` が pass している。
- [x] 作業完了レポートが `reports/working/` に保存され、未対応・制約・リスクが記録されている。
- [x] main 向け PR が作成され、日本語の受け入れ条件確認コメントとセルフレビューコメントが投稿されている。

## 検証結果

- pass: spec-recovery validator、validator regression 4 tests、requirements coverage 1 test
- pass: API TypeScript typecheck、targeted ESLint、Python Ruff check/format、hidden Unicode、staged-files pre-commit、`git diff --check`
- not run: AWS integration、multi-user browser E2E、load/chaos、本番 monitoring（runtime 実装は本タスク対象外）
- Taskfile docs target: OpenAPI/infra inventory 用のため、今回の requirements-only change には非適用

## 検証計画

- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- Taskfile に docs 検証 target がある場合は、その解決コマンドを確認後に最小の target を実行
- `pre-commit run --files <changed-files>`（依存が利用可能な場合）
- `git diff --check`
- 要件 ID、要件ファイル粒度、受け入れ条件、confidence、source、traceability の静的棚卸し

## PR レビュー観点

- 現行実装を「あるべき要件」と誤認していないこと
- 認証、role permission、resource scope、owner/tenant の各層を混同していないこと
- UI の非表示だけを認可とせず、API・service/store・retrieval の境界まで要求化していること
- 文書共有変更が既存チャット、引用、検索 index、監査へ与える影響を含むこと
- RAG の検索品質、回答忠実性、引用正確性、拒否、安全性を別々に検証可能にしていること
- benchmark 固有期待語句、QA sample 固有値、dataset 固有分岐を製品要件へ混入させていないこと
- 実施していない検証や CI を実施済みと記載していないこと

## リスク

- PDF は参考資料であり、プロダクト固有の利害関係者判断を代替できないため、未決定の閾値や運用責任者は open question として残る可能性がある。
- 既存要求 ID を再利用・変更すると履歴を損なうため、意味変更を避け、新規 ID と変更管理・トレースで接続する。
- 現行実装の範囲が広く、静的調査だけでは runtime/IaC の実効権限を完全には証明できないため、証拠強度を明示する。

## Publication 結果

- Draft PR: `https://github.com/tsuji-tomonori/rag-assist/pull/340`
- label: `semver:patch`
- 受け入れ条件確認コメント: 投稿済み（comment ID `4942892144`）
- セルフレビューコメント: 投稿済み（comment ID `4942894371`）
- publication 完了追記: 投稿済み（comment ID `4942897242`）
