# Issue #358: FR-086 bounded retry / quarantine / poison isolation

- 状態: done
- 対象: Issue #358 / FR-086 / security mutation audit reconciliation operations
- ブランチ: `codex/issue-358-fr086-retry-quarantine`
- 起点: PR #394 lifecycle head `0d3b705d`

## 変更前の gap

production reconciliationは各authoritative resolverでcrash後intentを収束できるが、同じintentが恒久的に解決不能な場合のdurable retry上限・quarantine・運用証跡が未成立である。poison intentがtenant batch全体の後続intentを妨げず、未収束状態を成功へ誤変換しない契約が必要である。

## 受け入れ条件

- [x] resolver失敗をintent単位のdurable attempt evidenceとして記録し、設定した有限上限を超えるまでだけ自動再試行する。
- [x] attempt evidenceはtenant/intent/target/operationと一致し、cross-tenant・corrupt・stale evidenceをfail closedに扱う。
- [x] 上限到達intentをdurable quarantineへ移し、pending/successへ誤変換せず、理由はraw infrastructure detailを漏らさない安全な分類として保存する。
- [x] quarantine済みintentは通常batchで再実行せず、未解決・要運用対応として可観測にする。
- [x] 1件のresolver throw/quarantineが同一tenant batchの別intentを止めず、正常intentは同じrunで収束する。
- [x] duplicate workerでもattempt count/quarantine transition/audit completionをCASまたは同等のatomic boundaryで一意に収束させる。
- [x] resolver未登録intentは無限再試行せず同じbounded contractへ入る。
- [x] production worker設定、最小権限IAM、static policy、infra snapshot/inventory、FR-086 docs/coverageを必要範囲で同期する。
- [x] normal/negative/duplicate/partial/cross-tenant/corrupt/poison isolationの自動テストとfull regression、lint/typecheck/build/docs/source auditを完了する。
- [x] 日本語draft PR、semver、AC/self-review、task/report lifecycle、final-head CI、Issue #358進捗、clean/upstreamを完了する。
- [x] merge / deploy / releaseを実施しない。

## 実施計画

1. 現行outbox/reconciler/workerの永続化・batch境界を確認し、既存schema互換の最小durable retry modelを決める。
2. attempt/quarantineのatomic transitionとsafe reason、poison isolationを実装する。
3. production wiring/IAM/docs/coverage/generated artifactsを同期する。
4. selected/full検証とrepair loopを完了する。
5. draft PR lifecycleとfinal-head CI/Issue進捗まで完了する。

## Done条件

成果物と検証がfinal PR headに揃い、quarantine解除/手動再投入など後続運用が残る場合は未実装として明記し、Issue #358全体を完了扱いにしないこと。

## 完了証跡

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/399
- initial-head MemoRAG CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29547370000
- 受け入れ条件: https://github.com/tsuji-tomonori/rag-assist/pull/399#issuecomment-4998125479
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/399#issuecomment-4998127131
- local API full coverage: 828 / 828成功、statement/line 90.48%
- final-head CIは本task/report lifecycle commit後に確認し、PRコメントとIssue #358へ記録する。
