# Issue #358 FR-086 folder delete 監査 resolver 作業レポート

## 1. 受けた指示

Issue #358 の次の非重複単位として exact `folder/delete` security mutation audit resolver を PR #412 final branch に積み、fresh worktree/task、RCA、実装、検証、FR-086/coverage/report 同期、日本語 gitmoji commit、Draft stacked PR、semver、AC/self-review、final-head CI、Issue 進捗まで完遂する。document move/delete、administrative principal transfer、merge/deploy/release は行わず、actual AWS 未検証を正直に記載する。

## 2. 要件整理と判断

| 要件 | 対応 |
| --- | --- |
| exact `folder/delete` のみsupport | `FolderDeleteAuditAuthoritativeResolver.supports` でtarget/operationを完全一致 |
| success crash windowの収束 | current DocumentGroupがexact proposed archiveと一致するpendingだけsuccess |
| durable resultの保持 | successはproposed、non-successはbeforeとrequested/currentが完全一致する場合だけ確定 |
| fail closed | pending before、第三状態、missing/corrupt/cross-tenant、invalid transition/policyを推測しない |
| read-only / least privilege | `DocumentGroupStore.get` だけを使い、既存DynamoDB `GetItem/Query` IAMのみ。S3/List/write追加なし |
| 非重複範囲 | folder archive producer、document move/delete、admin transferは変更しない |

producer を再監査した結果、folder delete は move と異なり専用 lifecycle marker を持たず、common outbox の durable `requestedCompletion` と DocumentGroups の CAS archive が回復証跡だった。producer に存在しない cleanup marker を resolver が要求または作成するのは不正確なため、本単位は audit 収束だけを read-only で扱う。

## 3. 実施作業

- PR #412 final SHA `4c2acab291167a36a621bf37a02b97293586ba1b` から専用 worktree/branch を作成した。
- `tasks/do/20260717-1513-issue-358-fr086-folder-delete-resolver.md` に事実、推定、open question、RCA、受け入れ条件を実装前に記録した。
- exact resolver と6件のcontract testを追加し、production workerへ登録した。
- canonical tenant/folder/path/status/timestamp、active→archived transition、policy version、early proposalを検証した。
- static access-control policy に exact registry/read-only/no-mutation guard を追加した。
- FR-086 production coverage と requirements coverage を同期した。route/OpenAPI/UI/README/operations/IAM は挙動・権限に変更がないため更新していない。

## 4. 成果物

| 成果物 | 内容 |
| --- | --- |
| `apps/api/src/security/folder-delete-audit-reconciler.ts` | exact authoritative resolver |
| `apps/api/src/security/folder-delete-audit-reconciler.test.ts` | success/non-success/crash/duplicate/fail-closed contract |
| worker/static policy/requirements coverage | production wiring、no-mutation guard、traceability |
| `REQ_FUNCTIONAL_086.md` | folder/delete production reconciliation coverage |
| task/report | RCA、AC、検証、制約の記録 |

## 5. 検証結果

- resolver direct: 6/6 pass。
- API full: 871/871 pass。
- infra full: 38/38 pass。
- API/infra typecheck: pass。
- `task docs:check`: pass。97 API / 582 generated API docs、Web/infra inventory freshnessを含む。
- `npm run rag:release:source-audit`: pass。audit ID `sha256:3c83f691c53c24b0d9717b2ea63dee18820176f87d42ffeb5a964d18d2d7e016`、dataset-specific branch 0、artifact manifest mismatch 0。
- `task verify`: lint、全workspace typecheck/build pass。既存のWeb chunk/Lambda bundle size warningのみ。
- `git diff --check`: pass。
- `pre-commit run`: 7 hooks pass、2 hooks skip（対象ファイルなし）。implementation/final-head CI は PR lifecycle で実施する。

## 6. セキュリティ・認可レビュー

- API route、request/response schema、public endpointの追加・変更はない。
- worker event の authorized tenant 一致 guard は維持し、resolver は`groups.get(tenantId, targetId)`のexact keyだけを読む。
- archive、path lock、folder policy、cleanup、permissionをresolverから更新しない。
- before/afterはproducerと同じ非機密のfolder identity/path/status/timestampに限定し、document body/token/policy entryを新規保存しない。
- RAG retrieval/citation/refusal、benchmark logicは変更していない。dataset/QA固有の分岐や期待値をproduction実装へ追加していない。

## 7. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
| --- | ---: | --- |
| 指示網羅性 | 4.5/5 | exact unit、RCA、実装、local検証、docs/reportまで対応。PR/CI lifecycleはこれから |
| 制約遵守 | 5/5 | 対象外のdocument/admin操作やmerge/deploy/releaseを実施せず、cleanup欠落も過大主張しない |
| 成果物品質 | 4.5/5 | exact/canonical/fail-closed/read-onlyを自動testで固定。actual AWSは未検証 |
| 説明責任 | 5/5 | confirmed/inferred/open、失敗と修正、residual riskを区別 |
| 検収容易性 | 4.5/5 | task AC、test数、差分、reportを相互参照可能に整理 |

**総合fit: 4.7/5（約94%）**

Draft PR、GitHub CI、AC/self-review/final-head evidence が完了した後に lifecycle を更新する。actual AWSおよびarchive cleanup registrationは本単位の未解決リスクのため満点としない。

## 8. 未対応・制約・リスク

- actual AWS DynamoDB/EventBridge/Lambda、duplicate delivery、read visibility は未検証。
- folder archive producer は cached/session/queued authorization cleanup repair/ledger を登録しない。resolver は cleanup 完了を主張せず、後続 producer hardening が必要。
- pending before で durable result がない場合、結果 class を推測できないため bounded retry/quarantine へ進む。
- document move/delete、administrative principal transfer resolver は Issue #358 の後続単位。
- merge、deploy、releaseは実施しない。

## 9. PR lifecycle

- Draft stacked PR、semver label、日本語AC/self-review、implementation/final-head CI、Issue #358 進捗はPR作成後に追記する。
