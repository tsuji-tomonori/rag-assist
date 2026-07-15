# 管理 Usage / Cost の真正性と export 境界を実装する

- 状態: in_progress
- 優先度: P0
- 種別: 実装 / data integrity / security / operations
- 起票日: 2026-07-14
- 参照: `reports/working/admin-ui-audit-202607/30_admin_ui_revalidation_20260714.md`

## 目的

未計測を zero とせず、tenant・subject・run・feature・provider quantity・measurement source・completeness を追跡できる usage event と、versioned pricing に基づく再現可能な cost audit を提供する。PR #339 は candidate として選択移植し、そのまま merge しない。

## 作業前チェックリスト

- [x] 現行 usage/cost producer、store、query、pricing、export、audit の正本と欠落境界を特定する。
- [x] PR #339 の差分を current stack と比較し、安全に再利用できる要素だけを選別する。
- [x] route permission、tenant/subject 境界、export 専用 permission、redaction/expiry/static policy への影響を確認する。
- [x] usage/cost UI の query/state/formatting と、unknown/missing/completeness の表示経路を受け入れ条件へ trace する。
- [x] 正規 docs/generated docs/README/runbook/infra と最小十分な test matrix の更新要否を決める。

## Done 条件

- [x] 下記受け入れ条件が API/Web/store の実挙動と自動 test で満たされる。
- [x] tenant-scoped idempotency、stable pagination、unknown/missing、versioned pricing、export 境界を negative/fault test で検証する。
- [x] 1,000 件超・複数 tenant・複数 price version と migration/backfill/reconciliation の適用要否を検証・記録する。
- [x] lint、typecheck、関連/full test、build、docs/generated freshness、security policy test が成功する。
- [x] live AWS/provider/billing acceptance の未実施項目を達成扱いにせず、release blocker/残余リスクを report/PR に記録する。
- [ ] 日本語 commit、stacked draft PR、受け入れ条件コメント、セルフレビュー、作業レポート、task の `done` 移動と lifecycle push が完了する。

## 実行計画

1. current stack と PR #339 から usage/cost data flow、schema、security/export gap を復元する。
2. event/store/query/pricing/export の integrity boundary を API/infra/contract へ実装する。
3. period/filter/comparison/detail/completeness state を Web へ接続する。
4. scale/tenant/version/fault/security/UI test と full quality gate を実行し、失敗を修復する。

## ドキュメントメンテナンス計画

関連 FR、data/API/security/operations/UI design、OpenAPI、API-code/Web/infra inventory、traceability を実装と同期する。README/deploy/runbook は公開設定・migration・運用手順の変更有無で再判定する。

## 受け入れ条件

- [x] 各対象実行が tenant-scoped idempotency key を持ち、再送・replay で二重計上されない。
- [x] provider quantity、tokenizer estimate、missing を分離し、missing を complete zero と表示しない。
- [x] tenant/subject/run/model/feature/period の帰属不能値は unknown bucket と completeness に現れ、別 tenant へ混入しない。
- [x] tenant + half-open period の index/query と stable cursor があり、Scan/page 上限で黙って欠落しない。
- [x] price catalog は version、provider、region、model、unit、effective period、source を持ち、actual/estimate/unpriced を区別する。
- [x] Usage/Cost UI は period/filter/comparison/detail と source/as-of/completeness を表示し、微小正値を zero と誤表示しない。
- [x] usage/cost export は read と別 permission、同じ normalized query、scope、audit、redaction、expiry を server で強制する。
- [x] PR #339 から移植する場合は backfill/dual-read/canary/許容差/rollback を定義し、1,000件超・複数 tenant・複数 price version で検証する。
- [x] 実 AWS provider usage、DynamoDB query、export storage、approved billing source との live acceptance を実施するか、未実施理由と release blocker を明記する。

## 検証

- store idempotency / pagination / tenant negative integration
- provider missing/estimate/actual と pricing version contract test
- export permission / scope / audit negative test
- migration/backfill/canary reconciliation
- Web empty/loading/error/unavailable/filter/export test
