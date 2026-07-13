# 管理画面の問題点・改善方針・受け入れ条件調査

- 状態: do
- タスク種別: 調査
- 作成日: 2026-07-13
- ブランチ: `codex/admin-ui-audit-spec`

## 背景

管理画面では、利用実績があるにもかかわらず料金表示が 0 になることや、ロール関連の一覧が把握しにくいことが指摘されている。既知の二症状だけを直すのではなく、管理画面全体について、表示値の真正性、情報設計、操作可能性、権限境界、状態表示、アクセシビリティ、関連 API・store・schema・test の整合を現行実装から棚卸しする必要がある。

## 目的

現行の管理画面と関連バックエンドを証拠ベースで調査し、問題点を網羅的に洗い出す。各問題について影響、根拠、原因または仕様ギャップ、優先度、改善方針、原子的で検証可能な受け入れ条件を整理し、後続実装の判断材料にする。

## スコープ

- `apps/web` の管理画面ルーティング、components、hooks、API client、styles、tests
- 管理画面が参照する `apps/api` の route、service、store、schema、authorization、tests
- 利用量・料金算出、ユーザー、グループ、ロール・権限、監査、alias、benchmark/debug など管理画面から到達可能な機能
- 関連する requirements、design、spec-recovery、task、work/bug report、generated web inventory
- UI の empty/loading/error/permission state、responsive layout、keyboard/screen-reader metadata

## スコープ外

- 問題の実装修正
- 料金単価・請求ルールなど、根拠資料から確定できない業務判断の代行
- 本番データや実 AWS 環境を変更する確認
- PR の merge、deploy、release

## 調査計画

1. 管理画面の画面・操作・データソース・permission gate を一覧化する。
2. 既存 docs、task、report、test と現行実装を突き合わせ、確認済み事実と仕様上の期待を分離する。
3. 料金算出とロール一覧を起点に、全管理 section の表示値、状態、操作、認可、UI/UX、アクセシビリティを静的・テスト証拠で調査する。
4. 問題ごとに severity、影響、再現条件、根拠、原因候補、改善方針を整理する。
5. task、受け入れ条件、E2E/非 UI 検証、要件・仕様、トレーサビリティ、gap/open question を `docs/spec-recovery/` に作成する。
6. validator、docs check、差分検査を行い、作業レポートと PR に結果を反映する。

## ドキュメント保守計画

- 一時的な調査ログは `reports/working/` に置く。
- 後続実装に使う問題一覧、改善方針、受け入れ条件、E2E、トレーサビリティは `docs/spec-recovery/` に置く。
- 確定仕様ではない内容を既存 canonical requirement に混ぜず、`confirmed`、`inferred`、`conflict`、`open_question` を明示する。
- 1 要件 1 検証可能条件を維持し、複合条件は AC または task を分割する。

## 受け入れ条件

- [ ] 管理画面の全 route/section と、表示・操作に使う API/store/schema/permission/test の対応表がある。
- [ ] 料金が 0 になる経路とロール一覧の可読性問題を、ファイル・行またはテストなどの根拠付きで説明している。
- [ ] 管理画面全体の問題が、データ真正性、機能欠落、状態設計、情報設計、認可、安全性、responsive/a11y、テスト・仕様欠落の観点で棚卸しされている。
- [ ] 各問題に severity、利用者影響、確度、根拠、改善方針、後続実装単位が対応している。
- [ ] 各後続 task に正常系、異常系、権限、境界値、empty/loading/recovery、必要な非機能・アクセシビリティを含む原子的な受け入れ条件がある。
- [ ] source から fact、finding/task、AC、E2E または非 UI 検証、requirement/specification まで双方向に追跡できる。
- [ ] 未確定の料金ルール、閾値、ロール運用などは架空値で補わず open question として分離している。
- [ ] `scripts/validate_spec_recovery.py` の適用可否を確認し、実行結果または非適用理由を記録している。
- [ ] 変更範囲に対応する docs/Markdown 検証と `git diff --check` が成功し、未実施検証がある場合は理由と残余リスクを記録している。
- [ ] 作業レポート、main 向け PR、日本語の受け入れ条件確認コメント、セルフレビューコメントが作成されている。

## 検証計画

- `python3 scripts/validate_spec_recovery.py`
- `task docs:check`（実体を確認し、今回の変更に適用可能な場合）
- `pre-commit run --files <changed-files>`（利用可能な場合）
- `git diff --check`
- ID・source・trace link の `rg` による静的確認

## PR レビュー観点

- 調査範囲が既知の二症状だけに縮退していないこと
- 問題の断定が現行コード・test・docs の証拠に支えられていること
- 改善方針と受け入れ条件が実装手段の先走りや架空値を含まないこと
- ロール・権限について UI 非表示だけでなく API/store の認可境界まで確認していること
- docs と実装の現状認識、No Mock Product UI、RAG/benchmark/debug の機微情報境界を弱めていないこと
- 未実施の runtime/manual a11y/実請求確認を実施済みとして書いていないこと

## リスク

- 静的実装と test fixture だけでは、本番の利用イベント有無、単価設定、AWS 請求値との一致を確定できない。
- 「問題点をすべて」は現行リポジトリから観測可能な範囲に限定され、実利用ログや利用者ヒアリングがない UX 問題は未検証として残る。
- 既存 spec-recovery は全体仕様を扱うため、既存 ID を壊さず管理画面向け成果物を追加する必要がある。
- 手動の keyboard、screen reader、320px/400% zoom、実端末検証はブラウザ実行環境がなければ未検証となる。
