# Issue #358 FR-089 実 guard profile 設定検証 作業完了レポート

作成日時: 2026-07-16 21:00 JST

## 受けた指示

- Issue #358 の PR 分割2として、FR-089 の実 guard profile 設定経路を実装し、恒真検査を解消する。
- `origin/main` 起点の専用 worktree で task、実装、検証、commit、push、main 向け draft PR、受け入れ条件コメント、セルフレビューまで実施する。
- PR #365 の contract declaration shim 削除を実装 commit 後に非破壊 merge し、PR は #365 の先行 merge を前提とする stacked PR として扱う。
- PR #366 との文書差分の重なりを確認し、FR-089 に必要な変更だけを保持する。

## 要件整理と RCA

- `confirmed`: 変更前の orchestration は実設定ではなく、全 guard が有効な `STANDARD_RAG_GUARD_PROFILE` を検査していた。
- `confirmed`: `config.ts` と `Dependencies` に guard profile の入力・保持経路がなく、unset、unknown、partial、all-off の運用設定が production 検査へ到達しなかった。
- 根本原因は、trusted constant と configured runtime state が分離され、strict parser と dependency injection が存在しなかったことである。
- failure timing は、通常の不正設定を `createDependencies()` で拒否する起動時 failure と、依存生成後に unsafe profile が注入された場合を downstream 実行前に拒否する runtime failure の二段階に固定した。

## 検討・判断

- guard 欠落や未知値を既定値で補完せず、完全な JSON object と全9 guard の boolean `true` だけを許可する fail-closed 方針を採用した。
- authentication、authorization、classification usage、prompt injection、tool policy、grounding、citation、output secret、trace redaction の必須集合は維持した。
- public HTTP API は変更しないため OpenAPI schema は変更せず、既存 generator の実行互換性だけを明示設定で確保した。
- PR #366 の patch は FR-045/SQ-003 の coverage 更新であり、本変更の FR-089 hunk と直接競合しないことを確認した。
- PR #365 の shim 削除との delete/modify conflict は、指示どおり削除側を採用し、canonical `packages/contract/src/infra.ts` の追加フィールドを保持した。

## 実施作業

- `RAG_GUARD_PROFILE_JSON` の strict parser と設定エラーを security policy に追加した。
- config → `createDependencies()` → `Dependencies.ragGuardProfile` → `runChatOrchestration` の実設定経路を追加した。
- dependency creation と orchestration 開始時の双方で安全性を検査し、graph/model/store より先に拒否する test を追加した。
- Taskfile、docker-compose、API test/docs generator、IaC Lambda environment に完全な safe profile を明示した。
- FR-089 要件、requirements coverage、infra inventory、IaC snapshot を同期した。
- 実装 commit `cffeb1fa` の後に PR #365 head `ec275c78` を merge commit `a3e0e0d8` で取り込んだ。

## 成果物

- guard profile parser・runtime wiring・回帰 test・IaC/運用設定
- `docs/requirements/functional/REQ_FUNCTIONAL_089.md` と requirements coverage の証跡更新
- `tasks/do/20260716-2013-issue-358-guard-profile-validation.md`
- 本作業レポート

## 検証結果

- targeted policy/dependencies/graph test: 成功
- API test: 806/806 成功
- API coverage: 成功（Statements/Lines 90.45%、Branches 80.45%、Functions 92.93%）
- infra test: 38/38 成功、snapshot 更新確認
- PR #365 merge 後 contract test: 4/4 成功
- `task verify`: merge 前後とも成功
- `task docs:check`: merge 前後とも成功
- root `npm run ci`: merge 前後とも成功
  - post-merge: contract 4、API 806、Web 442、Infra 38、Benchmark 102 tests と全 build が成功
- `git diff --check`: 成功
- implementation commit 時の pre-commit hooks: 全て成功

## 指示への fit 評価

- 実運用設定を検査対象にし、設定欠落・不正値・全 off・単一 off を起動時に拒否する受け入れ条件を実装と自動 test で満たした。
- unsafe dependency injection も downstream 前に拒否し、設定検査の迂回を防いだ。
- docs と実装、IaC と運用設定、検証証跡を同一変更範囲で同期した。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐は追加していない。

## 未対応・制約・リスク

- この branch は PR #365 の commit を含む stacked branch であり、PR #365 の merge 前には merge しない。PR #365 merge 後は main との差分が FR-089 中心へ収束する想定である。
- PR 作成、受け入れ条件コメント、セルフレビュー、task の done 移動は、このレポート commit/push 後に実施し、結果を追記する。
- dependency install 時の `npm audit` は既存の 8 vulnerabilities を報告した。本タスクでは dependency version を変更しておらず、`package-lock.json` に差分はない。
- Web production build は既存の 500 kB 超 chunk warning を出したが、build は成功した。
- merge、deploy、release は実施しない。
