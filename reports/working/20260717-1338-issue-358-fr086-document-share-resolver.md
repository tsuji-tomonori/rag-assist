# Issue #358 FR-086 document share 監査 resolver 作業レポート

## 受けた指示

Issue #358 の残存 resolver を再確認し、最小の exact mutation resolver を fresh worktree/task から実装・検証し、日本語 Draft stacked PR、semver、受け入れ条件、セルフレビュー、最終 CI、Issue 進捗、clean worktree まで完遂する。merge/deploy/release は行わず、actual AWS 未検証を明記する。

## 要件整理と判断

- PR #405 head までの open stack は membership、resource group update/create/delete、retry/quarantine、application role、folder share を実装済みだった。
- exact `document/share.replace` は既存 open PR と重複せず、tenant/document 単位の S3 grant ledger と既存 cleanup repair outbox だけで authoritative state を解決できるため、残存候補中の最小 rollback unit と判断した。
- proposed state は principal/type/permission の semantic fields、authoritative/completed state は tenant/document/updatedAt を含むため、比較を分離した。
- group downgrade は cleanup repair 必須、user downgrade は inherited permission により cleanup 不要の場合があるため、repair が存在するときだけ exact subset/full 4-target 単位を要求した。
- 共通 audit には full grant ID/created fields がないため before version は再構成せず、audit ID、canonical expected-before、current deny version、exact target 集合を照合した。

## 実施作業・成果物

- `DocumentShareAuditAuthoritativeResolver` と 10 contract tests を追加した。
- exact target/operation、pending success、durable non-success/success、early failure、8 duplicate workers、canonical order、missing/before/third/corrupt/duplicate/cross-boundary、legacy filter、repair identity/version/targets を検証した。
- production reconciliation worker に resolver を登録した。
- reconciliation worker IAM に authorized tenant の per-document prefix と legacy ledger exact key の `s3:GetObject` だけを追加し、List/Put/Delete がないことを infra/static test で固定した。
- FR-086 requirements、requirements coverage、CDK snapshot、生成 infra inventory を同期した。
- grant write、cleanup registration/action、API route/schema、README、OpenAPI は変更していない。

## 検証

- `node --import tsx src/security/document-share-audit-reconciler.test.ts`: 10/10 pass。
- `npm test -w @memorag-mvp/api`: 854/854 pass。
- `npm test -w @memorag-mvp/infra`: 38/38 pass。
- API/infra typecheck: pass。
- `task docs:check`: pass。
- `npm run rag:release:source-audit`: pass。audit ID `sha256:381f6fdd32434d7abeb69e904330d2252db1245c0f2cdde79122eb63292fda2f`、dataset-specific branch 0、artifact mismatch 0。
- `task verify`: lint、全 workspace typecheck/build pass。
- `git diff --check`: pass。
- `pre-commit run`: 7 hooks pass、2 hooks skip（対象ファイルなし）。

修復履歴:

- legacy filter test の proposed fixture が current より 1 principal 多く、resolver が正しく第三状態として拒否したため、test fixture を exact semantic state に修正した。
- CDK snapshot test の期待差分を確認して snapshot を更新し、通常 mode で 38/38 を再実行した。
- IAM snapshot 変更で infra inventory freshness が失敗したため、確認済み generator で 2 生成物を更新し `task docs:check` を再実行した。
- missing-state 追加 test の期待分類を第三状態から current=before に修正し、10/10 と API full を再実行した。

## 指示への fit 評価

- authoritative evidence、tenant/document/principal 境界、revocation cleanup repair、read-only IAM、duplicate convergence、fail closed を自動検証で固定した。
- docs と実装、IAM snapshot/inventory、requirements trace を同一差分で同期した。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を production 実装へ追加していない。
- merge/deploy/release は行っていない。

## 未対応・制約・リスク

- actual AWS S3 read-after-write、EventBridge duplicate delivery、Lambda IAM/runtime は未検証。通常 deploy 後の確認が必要である。
- user-only downgrade で repair がない場合、resolver は producer の inherited effective permission 判断を再計算しない。
- current=before の pending intent は結果を推測せず、bounded retry/quarantine に進み得る。
- legacy ledger read は複数 tenant data を含むため、exact in-process filter を維持する必要がある。
- npm audit は既存 8 vulnerabilities（low 2、moderate 1、high 5）を報告した。依存変更はない。
- Web/Lambda bundle size warning は既存。今回の検証は成功している。
- 残存 resolver は folder move/delete、document move/delete、administrative principal transfer。
- stacked dependency は #386→#389→#391→#394→#399→#401→#405→本PR。

## PR lifecycle

- Draft stacked PR、semver label、AC/self-review、final-head CI、Issue #358 progress は実装 commit 後に追記する。
