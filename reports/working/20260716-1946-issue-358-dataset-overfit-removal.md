# Issue #358 dataset 過適合除去 作業完了レポート

- 作業日時: 2026-07-16 19:16〜19:46 JST
- 対象 Issue: `#358`
- 対象要件: `FR-045`、`SQ-003`
- 作業 branch: `codex/issue-358-dataset-overfit-removal`
- task: `tasks/do/20260716-1916-issue-358-dataset-overfit-removal.md`

## 受けた指示

Issue #358 の推奨 PR 分割 1 として、production RAG の evidence 採用経路から SWEBOK dataset 固有語句・固有分岐を除去し、別 corpus、言い換え、英語、negative case に対して同じ policy が成立するよう修正する。実装、検証、正規 docs／generated docs の同期、main 向け独立 PR、受け入れ条件コメント、セルフレビュー、task の done 化まで進める。

## 要件整理と判断

- 根本原因は、固有語句を保持できる `AnswerPolicy` と metadata 自動選択、および production helper を静的に禁止する検査がなかったこと。
- 固有正規表現の移設では再発を防げないため、production は runtime default policy と汎用的な質問・根拠関連度だけを使う構造へ統一した。
- 無関係 candidate を最終 evidence へ残す fallback は根拠不足 refusal を弱めるため、汎用関連度の最低値を満たさない candidate は空集合とする。
- 日付質問の言い換え回帰は dataset 固有補正で直さず、`日付` を汎用 date slot として検出し、日付値を持つ evidence の requirement signal として補完した。
- API schema、認可 filter、tenant scope は変更しない。OpenAPI 再生成は不要だが、API code generated docs は実装参照が変わるため同期した。

## 実施作業

1. `answer-policy.ts` から SWEBOK policy、分類 anchor、invalid answer pattern、search clue、metadata 自動選択を除去し、未知の `RAG_DOMAIN_POLICY_ID` は fail-fast とした。
2. prompt builder、answerability gate、citation validator、search clue、context packer から要求分類専用 helper／分岐を除去した。
3. chunk 選択を、汎用関連度、汎用 TOC 除外、根拠不足時の空集合へ統一した。
4. 日本語言い換え corpus、英語 incident corpus、legacy metadata、無関係高 score 文書、根拠不足 refusal／citation 空配列の回帰テストを追加した。
5. `benchmark/release-audit.ts` に production runtime の既知 dataset 語彙を拒否する静的 rule と、その検知／test 除外テストを追加した。
6. `FR-045`、`SQ-003`、`DES_DLD_001`、requirements baseline、coverage、API code generated docs を同期した。
7. 旧 task `20260506-1203-requirements-classification-policy.md` を、固有 policy 隔離ではなく固有値の production からの完全除去という方針へ更新した。

## 成果物

- domain-neutral evidence 採用実装と回帰テスト
- production dataset 語彙の静的 source audit
- `FR-045`／`SQ-003`／詳細設計／coverage の更新
- `docs/generated/api-code/` の関連 3 API 詳細設計と manifest の更新
- 本レポート

## 検証結果

### 成功

- targeted RAG tests: `prompts.test.ts`、`profiles.test.ts`、`runtime-layout.test.ts`、`node-units.test.ts`、`release-audit.test.ts`: 5/5 file pass
- 関連 graph シナリオ: 通常回答、business-day／explicit-date／relative-deadline／日付言い換え、根拠不足 refusal: pass
- `requirements-coverage.test.ts`: pass（`apps/api` cwd）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/benchmark`: pass
- `npm run build -w @memorag-mvp/api`: pass
- `npm run build -w @memorag-mvp/benchmark`: pass
- `npm run rag:release:source-audit`: pass、`datasetSpecificBranchCount=0`、`artifactManifestMismatchCount=0`
- docs underlying checks: `validate_docs.py`、OpenAPI quality、API code freshness（97 APIs／582 documents）、web trace、web inventory、infra inventory、hidden unicode: すべて pass
- `git diff --check`: pass
- `package-lock.json`: 変更なし

### broader test の sandbox 制約と切り分け

- branch の API 全 test は 107 file 中 102 pass／5 fail。失敗 file は次のとおり。
  - `src/contract/api-contract.test.ts`
  - `src/contract/api-hardening.test.ts`
  - `src/document-reader-routes.test.ts`
  - `src/document-share-routes.test.ts`
  - `src/questions-access.test.ts`
- `origin/main` commit `e12abb0769a56d962d4e90c54dc2b65d20734c99` を `/tmp` に `git archive` した clean snapshot で、上記 5 file と `graph.test.ts` を同一環境変数・同一コマンドで比較した。branch／clean main とも `graph.test.ts` は pass、上記 5 file は同じ failure となった。
- clean main の `api-contract.test.ts` は 17 subprocess で `listen EPERM: operation not permitted /tmp/tsx-1000/*.pipe`、`api-hardening.test.ts` は subprocess の空出力に伴う `Unexpected end of JSON input` 3件、route 3 file は各 `server exited with 1`。いずれも sandbox が `tsx` IPC／localhost listen を拒否した派生結果であり、本差分との因果は確認されなかった。
- benchmark の直接同等 test は branch／clean main とも 22 file 中 19 pass／3 fail。共通の失敗は `jp-public-pdf-qa.test.ts`、`run.test.ts`、`search-run.test.ts` で、localhost listen の `EPERM`。直接影響する `release-audit.test.ts` は pass。
- `task docs:check` は、最初に generated API docs の正当な freshness 差分を検出した。再生成後の再実行では `tsx` CLI IPC の `listen EPERM /tmp/tsx-1000/*.pipe` により Taskfile 全体は exit 201。ただし展開済みの underlying 7 commands は直接実行してすべて pass した。Taskfile 自体の成功とは扱っていない。

## 依存導入と権限

- 初回 test は worktree が親 worktree の stale `@memorag-mvp/contract` を参照し、`ERR_PACKAGE_PATH_NOT_EXPORTED` で開始できなかった。
- `npm install --offline --ignore-scripts --package-lock=false` は cache に `aws-cdk` がなく失敗した。
- ユーザー承認を得た 1 回だけ `npm install --ignore-scripts --package-lock=false` を escalated 実行し、worktree の `node_modules` のみを復元した。install scripts は無効、lockfile 更新も無効で、`package-lock.json` は不変。以後の escalation は行っていない。

## 指示への fit 評価

- production 固有語句・固有分岐: source audit 0 件、削除済み。
- benchmark expected／QA sample 固有値の production 追加: なし。
- 別 corpus／言い換え／英語／negative test: 追加し pass。
- refusal／citation／support verifier／認可境界: refusal と citation 空配列を回帰テストで確認し、support verifier と認可 filter は変更していない。
- docs／coverage／generated docs: 同期し freshness pass。
- PR／acceptance comment／self-review／task done: PR #366 を作成し、日本語 top-level comment 投稿後に task 2件を `done` へ移動した。

## 未対応・制約・リスク

- 実 Bedrock を使う LLM benchmark は外部サービスを伴うため未実施。deterministic selection／refusal／citation と source audit で本 PR の要求を検証した。
- API／benchmark の sandbox listen 制約は clean main でも再現し、本差分外だが、CI の unrestricted runner 結果は PR 作成後に確認対象とする。
- 固有補正除去により既存 SWEBOK sample の順位が変わる可能性はある。期待語句を production へ戻さず、必要なら汎用 retrieval 改善として扱う。
- merge、deploy、release は対象外で実施していない。

## PR・完了証跡

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/366
- 初回受け入れ条件確認: https://github.com/tsuji-tomonori/rag-assist/pull/366#issuecomment-4991095915
- 初回セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/366#issuecomment-4991096105
- GitHub Apps の PR 作成 call は長時間応答停止した。親 workflow の指示と `github-apps-pr-operator` の fallback に従い、`gh pr create`／`gh pr comment` を使用した。Apps 操作を成功扱いにはしていない。
- task 2件の `done` 移動と本レポート更新は第2 commit で PR branch へ反映する。
- 2026-07-16 20:07 JST の CI 状態: `validate-semver-label` は success。`Lint, type-check, test, build, and synth` は in progress（https://github.com/tsuji-tomonori/rag-assist/actions/runs/29493222473/job/87604085262）。未完の CI を成功扱いにはしていない。
