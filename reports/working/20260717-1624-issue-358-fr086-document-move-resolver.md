# Issue #358 FR-086 document move 監査 resolver 作業完了レポート

保存先: `reports/working/20260717-1624-issue-358-fr086-document-move-resolver.md`

## 1. 受けた指示

- Issue #358 の PR #415 後続として、重複しない bounded rollback unit を完遂する。
- 専用 worktree / task md / 実装 / 検証 / 日本語 commit / Draft stacked PR / semver / AC / セルフレビュー / report / task done / final-head CI / Issue 進捗更新まで行う。
- merge、deploy、release は行わない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | exact `document/move` authoritative resolver | 高 | 対応 |
| R2 | crash / retry / duplicate / rollback / preflight / corrupt evidence を fail closed に検証 | 高 | 対応 |
| R3 | current identity / tenant / role / source / destination permission を再評価 | 高 | 対応 |
| R4 | domain mutation を再実行せず read-only IAM に限定 | 高 | 対応 |
| R5 | worker / security static policy / infra / FR-086 / coverage を同期 | 高 | 対応 |
| R6 | local 検証、Draft PR、CI、証跡コメント | 高 | implementation CI まで対応。final-head 外部証跡は lifecycle commit 後 |

## 3. 検討・判断の要約

- producer の durable move state と common outbox の順序を確認し、pending success は lifecycle `completed`、durable success は producer が projection 処理後に requested completion を書ける status と current=requested=target の一致に限定した。
- non-success は rollback/conflict の crash window で残り得る lifecycle status、`failureResult`、requested result、current manifest を exact 照合した。
- lifecycle marker がない場合は producer の preflight non-success だけを対象とし、before を保存する current state のみ受理した。
- success 確定時は current actor の active/same-tenant/exact feature と source document / destination folder の full permission を再評価した。
- vector projection 実体の read-by-key contract は worker にないため、durable lifecycle status と requested completion の発行順序を projection 収束証跡とし、resolver から projection を書き戻さない。

## 4. 実施作業

- `DocumentMoveAuditAuthoritativeResolver` と contract test を追加した。
- production reconciliation worker へ exact resolver を登録した。
- document move state と tenant manifest に限定した `s3:GetObject` IAM を追加し、write/list 権限がないことを infra/static test で固定した。
- FR-086 要求、requirements coverage、generated infra inventory、snapshot を同期した。
- targeted から API/infra full、docs、release source audit、`task verify`、root `npm run ci`、pre-commit まで検証した。
- 初回の local test/typecheck で専用 worktree に `node_modules` がないことを確認し、`npm ci` 後に再実行して成功した。`npm ci` は 504 packages をローカルに導入し、npm audit は既存の 8 vulnerabilities を報告した。

## 5. 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/security/document-move-audit-reconciler.ts` | exact document move authoritative resolver |
| `apps/api/src/security/document-move-audit-reconciler.test.ts` | crash/retry/duplicate/rollback/preflight/fail-closed/current authorization test |
| worker / static policy / infra stack / infra test | production 登録と read-only 権限 guard |
| `REQ_FUNCTIONAL_086.md` / requirements coverage | production coverage と残課題の同期 |
| generated infra inventory / snapshot | 生成物の freshness 同期 |
| task md / 本レポート | 受け入れ条件、RCA、検証と完了証跡 |

## 6. 検証結果

- targeted resolver / access-control / requirements coverage: 成功（3 files）
- API full: 878 tests 成功
- Web full: 442 tests 成功
- infra full: 38 tests 成功
- benchmark full: 102 tests 成功
- API / infra typecheck、`task docs:check`、`task verify`、root `npm run ci`: 成功
- release source audit: `sha256:6aae9626b53717dc6f82a063cea1cee25a22dc7fbf84c769d974718ff8847b01`、dataset-specific branch 0、artifact mismatch 0
- pre-commit、`git diff --check`: 成功
- 既存の Web 500 kB 超 chunk / Lambda bundle size 警告は出力されたが exit 0

## 7. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.9/5 | local deliverable、Draft PR、implementation CI、AC/self-review まで充足。final-head 外部証跡は lifecycle commit 後 |
| 制約遵守 | 5.0/5 | dedicated worktree、stacked base、no merge/deploy/release、read-only resolver を遵守 |
| 成果物品質 | 4.8/5 | producer crash window と current authorization を contract test で固定。actual AWS は未検証 |
| 説明責任 | 5.0/5 | RCA、受理状態、制約、残リスクを記録 |
| 検収容易性 | 4.8/5 | AC、検証件数、証跡保存先を明記 |

**総合fit: 4.9 / 5.0（約98%）**

Draft PR、implementation head CI、AC/self-review evidence は完了した。task done/report lifecycle commit後のfinal-head CIと最終コメントはheadを変えない外部証跡として記録する。

## 8. 未対応・制約・リスク

- actual AWS S3/DynamoDB/Cognito/EventBridge/Lambda は未検証。deploy 前の production account 検証が必要。
- vector projection 実体は worker から再読込しない。durable lifecycle/requested completion と producer の発行順序が収束証跡である。
- valid move 後の後続 mutation が current manifest を変更した場合、過去結果を推測せず retry/quarantine する可能性がある。
- document delete resolver と administrative principal transfer resolver は Issue #358 の後続 rollback unit。
- merge、deploy、release は対象外のため未実施。

## 9. PR lifecycle

- Draft stacked PR: [#419](https://github.com/tsuji-tomonori/rag-assist/pull/419)。base は PR #415 branch、head は本 task branch、`semver:patch`。
- 受け入れ条件確認: [issuecomment-5000168708](https://github.com/tsuji-tomonori/rag-assist/pull/419#issuecomment-5000168708)。implementation CI 前の pending を過大主張せず記録した。
- PR 作成時セルフレビュー: [issuecomment-5000169661](https://github.com/tsuji-tomonori/rag-assist/pull/419#issuecomment-5000169661)。blocking なし、actual AWS/projection readback 制約を記録した。
- implementation CI evidence: [issuecomment-5000241342](https://github.com/tsuji-tomonori/rag-assist/pull/419#issuecomment-5000241342)。MemoRAG CI run `29563201176` success（8分15秒）。
- task done/report lifecycle commit後のfinal-head CI、最終セルフレビュー、AC最終判定、Issue #358進捗は、headを変えないPR/Issueコメントと最終回答に記録する。
