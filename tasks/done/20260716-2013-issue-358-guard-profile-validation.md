# Issue #358 FR-089 実 guard profile 設定検証

保存先: `tasks/done/20260716-2013-issue-358-guard-profile-validation.md`

状態: done

タスク種別: 修正

## 背景

`runChatOrchestration` は実行開始時に `assertSafeRagGuardProfile` を呼ぶが、検査対象は常に全 guard が有効な `STANDARD_RAG_GUARD_PROFILE` である。実際の設定入力、依存関係、runtime の間に profile の経路がなく、運用設定が unset、unknown、partial、all-off でも検査へ到達しない。

## RCA

- `confirmed`: orchestration runtime は実設定ではなく hard-coded な全 true 定数を検査している。
- `confirmed`: `config.ts` と `Dependencies` に guard profile の入力・保持項目がない。
- `confirmed`: 既存 unsafe profile test は test 内で profile を構築して policy 関数だけを検証しており、production 設定の誤りを検出しない。
- `confirmed`: API app と worker は module 初期化時に `createDependencies()` を呼ぶため、依存生成時の設定拒否を起動時 failure として固定できる。
- `inferred`: policy の安全性を先に証明した際、設定境界と runtime wiring が実装対象から漏れ、恒真検査が残った。
- 根本原因: trusted constant と configured runtime state が分離され、strict な設定 parser と dependency injection が存在しない。
- 影響範囲: API/worker の起動、chat orchestration 実行、IaC の Lambda 環境変数、API/infra test、FR-089 要件・coverage・generated docs。
- `open_question`: profile の運用上の可変性に既存契約はない。本修正では完全な profile を単一の厳格 JSON 設定として明示し、欠落を暗黙補完しない方針を採る。

## 実行計画

1. guard profile の strict parser と configuration error を security policy に追加する。
2. 実設定を `config` → `createDependencies` → `runChatOrchestration` へ渡し、起動時と実行時に fail-closed 検査する。
3. IaC/test runtime に明示的な全 guard 有効設定を与える。
4. safe、unset/blank、invalid、partial、unknown、all-off、単一 off と runtime 再検査を自動 test で固定する。
5. FR-089、requirements coverage、関連 generated docs と作業レポートを同期する。
6. 選定検証、API/root CI、docs check、commit/push、PR、受け入れ条件コメント、セルフレビューまで実施する。

## 作業前チェックリスト

- [x] 恒真検査と実設定経路欠落を source/test/config/dependencies/IaC で確認した。
- [x] failure timing を依存生成時（起動時）と orchestration 実行開始時の二段階に定義した。
- [x] authorization、grounding、citation、secret/output guard を含む必須 guard 集合を弱めない方針を確認した。
- [x] PR 分割1と競合しやすい baseline/generated docs の変更を必要最小限にする。

## Done 条件

- [x] すべての受け入れ条件を満たす。
- [x] 変更範囲に応じた API/infra/root/docs 検証が成功する。
- [x] FR-089 文書・coverage・generated docs と実装が同期する。
- [x] 日本語 PR、受け入れ条件確認コメント、セルフレビューコメントを作成する。
- [x] PR コメント後に本 task を `tasks/done/` へ移動し、同一 branch へ commit/push する。

## 受け入れ条件

- [x] production runtime が `STANDARD_RAG_GUARD_PROFILE` を検査対象にせず、設定から得た profile を検査する。
- [x] 完全かつ全 guard 有効な設定だけが依存生成に成功する。
- [x] unset/blank、invalid JSON、top-level または guard の unknown key/value、guard 欠落、all-off、単一 off は依存生成時に拒否される。
- [x] parsed profile が `Dependencies` へ保持され、orchestration runtime まで到達する。
- [x] 依存生成後に unsafe profile が注入された場合も graph/model/store 実行前に拒否される。
- [x] authentication、authorization、classification usage、prompt injection、tool policy、grounding、citation、output secret、trace redaction の必須集合を維持する。
- [x] IaC が完全な safe profile を明示設定し、環境未設定へ依存しない。
- [x] FR-089 要件と requirements coverage が failure timing と実証 test を参照する。

## 検証計画

- policy/parser unit test
- dependencies isolated-worker test（safe と unset/unknown/partial/all-off 等の起動時 failure）
- chat orchestration graph test（unsafe injected profile の実行時 failure と downstream 非実行）
- API lint/typecheck/test/build/coverage
- infra test/build と root CI/verify
- docs/generated inventory/check、pre-commit

## ドキュメントメンテナンス計画

`REQ_FUNCTIONAL_089.md` の実装・検証表を実設定経路と failure timing に同期し、requirements coverage の証跡を更新する。public HTTP API は変更しないため OpenAPI 変更は想定しない。generated code docs は generator の差分を確認し、変更した公開 surface に必要なものだけを含める。

## PR レビュー観点

実設定が config→dependencies→runtime を通ること、欠落や未知値を補完しないこと、runtime 再検査が downstream より先であること、認可・根拠性 guard と store 所有者境界を弱めていないこと、dataset/benchmark 固有分岐を入れていないことを確認する。

## 未決事項・リスク

- JSON 環境変数は引用・IaC snapshot の更新が必要。canonical serializer を使い、設定表現の drift を抑える。
- `Dependencies` 追加は test fixture に波及する。chat runtime 到達に必要な fixture だけを明示更新し、型回避の `as unknown as Dependencies` を新たに増やさない。
- PR 分割1と共通 coverage/generated ファイルで競合する可能性があるため、FR-089 に直接必要な行だけを変更する。

## 完了結果

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/369
- 受け入れ条件確認コメント: https://github.com/tsuji-tomonori/rag-assist/pull/369#issuecomment-4991611771
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/369#issuecomment-4991612007
- PR #365 の commit を非破壊 merge し、PR #365 の先行 merge が必要な stacked PR として本文・コメントへ明記した。
- post-merge root `npm run ci`: contract 4、API 806、Web 442、Infra 38、Benchmark 102 tests と全 build が成功した。
- `task verify`、`task docs:check`、API coverage、pre-commit hooks、`git diff --check` が成功した。
