# Issue #358 FR-019 faithfulness / context relevance pipeline

- 状態: do
- タスク種別: benchmark 品質指標
- 作成日: 2026-07-17
- 起点: PR #406 final head `e9f2c4d1`
- branch: `codex/issue-358-fr019-context-quality`
- 関連要件: `FR-019`, `SQ-001`, `SQ-010`

## 背景・目的

Issue #358 P1-B は benchmark summary に `faithfulness` / `context_relevance` を追加し、production RAG observation producer まで値を伝播することを求める。current code は versioned case artifact から faithfulness を導出して run metrics / producer へ渡す経路を既に持つが、runner summary / report は値を出力せず、context relevance は pipeline に未定義である。

本タスクでは、評価可能な row evidence だけから両指標を算出し、証拠不足・分母0を `null` / unavailable のまま保持する。owner 未承認 threshold は追加しない。

## 実装チェックリスト

- [x] current row evaluation、summary/report、case artifact、persistence、schema/type、producer の境界を確認する。
- [x] faithfulness の分子・分母と evidence completeness を定義する。
- [x] context relevance の relevant retrieved context / evaluated retrieved context と evidence completeness を定義する。
- [x] summary JSON、case artifact、Markdown report、turn dependency への適用範囲を決めて実装する。
- [x] persistence / shared contract / production observation producer を欠損・invalid fail-closed で同期する。
- [x] normal / zero / null / invalid / propagation の contract tests を追加する。
- [x] FR-019 / SQ-001 / SQ-010 / benchmark DLD / requirements coverage を同期する。
- [ ] selected/full validation、Draft stacked PR、AC/self-review、task/report、final-head CI、Issue #358 進捗まで完遂する。

## 受け入れ条件

- [x] summary は評価可能な claim/support evidence から `faithfulness` を算出する。
- [x] summary は expected file/document と retrieved context の対応から `contextRelevance` を算出する。
- [x] evidence 不足・評価対象0件は `null` / unavailable であり、0またはpassへ誤変換しない。
- [x] Markdown report は両指標の evaluated / not applicable と分子・分母を区別する。
- [x] versioned case artifact から run metrics と producer の diagnostic source sample へ値が伝播する。
- [x] invalid/non-finite/self-reported-only 値を信頼して品質 signal にしない。
- [x] owner 未承認 threshold を default profile へ追加せず、欠損 metric をgate passにしない。
- [x] RAG 根拠性・認可・tenant 境界を後退させない。
- [x] benchmark期待語句、QA sample、dataset 固有分岐を production runtime へ追加しない。
- [x] canonical docs、coverage、generated docs が source と同期する。
- [ ] local validation、implementation/lifecycle final-head CI、semver、comments、clean/upstream が揃う。
- [x] 実 benchmark / owner threshold approval を未実施なら残存 gate に記録する。

## 検証計画

- benchmark runner targeted/full tests
- infra benchmark metrics persistence tests
- contract schema/type testsとAPI producer tests
- benchmark/API/contract/infra typecheck・build・affected/full tests
- docs check、source audit、pre-commit、`git diff --check`
- GitHub Actions full CI / semver validation

## ドキュメント保守計画

- `REQ_FUNCTIONAL_019`、`REQ_SERVICE_QUALITY_001`、`REQ_SERVICE_QUALITY_010`、`DES_DLD_009` を式・nullability・evidence source と同期する。
- requirements coverage を実装/test evidence に同期する。
- README/Operations/API docs への影響を確認し、正本 DLD/REQ で十分なら不要理由をレポートする。

## ローカル検証実績

- `npm run ci`: 成功（API 803/803、web 442/442、infra 88/88、benchmark 106/106、contract 2/2、全 lint/typecheck/build）。
- `task docs:check`: 成功（OpenAPI、API code docs 97 APIs / 582 documents、web/infra inventory を含む）。
- release source audit: 成功（audit `sha256:102b03a5a6b77c7c167745fac2fe679e6fd574ed777309260f4f673e5b2201a7`、dataset-specific branch 0、artifact mismatch 0）。
- targeted runner / infra / producer / schema tests、requirements coverage: 成功。
- 実 benchmark、owner threshold approval、actual AWS は未実施。context relevance は required gate ではなく diagnostic measurement として保持する。

## リスク・rollback 境界

- faithfulness を unsupported sentence の単純補数に限定すると claim evidence と意味がずれるため、評価根拠を明示する。
- context relevance を retrieval recall と混同しない。recall は期待根拠の回収、relevance は取得 context 内の適合割合とする。
- evidence が不完全な suite を完全評価として扱わない。
- rollback は runner fields、case artifact、persistence/schema/producer、tests/docs を同じ単位で戻す。
- merge、deploy、release、実 benchmark 実行は行わない。

## Done 条件

- deliverables: runner/report/case artifact、persistence/schema/type/producer、tests、canonical docs、coverage、task/report、Draft PR evidence が同 stacked branch に揃う。
- validations: selected checks と implementation/final-head CI が成功し、blocking self-review 指摘がない。
- lifecycle: task done commit、Issue #358 進捗、clean/upstream 一致まで確認する。
- honesty: 実 benchmark と owner threshold approval を実施済みとして書かない。
