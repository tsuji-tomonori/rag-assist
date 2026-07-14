# 追加要件の live operational acceptance

- 保存先: `tasks/todo/20260714-0104-full-requirements-operational-acceptance.md`
- 状態: todo
- タスク種別: 運用検証

## 背景

`tasks/do/20260711-1518-full-requirements-implementation.md` で `FR-056`–`FR-093`、`SQ-005`–`SQ-015` の repository implementation と local/CI acceptance を整備している。一方、外部環境、stakeholder 承認値、実 workload を必要とする運用受け入れは、未取得の evidence を合格扱いにしないため本タスクへ分離する。

## 対象範囲

- `FR-066`: AWS registry backfill、deny-first cleanup convergence、残存 artifact の確認
- `FR-093`: live notification、drift detection、safe action、rollback drill
- `SQ-005`–`SQ-015`: 承認済み dataset、threshold、window、owner、workload、price catalog、load/chaos/cost/billing evidence
- production profile/version/slice と observation provenance の一致確認

## 受け入れ条件

- [ ] stakeholder が承認した quality policy profile に dataset、全必須 threshold、measurement window、alert owner、workload profile、price catalog version が明記されている。
- [ ] non-production または明示承認済み環境で registry backfill と cleanup convergence を実行し、cross-tenant leakage、失効後の取得、stale worker commit がないことを evidence で確認している。
- [ ] notification、critical drift、promotion freeze、candidate/document quarantine、limited/refuse、last-known-safe rollback の drill を行い、alert・action・runtime safety state を相関できる。
- [ ] representative workload で stage/slice 別 latency、eligibility propagation、availability/backlog/recovery、quality/security signal を測定し、missing/unavailable を green にしない。
- [ ] load/chaos と billing 照合を実施し、versioned price catalog による component/total unit cost と実請求差分を説明できる。
- [ ] 実施環境、時刻、profile/version、artifact path、承認者、結果、未達項目を作業レポートと要件別 evidence 台帳へ記録している。
- [ ] production deploy、migration、rollback などの外部状態変更は、実行直前に明示確認を得ている。

## 検証上の注意

- repository-local test、CDK synth、mock adapter の成功を live operational evidence として代用しない。
- 未承認 threshold、欠損 signal、推定 billing 値を pass 値として補完しない。
- 本タスク着手時は対象環境と変更権限を再確認する。
