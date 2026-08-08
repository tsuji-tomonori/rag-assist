# Issue #358 FR-014 UNANSWERABLE policy 作業レポート

## 受けた指示

GitHub Issue #358 を解決へ進める一環として、FR-014 の `UNANSWERABLE` 判定と既存 heuristic の矛盾を解消し、実装・検証・日本語 draft PR・セルフレビューまで完遂する。merge / deploy / release は行わない。

## 要件整理と判断

- `ANSWERABLE` は回答生成を許可する。
- `PARTIAL` は primary fact が根拠で支持され、primary missing/conflict がない既存の bounded 条件を満たす場合だけ許可する。
- `UNANSWERABLE` は question anchor や prior heuristic によって昇格させず、回答不能・引用0件で fail closed にする。
- 同一 evidence への再judgeは拒否を記録上書きするだけになるため行わない。将来の false-refusal 回復は、追加 retrieval で evidence set を変えた bounded iteration として別途設計する。
- public debug は既存の機微情報 redaction を維持し、raw reason を漏らさない。judge の完全な結果は内部 state に保持する。

## 実施作業と成果物

- `sufficient-context-gate.ts` から `UNANSWERABLE` の grounded-evidence override を除去した。
- node unit と full graph integration に、anchored evidence があっても `UNANSWERABLE` を拒否し、`generate_answer` を実行しない回帰テストを追加・更新した。
- FR-014 正本文書へ AC-FR014-007〜009、同一 evidence 再判定禁止、将来 iteration 境界を追記した。
- graph test 追加に伴う source-backed API docs を再生成した。
- task: `tasks/done/20260717-issue-358-fr014-unanswerable-policy.md`

## 検証

- targeted node / graph tests: 成功。初回は public debug に raw reason が存在するという誤った期待で失敗し、既存 redaction 境界に合わせて非漏洩検証へ修正後に再成功。
- API full suite: 808 / 808 成功。
- API lint、typecheck、`npm run build -w @memorag-mvp/api`: 成功。
- source-backed API docs freshness: 成功。
- OpenAPI docs、canonical docs、hidden Unicode: 成功。
- product runtime source audit: dataset-specific branch 0件。
- `git diff --check`: 成功。
- `npm ci`: 成功。既存8 vulnerabilitiesを報告。
- `npm run docs:openapi:check` は旧sandboxで tsx IPC `EPERM` となったため、当時は権限昇格せず等価な `node --import tsx src/validate-openapi-docs.ts` を実行して成功した。
- `npm run build -w api` は旧実行時にworkspace名不一致で失敗し、正しい `@memorag-mvp/api` で再実行して成功した。

## 2026-07-26 current main 収束

- FR-025を含む `main@0771521c` から `integration/issue-358-fr014-main-convergence` を作成した。
- 旧stackからFR-014固有の実装commit `5234b76a` とlifecycle commit `7cbd453f`だけを適用した。
- source conflictは発生せず、generated API docsはcurrent sourceから正規generatorで再生成した。
- 一時収束workflow run `30192587726` で、最新mainへのreset、2 commitのcherry-pick、`npm ci`、OpenAPI/API-code再生成、root `npm run ci`、docs freshness、hidden Unicode、source audit、`git diff --check`がすべて成功した。
- 収束後のPR #467は11ファイルに限定され、実装・テスト・FR-014正本文書・生成文書・task/report以外を変更していない。
- 一時workflowを含むcontrol historyはforce-with-leaseで置換され、収束headは `8cd9c364` となった。
- 本追記commit後の通常PR CIを最終merge判定に使用する。

## 指示への fit 評価

FR-014 の正本文書、実装、unit/integration test を同期し、grounding 境界を弱めず `UNANSWERABLE` を fail closed にした。benchmark期待語句、QA sample 固有値、dataset 固有分岐は product runtime に追加していない。

## 未対応・制約・リスク

- 旧実装はstacked base上で作成されたが、2026-07-26にFR-014固有2commitだけをcurrent mainへ再適用し、取り込み順依存を解消した。
- false-refusal回復の追加retrieval iterationは本変更の対象外である。
- actual Bedrockを使った手動確認は未実施であり、deterministic testとCI成功を実サービス確認の代替とは扱わない。
- deploy / releaseは本PRでは実施しない。
