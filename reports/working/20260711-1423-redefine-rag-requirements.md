# 認可・文書共有・RAG 要件再定義 作業完了レポート

- 作成日時: 2026-07-11 14:23 JST
- branch: `codex/redefine-rag-requirements`
- base: `origin/main` (`e8ae57f6126aca802d85042a1697d07c836b3603`)
- task: `tasks/done/20260711-1148-redefine-rag-requirements.md`

## 受けた指示

現行実装の品質、特に権限・文書共有・RAG を見直し、現行コードと `.workspace/rag-engineering-guide.pdf` を根拠に、SWEBOK v4 の要求工学観点で要件を再定義する。repository の Worktree Task PR Flow に従い、task、検証、レポート、commit、main 向け draft PR、日本語コメントまで進める。

## 要件整理と判断

- 現行コードは current-state evidence とし、target requirement の正解そのものにはしなかった。
- RAG ガイド 2026-07 版（243 pages、SHA-256 `7f887309fc92ec2046e4f4b62ff0de2d3c6f2a61c790b397bca2b73c446e7103`）の PDF pp.59–208 と、SWEBOK v4.0a September 2025（411 pages、SHA-256 `b3cb8028fecb9607f757504c861947fa3bf423087ea8bf08c58020f0ba3596dc`）Chapter 1 の PDF pp.44–62 を主要根拠にした。
- `confirmed`、`inferred`、`conflict`、`open_question` を分け、未承認の SLO、品質閾値、tenant/audience 方針を架空値で確定しなかった。
- 旧複合要求 `FR-041`, `FR-052`, `NFR-011` は履歴を保持して Superseded とし、legacy AC 単位で置換先を記録した。
- 認可判定と response minimization、属性継承と chunking、release gate と production monitoring を別の原子的要求に分けた。

## 実施作業

- `FR-056`–`FR-093` と `SQ-005`–`SQ-015` の正本要求を整備し、各要件へ属性、BDD AC、妥当性確認、前方・後方 trace を記載した。
- 認可では verified identity、account/tenant/role、資源操作 3×7 行列、owner/adminPrincipal 優先順位、resource-group membership、共有 concurrency、state-audit 不可分確定、非列挙 response、長時間処理の current reauthorization を定義した。
- 共有では document/folder/resource-group の enabled/unsupported 操作、read-only 利用、deny-first 失効、document/folder move の path/policy/index coherence を定義した。
- RAG では source admission、loss-aware extraction、versioned structure-aware chunking、派生 security/classification/usage/quality reference、全 retrieval path の current eligibility、prompt injection、index cutover、evidence/citation、fenced ingest recovery、工程別 promotion、本番 drift monitoring、safe degradation を定義した。
- `docs/spec-recovery/13`–`17` と既存 facts/tasks/AC/E2E/REQ/SPEC/trace/gap/open-question artifacts、baseline、索引、変更管理を同期した。
- validator を、必須成果物、1宣言1ファイル、属性/AC、CSV title/status/AC、repo-relative evidence path、Open Question 逆参照、FR-041 disposition、E2E/gap/placeholder を検査するよう強化し、負例 regression test を追加した。
- 独立監査を二巡行い、初回の blocking/high 指摘と、修正後再監査の認可6件・RAG7件を修正した。再確認では対象 blocking/high の残存なしと判定された。

## 成果物

- `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/**/REQ_FUNCTIONAL_056.md`–`REQ_FUNCTIONAL_093.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/11_サービス品質制約_SERVICE_QUALITY/REQ_SERVICE_QUALITY_005.md`–`REQ_SERVICE_QUALITY_015.md`
- `docs/spec-recovery/13_requirements_redefinition_202607.md`–`17_traceability_matrix_202607.csv`
- `scripts/validate_spec_recovery.py`
- `scripts/test_validate_spec_recovery.py`
- `apps/api/src/rag/requirements-coverage.test.ts`

## 検証結果

次を実行し、最終実行はすべて pass した。

- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/test_validate_spec_recovery.py`（4 tests）
- `node --import /home/t-tsuji/project/rag-assist/node_modules/tsx/dist/loader.mjs --test src/rag/requirements-coverage.test.ts`（1 test）
- `/home/t-tsuji/project/rag-assist/node_modules/.bin/eslint apps/api/src/rag/requirements-coverage.test.ts --max-warnings=0`
- `/home/t-tsuji/project/rag-assist/node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`
- `uv run ruff check scripts/validate_spec_recovery.py scripts/test_validate_spec_recovery.py`
- `uv run ruff format --check scripts/validate_spec_recovery.py scripts/test_validate_spec_recovery.py`
- `node scripts/check-hidden-unicode.mjs docs reports tasks scripts apps/api/src/rag/requirements-coverage.test.ts`
- `uv run pre-commit run --files <staged-files>`（git-secrets、hidden Unicode、whitespace、EOF、large-file、merge-conflict、debug-statement、mixed-line-ending checks）
- `git diff --cached --check`

検証中、`npm exec tsx --test` は sandbox の IPC 制約で実行前に失敗したため、同じ TypeScript test を Node の `tsx` loader で実行して pass を確認した。`pre-commit` の初回 sandbox 実行は read-only の `uv` cache により失敗したため、解決コマンドと対象 staged files を確認して権限委譲後に再実行し、全 check の pass を確認した。validator は missing baseline、short CSV、duplicate ID、AC/title mismatch、invalid status、missing evidence path、Open Question 逆参照欠落の負例を test している。

Taskfile の docs target は OpenAPI 生成/差分と infra inventory 用であり、今回変更していない runtime OpenAPI/infra には適用しなかった。AWS integration、2 tenant/2 user browser E2E、負荷/chaos、本番 monitoring は要求として定義したが、本タスクでは実行していない。

## 指示への fit 評価

- 入力根拠と target requirement を分離: fit
- 権限・文書共有の許可/拒否条件と認可境界: fit
- RAG lifecycle、品質、安全性、評価、監視: fit
- SWEBOK-lite の原子性、属性、AC、妥当性、trace: fit
- 未確定値の明示と現行 gap の非追認: fit
- runtime 実装を行わない scope: fit

## 未対応・制約・リスク

- 要求は Draft であり、`OQ-RD-001`–`OQ-RD-012`、`Q-001`–`Q-009` の relevant decisions と `SQ-006`–`SQ-015` の閾値は stakeholder 承認待ちである。
- current code は複数の critical/high gap を持つ。本文作成だけで認可漏えい、失効遅延、RAG 品質問題が実装修正されたとは扱わない。
- 本タスクは docs/test-validator 更新であり、API/Web/infra の runtime behavior は変更していない。そのため implementation docs は target design へ更新せず、必要な後続更新先を gap analysis に記録した。
- GitHub Apps で main 向け Draft PR を作成し、`semver:patch` label、受け入れ条件確認、セルフレビュー、publication 完了追記を反映した。task は全受け入れ条件の確認後に `tasks/done/` へ移動した。

## Publication

- Draft PR: `https://github.com/tsuji-tomonori/rag-assist/pull/340`
- label: `semver:patch`
- 受け入れ条件確認コメント: 投稿済み（comment ID `4942892144`）
- セルフレビューコメント: 投稿済み（comment ID `4942894371`）
- publication 完了追記: 投稿済み（comment ID `4942897242`）
