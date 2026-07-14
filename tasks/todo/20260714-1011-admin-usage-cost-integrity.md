# 管理 Usage / Cost の真正性と export 境界を実装する

- 状態: todo
- 優先度: P0
- 種別: 実装 / data integrity / security / operations
- 起票日: 2026-07-14
- 参照: `reports/working/admin-ui-audit-202607/30_admin_ui_revalidation_20260714.md`

## 目的

未計測を zero とせず、tenant・subject・run・feature・provider quantity・measurement source・completeness を追跡できる usage event と、versioned pricing に基づく再現可能な cost audit を提供する。PR #339 は candidate として選択移植し、そのまま merge しない。

## 受け入れ条件

- [ ] 各対象実行が tenant-scoped idempotency key を持ち、再送・replay で二重計上されない。
- [ ] provider quantity、tokenizer estimate、missing を分離し、missing を complete zero と表示しない。
- [ ] tenant/subject/run/model/feature/period の帰属不能値は unknown bucket と completeness に現れ、別 tenant へ混入しない。
- [ ] tenant + half-open period の index/query と stable cursor があり、Scan/page 上限で黙って欠落しない。
- [ ] price catalog は version、provider、region、model、unit、effective period、source を持ち、actual/estimate/unpriced を区別する。
- [ ] Usage/Cost UI は period/filter/comparison/detail と source/as-of/completeness を表示し、微小正値を zero と誤表示しない。
- [ ] usage/cost export は read と別 permission、同じ normalized query、scope、audit、redaction、expiry を server で強制する。
- [ ] PR #339 から移植する場合は backfill/dual-read/canary/許容差/rollback を定義し、1,000件超・複数 tenant・複数 price version で検証する。
- [ ] 実 AWS provider usage、DynamoDB query、export storage、approved billing source との live acceptance を実施するか、未実施理由と release blocker を明記する。

## 検証

- store idempotency / pagination / tenant negative integration
- provider missing/estimate/actual と pricing version contract test
- export permission / scope / audit negative test
- migration/backfill/canary reconciliation
- Web empty/loading/error/unavailable/filter/export test
