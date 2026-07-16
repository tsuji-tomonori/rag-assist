# Issue #358: FR-014 UNANSWERABLE policy の fail-closed 化

- 状態: do
- 対象: Issue #358 / FR-014 / AC-FR014-003〜006
- ブランチ: `codex/issue-358-fr014-unanswerable-policy`
- 起点: PR #375 final head `01ff8b75`（PR #369を含む）

## 変更前の矛盾

`sufficient-context-gate.ts` は judge が `UNANSWERABLE` を返しても、question termとretrieved chunkが一致する場合に `answerability.isAnswerable=true`へ上書きし、回答生成へ進める。この経路は「`UNANSWERABLE` の最終回答は refusal」とする `AC-FR014-003` と衝突する。

## 採用する期待動作

- `ANSWERABLE`: 回答生成を許可する。
- `PARTIAL`: primary factが明示的に支持され、primary missing/conflictがなく、既存のbounded deterministic条件をすべて満たす場合だけ回答生成を許可する。
- `UNANSWERABLE`: heuristic / question-anchor / prior answerabilityに関係なく回答生成を許可せず、`NO_ANSWER`、citations空、debug traceにjudge結果を残してfail closedにする。
- 本変更では同じevidenceへの再judgeを実装しない。同一入力の再試行は独立した根拠を増やさず、labelを上書きするだけになるためである。false-refusal回復が必要なら、追加retrievalでevidence setを変えたうえで別iterationとしてjudgeする設計を別scopeで行う。

## 受け入れ条件

- [x] `UNANSWERABLE` はquestion-anchored evidence、supported fact ID、十分なscoreがあっても生成へ進まない。
- [x] `UNANSWERABLE` のupdateは `answerability.isAnswerable=false`、`answer=NO_ANSWER`、`citations=[]` である。
- [x] judgeの `label/confidence/reason/missing/conflict/supportingChunkIds` はstate/debug traceに残る。
- [x] `PARTIAL` の既存primary-supported / secondary-missing継続条件を維持する。
- [x] primary missing/conflicting、irrelevant retrieval、low score、judge malformedはfail closedを維持する。
- [x] full orchestrationで `UNANSWERABLE` 後に `generate_answer` が実行されないことを検証する。
- [x] FR-014正本文書にlabelごとの分岐、再判定なし、将来の追加retrieval境界を明記する。
- [ ] API targeted / full suite、lint、typecheck、docs checks、final-head GitHub Actionsを確認する。
- [x] benchmark期待語句、QA sample固有値、dataset固有分岐をproduct runtimeへ追加しない。
- [ ] 日本語draft PR、AC comment、self-review、task/report lifecycleを完了する。
- [x] merge / deploy / releaseを実施しない。

## 検証結果（PR 作成前）

- targeted node / graph tests: 成功（初回は public debug に raw judge reason が残るという誤った期待で1件失敗。debug redaction 要件に合わせて非漏洩を検証するよう修正後に成功）
- API full suite: 808 tests / 808 pass / 0 fail
- API lint / typecheck: 成功
- API build: `npm run build -w @memorag-mvp/api` 成功（`-w api` は workspace 名不一致で失敗したため修正して再実行）
- source-backed API docs: 97 APIs / 582 documents、生成後 freshness check 成功
- OpenAPI docs / canonical docs / hidden Unicode: 成功
- product runtime source audit: dataset-specific branch 0件
- `git diff --check`: 成功
- `npm ci`: 成功（既存の8 vulnerabilitiesを報告。変更による追加とは確認していない）
- `npm run docs:openapi:check` は sandbox の tsx IPC `EPERM` で実行不可。等価な `node --import tsx src/validate-openapi-docs.ts` を実行して成功。権限昇格は行っていない。

## 検証計画

1. node unitでanchored UNANSWERABLEを明示的にrefusalへ固定する。
2. graph integrationでjudge後にgenerate stepがないことと最終定型refusalを確認する。
3. PARTIAL許可/拒否の既存testを実行して回帰がないことを確認する。
4. API full suite、lint/typecheck、docs freshnessを実行する。sandbox制約で必要な権限昇格は自動実行しない。

## ドキュメント・セキュリティ影響

FR-014要件と回答前guard挙動を同期する。API route / authentication / tenant / permission境界は変更しない。grounding境界は `UNANSWERABLE` を生成へ昇格させない方向へ強化する。
