# Issue #358 SQ-008 first-token latency clock lineage

- 状態: done
- タスク種別: latency measurement / benchmark quality pipeline
- 作成日: 2026-07-17
- 起点: PR #413 final head `fd62b624`
- branch: `codex/issue-358-sq008-first-token-latency`
- 関連要件: `SQ-008`, `FR-019`, `FR-048`

## 背景・目的

Issue #358 P1-B は first-token latency を入口から出力まで一貫した clock / trace で計測し、summary → observation → quality gate へ根拠付きで伝播することを求める。total response latency、provider aggregate、wall-clock timestamp の差分を first token の代用にすると、未測定値を測定済みとして扱う危険がある。

本タスクでは current request/stream/runner/trace/summary/persistence/producer の clock lineage を RCA し、authoritative first output event が存在する場合だけ latency を算出する。欠損・clock mismatch・invalid・non-streaming unavailable を zero または pass に変換しない。

## 実装チェックリスト

- [x] API ingress、orchestration、provider/stream、trace、benchmark runner、summary、persistence、producer の current timing contract を RCA する。
- [x] first-token / first-output の測定起点・終点・clock domain・単位・versioned evidence を定義する。
- [x] total latency や provider self-reported aggregate を first-token latency の fallback に使わない。
- [x] summary / report / case artifact / run metrics / producer へ authoritative evidence を伝播する。
- [x] missing / invalid / negative / non-finite / clock mismatch / partial / retry を fail closed にする。
- [x] normal streaming / non-streaming unavailable / first event / retry / aggregation の tests を追加する。
- [x] SQ-008 / FR-019 / FR-048 / DLD / OPS / requirements coverage / generated docs を同期する。
- [x] selected/full validation、Draft stacked PR、semver、AC/self-review、report/task done まで完遂する。final-head CI と Issue #358 進捗は lifecycle commit 後の external gate として PR/Issue comment に記録する。

## 受け入れ条件

- [x] model first-token latency は orchestration ingress と、最終回答を生成した attempt の最初の非空 Bedrock content delta を同一 monotonic clock lineage で測定する。
- [x] 現行の buffered JSON / SSE final 応答では client-visible first-token を測定済みとせず、model first-token と明確に区別する。
- [x] versioned evidence に測定値、単位、clock/source、適用可否を再検証可能な形で保持する。
- [x] summary → run metrics → production observation の値と sample count が同じ case evidence から導出される。
- [x] total latency、完了時刻差分、provider aggregate、推定値を first-token latency に流用しない。
- [x] evidence 欠損・非対応・clock mismatch・invalid/non-finite/negative・分母0を unavailable とし、zero/pass に変換しない。
- [x] retry / multi-turn / partial failure で、異なる attempt や turn の clock を混在させない。
- [x] owner 未承認 threshold を default policy / promotion gate に追加しない。
- [x] RAG 根拠性、tenant、認可、trace sanitization、artifact integrity 境界を後退させない。
- [x] benchmark期待語句、QA sample、dataset 固有分岐を production runtime へ追加しない。
- [x] canonical docs、coverage、generated docs が source と同期する。
- [x] local validation、implementation CI、semver、AC/self-review comment が揃った。lifecycle final-head CI / clean/upstream は lifecycle commit 後に確認する。
- [x] 実 streaming provider / 実 benchmark / actual AWS は未実施の残存 gate として PR comment に記録した。

## 完了証跡

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/417
- implementation CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29563416683（success）
- 受け入れ条件: https://github.com/tsuji-tomonori/rag-assist/pull/417#issuecomment-5000259513
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/417#issuecomment-5000259545
- semver: `semver:patch`
- GitHub Apps 制約: コネクタを利用できず `gh` fallback を使用。

## 検証計画

- API orchestration/trace/producer timing tests
- benchmark runner/summary/report/case artifact tests
- contract schema と infra metrics persistence tests
- affected/full lint、typecheck、test、build、`npm run ci`
- docs check、release source audit、pre-commit、`git diff --check`
- GitHub Actions implementation/final-head CI

## ドキュメント保守計画

- `REQ_SERVICE_QUALITY_008` の measurement boundary、clock、unavailable semantics、evidence source を実装と同期する。
- `REQ_FUNCTIONAL_019` / `REQ_FUNCTIONAL_048` と benchmark DLD / monitoring docs に timing evidence の伝播境界を反映する。
- requirements coverage と canonical generated OpenAPI/API-code docs の適用可否を確認し、必要な生成物を同期する。
- README / API / operations への影響を確認し、不要ならレポートに理由を残す。

## リスク・rollback 境界

- `Date.now()` の別地点差分や completion latency を first token と誤認しない。
- monotonic clock と wall clock、別 process / Lambda / CodeBuild の clock を無根拠に混在させない。
- debug trace へ raw prompt/token/secret を追加せず、必要最小の timing metadata のみ保持する。
- rollback は clock evidence、runner aggregation、persistence/schema/producer、tests/docs を同じ単位で戻す。
- merge、deploy、release、実 provider benchmark は行わない。

## Done 条件

- deliverables: authoritative first-output evidence、summary/report/case artifact、persistence/schema/producer、tests、canonical/generated docs、task/report、Draft PR evidence が同 stacked branch に揃う。
- validations: selected checks と implementation/final-head CI が成功し、blocking self-review 指摘がない。
- lifecycle: Issue #358 進捗、clean/upstream 一致まで確認する。
- honesty: 実 streaming provider、実 benchmark、actual AWS を実施済みとして書かない。
