# 管理画面の問題点・改善方針・受け入れ条件調査

- 状態: do
- タスク種別: 調査
- 作成日: 2026-07-13
- 完了日: 2026-07-14
- 再開日: 2026-07-14
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
5. task、受け入れ条件、E2E/非 UI 検証、要件・仕様、トレーサビリティ、gap/open question を非規範の監査 bundle として整理する。
6. validator、docs check、差分検査を行い、作業レポートと PR に結果を反映する。

## ドキュメント保守計画

- 一時的な調査ログは `reports/working/` に置く。
- 後続実装に使う問題一覧、改善方針、受け入れ条件、E2E、トレーサビリティは初回監査時点では旧 spec-recovery docs root に置いたが、現行再統合では `reports/working/admin-ui-audit-202607/` へ移し、確認済み残余 action だけを `tasks/todo/` に置く。
- 確定仕様ではない内容を既存 canonical requirement に混ぜず、`confirmed`、`inferred`、`conflict`、`open_question` を明示する。
- 1 要件 1 検証可能条件を維持し、複合条件は AC または task を分割する。

## 受け入れ条件

- [x] 管理画面の全 route/section と、表示・操作に使う API/store/schema/permission/test の対応表がある。
- [x] 料金が 0 になる経路とロール一覧の可読性問題を、ファイル・行またはテストなどの根拠付きで説明している。
- [x] 管理画面全体の問題が、データ真正性、機能欠落、状態設計、情報設計、認可、安全性、responsive/a11y、テスト・仕様欠落の観点で棚卸しされている。
- [x] 各問題に severity、利用者影響、確度、根拠、改善方針、後続実装単位が対応している。
- [x] 各後続 task に正常系、異常系、権限、境界値、empty/loading/recovery、必要な非機能・アクセシビリティを含む原子的な受け入れ条件がある。
- [x] source から fact、finding/task、AC、E2E または非 UI 検証、requirement/specification まで双方向に追跡できる。
- [x] 未確定の料金ルール、閾値、ロール運用などは架空値で補わず open question として分離している。
- [x] 初回時点の spec-recovery validator の適用可否を確認し、実行結果または非適用理由を記録している。
- [x] 変更範囲に対応する docs/Markdown 検証と `git diff --check` が成功し、未実施検証がある場合は理由と残余リスクを記録している。
- [x] 作業レポート、main 向け PR、日本語の受け入れ条件確認コメント、セルフレビューコメントが作成されている。

## 完了結果

- 結論・問題一覧・改善方針: `reports/working/admin-ui-audit-202607/18_admin_ui_audit_202607.md`–`29_admin_ui_open_questions_202607.md`
- 要件候補（非規範の履歴）: `reports/working/admin-ui-audit-202607/requirements/REQ_AUI_001.md`–`REQ_AUI_013.md`
- 現行再検証: `reports/working/admin-ui-audit-202607/30_admin_ui_revalidation_20260714.md`
- 作業レポート: `reports/working/20260713-2359-admin-ui-audit-spec.md`
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/344
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/344#issuecomment-4959463475
- 受け入れ条件確認: https://github.com/tsuji-tomonori/rag-assist/pull/344#issuecomment-4959467766
- 検証: spec-recovery validator、hidden Unicode、pre-commit、AUI ID/reference/collision、要件必須属性、stage済みdiff checkが成功
- 未実施境界: production codeの修正、後続E2E、実AWS/請求/identity、実browser/支援技術は本調査の完了対象外であり、各ACとPRにrelease gateとして記録

## 検証計画

- `python3 scripts/validate_docs.py`
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
- 初回監査では spec-recovery 全体の ID を壊さない必要があった。現行では旧 root を復活させず、AUI ID を非規範の履歴 bundle 内だけで維持する。
- 手動の keyboard、screen reader、320px/400% zoom、実端末検証はブラウザ実行環境がなければ未検証となる。

## 2026-07-14 最新 main 再統合

PR #341–#343 の取り込みにより、監査基準 `9cd904d3` から認可・account lifecycle・正規 docs 構造が大きく変わった。旧監査を現行の規範仕様として旧 spec-recovery docs root へ戻さず、履歴証跡として `reports/working/` へ移し、36 gap を最新 main で再判定する。

### 再統合計画

1. PR #343 merge 後の `origin/main` を取り込み、削除済み legacy docs root を復活させない。
2. 旧監査 bundle は基準 commit と非規範性を明示して `reports/working/admin-ui-audit-202607/` へ移す。
3. 36 gap を `resolved`、`partially_resolved`、`open` へ再分類し、現行 source/test と PR #339 の状態を根拠として記録する。
4. 未解決事項を実装可能な `tasks/todo/` へ分割し、確認済み事実と proposed requirement を混同しない。
5. canonical docs validator、docs freshness、hidden Unicode、pre-commit、差分検査、GitHub CI を実行する。

### 再統合の受け入れ条件

- [x] R1: PR #343 merge 後の latest main が branch へ統合され、旧 spec-recovery docs root を復活させていない。
- [x] R2: 旧 36 gap / 13 task / 158 AC / 17 scenario / 13 proposed requirement / 22 open question が、基準 commit `9cd904d3` の非規範な履歴監査として保存されている。
- [x] R3: 36 gap すべてに latest main での状態、現行根拠、残余 action があり、改善済み項目を未実装として扱っていない。
- [x] R4: 残余 gap は owner が着手できる `tasks/todo/` と受け入れ条件へ接続され、PR #339 を未検証のまま採用していない。
- [x] R5: current canonical docs に昇格できない proposed/inferred/open question を REQ/ARC/DES/OPS へ混入していない。
- [ ] R6: 適用可能な docs validator/freshness、hidden Unicode、pre-commit、`git diff --check` と final GitHub CI が成功している。
- [ ] R7: PR 本文、`semver:*` label、日本語の受け入れ条件確認、セルフレビュー、task done 更新が final head で完了している。
