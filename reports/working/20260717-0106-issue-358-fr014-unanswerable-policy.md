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
- graph test 追加に伴う source-backed API docs（97 APIs / 582 documents）を再生成した。
- task: `tasks/do/20260717-issue-358-fr014-unanswerable-policy.md`

## 検証

- targeted node / graph tests: 成功。初回は public debug に raw reason が存在するという誤った期待で失敗し、既存 redaction 境界に合わせて非漏洩検証へ修正後に再成功。
- API full suite: 808 / 808 成功。
- API lint、typecheck、`npm run build -w @memorag-mvp/api`: 成功。
- source-backed API docs freshness: 97 APIs / 582 documents、成功。
- OpenAPI docs、canonical docs、hidden Unicode: 成功。
- product runtime source audit: dataset-specific branch 0件。
- `git diff --check`: 成功。
- `npm ci`: 成功。既存8 vulnerabilitiesを報告。
- `npm run docs:openapi:check` は sandbox の tsx IPC `EPERM` で失敗したため、権限昇格せず等価な `node --import tsx src/validate-openapi-docs.ts` を実行し成功。
- `npm run build -w api` は workspace 名不一致で失敗。正しい `@memorag-mvp/api` で再実行し成功。
- GitHub Actions final-head CI は PR lifecycle 後に確認するため、本レポート作成時点では未実施。

## 指示への fit 評価

FR-014 の正本文書、実装、unit/integration test を同期し、grounding 境界を弱めず `UNANSWERABLE` を fail closed にした。benchmark期待語句、QA sample 固有値、dataset 固有分岐は product runtime に追加していない。

## 未対応・制約・リスク

- 変更は stacked base（PR #375、PR #369、PR #365を含む）上で作成しており、取り込み順の管理が必要。
- draft PR #384を作成し、acceptance commentとself-review commentを投稿した。GitHub Appsは繰り返しタイムアウトしたため、`gh`へフォールバックした。
- taskを`done`へ移動する lifecycle commit後の final-head CI は、PR top-level commentで外部証跡として記録する。
- merge / deploy / release は実施しない。
