# Issue #358 SQ-012 false refusal rate 契約

- 状態: done
- タスク種別: benchmark 品質指標
- 作成日: 2026-07-17
- 起点: `origin/main` at `8a427a24`
- branch: `codex/issue-358-sq012-false-refusal-rate`
- 関連要件: `SQ-012`, `FR-019`

## 背景・目的

benchmark runner は refusal precision / recall と unsupported answer rate を出力するが、answerable 行を誤って refusal した割合を summary / report に独立指標として出力していなかった。調査の結果、永続化 run metrics、API contract、production observation producer には versioned case artifact から導出する既存経路があることを確認した。Issue #358 P1-B の独立単位として runner artifact の `falseRefusalRate` を定義・算出・集約し、既存の安全な伝播経路を保持したうえで、明示 threshold がある場合だけ regression gate が評価できる契約を追加する。

SQ-006〜015 の閾値は owner 未承認であるため、本タスクでは既定閾値を推測せず、未計測・分母0・threshold未指定を pass/zero に変換しない。

## 実装チェックリスト

- [x] current main の row evaluation、summary、quality review、永続化、API/Web 表示境界を確認する。
- [x] `falseRefusalRate = answerable rows refused / answerable rows` と分母0時 `null` を正本化する。
- [x] summary JSON と Markdown metric table に指標・分子・分母・not-applicable を出力する。
- [x] benchmark run metrics の persistence script、shared type、schema、consumer の既存契約を監査し、回帰テストで保持する。
- [x] explicit threshold 指定時だけ lower-is-better regression gate に入力し、未承認 default threshold は追加しない。
- [x] normal / zero / null / invalid / explicit-gate の contract tests を揃える。
- [x] SQ-012 / FR-019 / benchmark DLD / coverage を source と同期する。
- [x] selected/full local validation、Draft PR、AC/self-review、report/task lifecycle を完遂する。
- [ ] lifecycle commit 後の final-head CI、Issue #358 進捗、clean/upstream を確認する（この task done commit 後に実施）。

## 受け入れ条件

- [x] answerable 行の refusal 件数を answerable 行数で割った `falseRefusalRate` が summary に出る。
- [x] answerable 行が0件の場合は `null` であり、0% または pass に誤変換しない。
- [x] persisted benchmark run metrics と API schema/type は finite number を保持し、`null` / invalid は欠落として扱う。
- [x] Markdown report は numerator / denominator と evaluated / not applicable を区別する。
- [x] current/baseline と explicit `falseRefusalRate` threshold が揃う場合、増加を regression と判定する。
- [x] default evaluator profile に未承認 threshold を追加せず、threshold未指定で gate pass の根拠にしない。
- [x] refusal precision/recall、unsupported answer、answerable accuracy、RAG 根拠性・認可境界を後退させない。
- [x] benchmark期待語句、QA sample、dataset 固有分岐を production runtime へ追加しない。
- [x] canonical docs、coverage、generated docs が source と同期する。
- [x] selected local validation、implementation-head CI、semver、comments が揃う。
- [ ] lifecycle final-head CI、Issue #358 進捗、clean/upstream が揃う（この task done commit 後に実施）。
- [x] 実 benchmark / owner threshold approval を未実施として残存 gate に記録する。

## 実施結果

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/406
- implementation commit: `f6c2672a`
- implementation-head CI: `Lint, type-check, test, build, and synth` 成功（8分8秒）、`validate-semver-label` 成功、明示 RAG promotion gate は通常 PR のため skip
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/406#issuecomment-4998965145
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/406#issuecomment-4998965136
- local: benchmark 104/104、API targeted 2/2、lint、benchmark/API build、docs check、source audit、pre-commit、diff check 成功
- 未実施: 実環境 benchmark、owner threshold 承認。完了扱いにしていない。

## 検証計画

- benchmark targeted run/quality tests
- infra persistence script tests
- API schema/type and affected API tests
- benchmark/API typecheck・build・full tests
- docs generation/check、source audit、pre-commit、`git diff --check`
- GitHub Actions full CI / semver validation

## ドキュメント保守計画

- `REQ_SERVICE_QUALITY_012` と `REQ_FUNCTIONAL_019` に指標定義、nullability、threshold approval 境界を記録する。
- benchmark 詳細設計と requirements coverage を実装/test evidence に同期する。
- README と運用手順への影響を確認し、run summary contract の正本が既存 DLD の場合は同 DLD を更新する。

## リスク・rollback 境界

- false refusal と refusal precision を混同すると分母が変わるため、名称・式・report basis を固定する。
- `null` を0へ変換すると answerable row 不在を完全合格に誤変換するため禁止する。
- owner 未承認 threshold を default profile へ追加しない。
- rollback は metric field、report row、persistence/schema/type、tests/docs を同じ単位で戻す。
- merge、deploy、release、実 benchmark 実行は行わない。

## Done 条件

- deliverables: runner、report、persistence、schema/type、tests、canonical docs、coverage、task/report、Draft PR evidence が同 branch に揃う。
- validations: selected checks と final-head CI が成功し、blocking self-review 指摘がない。
- lifecycle: task done commit、Issue #358 進捗、clean/upstream 一致まで確認する。
- honesty: 実 benchmark と owner threshold approval を実施済みとして書かない。
