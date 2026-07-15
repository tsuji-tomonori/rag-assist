# 管理 Usage / Cost 真正性・export 境界 作業レポート

## 受けた指示

GitHub Issue #345 の全体完了へ向け、管理 UI の Usage / Cost に残る真正性、集計、価格再現性、export 認可、運用 rollout の gap を stacked milestone として実装・検証し、task / commit / draft PR lifecycle まで進める。

## 要件整理

- missing と complete zero、provider actual と tokenizer estimate、unpriced を混同しない。
- tenant、subject、run、model、feature、half-open period の帰属と completeness を保持する。
- tenant-scoped idempotency と stable cursor により、再送時の二重計上や page 上限での黙った欠落を防ぐ。
- versioned pricing により cost を再現し、source / effective period / region / unit を追跡する。
- usage / cost export は read とは別 permission とし、normalized query、tenant scope、audit、redaction、expiry を server で強制する。
- production は live reconciliation 完了まで `shadow` を既定にし、未計測値を実績として表示しない。

## 検討・判断

- PR #339 の考え方を参照したが、現行 stacked branch の access-control kernel、audit outbox、generated docs、Web state contract に合わせて再実装した。旧差分の直接 merge や dual-read は行っていない。
- 新規 UsageEvent table と tenant-period GSI を正本にしたため、既存データの backfill は不要と判断した。production rollout は `disabled -> shadow -> active` の段階制御とし、live billing reconciliation を active 化の release gate にした。
- provider quantity がない場合は estimate または missing として明示し、価格が存在しない quantity は `unpriced` と completeness に残す。
- README の公開導線変更はなく更新不要と判断した。正規 REQ / DES / OPS、OpenAPI、API-code / Web / infra inventory は更新した。`docs/DOCS_STRUCTURE.md` はリポジトリに存在しないため、既存 SWEBOK-lite 配置へ合わせた。

## 実施作業

- usage event schema、in-memory / object / DynamoDB store、tenant-period query、stable cursor、1,000 件超 pagination test を追加した。
- Bedrock / ingest の measurement source と stable idempotency を MemoRagService へ接続した。
- versioned pricing catalog と actual / estimate / unpriced cost 集計を追加した。
- Usage / Cost read/export route、専用 permission、audit、expiry、OpenAPI schema を追加した。
- Usage / Cost panel を period / filter / comparison / detail / source / as-of / completeness 表示へ接続し、loading / empty / error / unavailable / denied を検証した。
- CDK に UsageEvent table、GSI、環境変数、IAM grant、accounting mode を追加し、production 既定を `shadow` にした。
- 正規 docs、rollout runbook、OpenAPI、API-code、Web inventory、infra inventory、traceability を同期した。

## 成果物

- API / store / pricing / export / infra 実装と negative / fault / scale test
- Usage / Cost Web UI と component / hook / API test
- `docs/4_運用_OPS/31_利用量_USAGE/OPS_USAGE_001.md`
- 更新済み REQ / DES / generated docs / infra snapshot
- task: `tasks/done/20260714-1011-admin-usage-cost-integrity.md`

## 検証結果

- `npm run test:coverage -w @memorag-mvp/api`: 成功、801 / 801、Statements / Lines 90.44%、Branches 80.44%、Functions 92.89%。
- `npm run test:coverage -w @memorag-mvp/web`: 成功、423 tests、Statements 90.43%、Branches 85.29%、Functions 90.07%、Lines 93.26%。
- `npm run test -w @memorag-mvp/infra`: 成功、5 / 5。
- `task docs:check`: 成功。OpenAPI、97 APIs / 582 API documents、Web / infra inventory freshness を含む。
- `npm run lint`: 成功。
- `npm run typecheck`: 全 workspace 成功。
- `npm run build`: 全 workspace 成功。Vite と Lambda bundle の size warning は残るが build failure ではない。
- API full coverage 内で security access-control policy、HTTP contract、runtime layout を含む test が成功した。

## 指示への fit 評価

automated acceptance は満たした。架空の usage / cost fallback は追加せず、unknown / missing / shadow を利用者へ正直に表示する。export は通常 read permission から分離し、tenant 境界と audit を弱めていない。benchmark 期待語句、QA sample 固有値、dataset 固有分岐は実装へ追加していない。

## 未対応・制約・リスク

- 実 AWS provider usage、実 DynamoDB query、export storage、approved billing source との live acceptance は、この worktree から production credential / billing source /承認済み許容差へアクセスできないため未実施。production `active` 化の release blocker とする。
- shadow と approved billing source の照合許容差は FinOps / owner の決定待ちであり、固定値を捏造していない。
- production deploy、migration、backfill、merge は実施していない。
- Vite の 500 kB 超 chunk と Lambda bundle size warning は既存を含む非 blocking warning として残る。
