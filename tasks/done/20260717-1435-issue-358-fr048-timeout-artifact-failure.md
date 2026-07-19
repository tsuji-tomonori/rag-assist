# Issue #358 FR-048 timeout / artifact failure state model

- 状態: done（deliverables 完了、final-head 外部 gate は lifecycle commit 後に確認）
- タスク種別: benchmark run lifecycle / artifact integrity
- 作成日: 2026-07-17
- 起点: PR #411 final head `59590afb`
- branch: `codex/issue-358-fr048-timeout-artifact-failure`
- 関連要件: `FR-048`, `FR-019`, `SQ-001`

## 背景・目的

Issue #358 P1-B は benchmark run に `timed_out` と artifact 単位の生成失敗を追加し、timeout / partial artifact failure / metric unavailable を success や zero に誤変換しないことを求める。current run status は `queued | running | succeeded | failed | cancelled` のみで、CodeBuild post-build は欠損 artifact を空/擬似 artifact で補完してから一律 upload / metrics update を試みる。

本タスクでは、timeout と artifact integrity を versioned explicit state として runner persistence / API / producer / Web presentation へ伝播し、欠損を成功 artifact として扱わない fail-closed 境界を実装する。

## 実装チェックリスト

- [x] run status、CodeBuild completion / timeout、artifact upload、metrics update、producer/UI の current contract を RCA する。
- [x] `timed_out` の terminal semantics と active/terminal status 判定を統一する。
- [x] artifact 単位の expected / available / failed 状態、failure reason、integrity summary を versioned schema で定義する。
- [x] timeout / artifact partial failure から run success・metrics gate pass への誤変換を拒否する。
- [x] normal / timeout / partial / all-missing / invalid legacy / authorization cleanup の tests を追加する。
- [x] API / Web type/schema/presentation、infra persistence、producer observation を同期する。
- [x] FR-048 / FR-019 / SQ-001 / DLD / requirements coverage / generated docs を同期する。
- [x] selected/full validation、Draft stacked PR、semver、AC/self-review、report/task done を完遂する。final-head CI と Issue #358 進捗は lifecycle commit 後の外部 gate として確認する。

## 受け入れ条件

- [x] `timed_out` は run の terminal status として API/schema/Web で同じ語彙を使い、cancelable/active と誤判定しない。
- [x] expected artifact ごとに availability / failure を識別でき、欠損 artifact を空の成功 artifact として補完しない。
- [x] artifact failure の count / status / safe reason が run metrics または versioned artifact integrity field から producer へ伝播する。
- [x] timeout または required artifact failure を含む run は `succeeded`、metric zero、gate pass に誤変換されない。
- [x] partial artifact failure は成功 artifact を失わず、失敗 artifact と unavailable metrics を明示する。
- [x] invalid/non-finite/self-reported-only/legacy incomplete evidence を fail closed に扱う。
- [x] tenant、authorization、artifact cleanup、revocation boundary を後退させない。
- [x] benchmark期待語句、QA sample、dataset 固有分岐を production runtime へ追加しない。
- [x] canonical docs、coverage、generated docs が source と同期する。
- [x] local validation、implementation-head CI、semver、AC/self-review comments が揃う。lifecycle final-head CI と clean/upstream は lifecycle commit 後の外部 gate として確認する。
- [x] 実 benchmark / actual CodeBuild timeout / actual AWS を未実施の残存 gate として PR と作業レポートに記録する。

## 検証計画

- API schema/store/service/producer tests
- infra metrics / stack / artifact completion tests
- Web status presentation/component tests
- benchmark/contract tests（versioned artifact integrity を追加する場合）
- affected typecheck/build、full `npm run ci`
- docs check、release source audit、pre-commit、`git diff --check`
- GitHub Actions implementation/final-head CI

## ドキュメント保守計画

- `REQ_FUNCTIONAL_048` を status / artifact integrity / partial failure semantics と同期する。
- `REQ_FUNCTIONAL_019` / `REQ_SERVICE_QUALITY_001` と benchmark DLD の unavailable / gate 境界を同期する。
- requirements coverage と canonical generated OpenAPI/API code docs を更新する。
- README / operations への影響を確認し、運用上必要なら同 unit で更新する。不要ならレポートに理由を残す。

## ローカル検証実績

- `npm run ci`: 成功（API 805/805、Web 443/443、contract 2/2、infra / benchmark 全 test、全 workspace lint/typecheck/build）。
- `task docs:check`: 成功（canonical structure、OpenAPI、97 APIs / 582 API documents、Web/infra inventory、hidden Unicode）。
- release source audit: 成功（audit `sha256:658d862721d7c9c2dd643f3a22caf3b80de9ed74515764cf9b6498a008e85b20`、dataset-specific branch 0、artifact mismatch 0）。
- selected API schema/service/producer、Web component/integration、infra updater/stack/snapshot tests: 成功。
- changed/untracked files pre-commit、`git diff --check`: 成功。
- actual AWS、実 CodeBuild timeout、実 benchmark は未実施。

## PR 証跡

- Draft stacked PR: https://github.com/tsuji-tomonori/rag-assist/pull/413
- 受け入れ条件: https://github.com/tsuji-tomonori/rag-assist/pull/413#issuecomment-4999672177
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/413#issuecomment-4999675372
- implementation-head CI: success（run 29559605805、7分51秒）
- final-head CI / Issue 進捗 / clean-upstream: lifecycle commit 後に確認し、PR / Issue comment に記録する。

## リスク・rollback 境界

- 既存 terminal status 判定が複数箇所にあるため、`timed_out` の追加漏れを静的・unit test で検出する。
- CodeBuild shell だけで状態を推定せず、durable evidence と authorization boundary を維持する。
- failure reason に secret / signed URL / raw log を保存しない。
- rollback は status/schema、artifact integrity persistence、producer/UI、tests/docs を同じ単位で戻す。
- merge、deploy、release、実 AWS benchmark は行わない。

## Done 条件

- deliverables: status/artifact integrity model、persistence/API/producer/Web、tests、canonical/generated docs、task/report、Draft PR evidence が同 stacked branch に揃う。
- validations: selected checks と implementation/final-head CI が成功し、blocking self-review 指摘がない。
- lifecycle: Issue #358 進捗、clean/upstream 一致まで確認する。
- honesty: 実 CodeBuild timeout、実 benchmark、actual AWS を実施済みとして書かない。
