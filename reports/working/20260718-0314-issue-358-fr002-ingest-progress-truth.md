# Issue #358 FR-002 取り込み進捗 truthfulness 作業完了レポート

- 作業日時: 2026-07-18 02:40–03:14 JST
- Issue: [#358](https://github.com/tsuji-tomonori/rag-assist/issues/358)
- Draft PR: [#440](https://github.com/tsuji-tomonori/rag-assist/pull/440)
- stacked base: `codex/issue-358-folder-parent-integrity-order` / PR #439 final head `b251a6023790071d9f94d1091fd53d71bae5bffe`
- implementation head: `5499ee11a906bdfaeb4aa96617aedd476c773c0c`
- task: `tasks/done/20260718-0240-issue-358-fr002-ingest-progress-truth.md`

## 受けた指示

Issue #358 を止めずに継続し、PR #439 後の非重複かつ bounded な unit を fresh worktree で実装する。受け入れ条件、RCA、tests-first、実装・正本 docs・検証・作業レポート、目的別 commit、Draft stacked PR、implementation / final head の CI、日本語 AC / self-review / verification、Issue 進捗、clean / upstream / remote 一致まで完遂し、merge / deploy / release は行わない。

## 要件整理と判断

### confirmed

- Web client は `pollCount` を `extracting`、`chunking`、`embedding`、`indexing` へ変換し、経過時間だけで user-visible phase を進めていた。
- API response schema は optional `stage` を持つが、Web の `DocumentIngestRun` type は受け取っていなかった。
- backend は少なくとも `queued`、`running`、`preprocessing`、`extracting` と terminal stage を記録する。
- terminal error、auth / tenant / scope、manifest refresh は既存 contract として独立している。

### inferred / conflict / open question

- client-local な preparing / transferring / creatingRun は実際に開始した local operation なので維持した。
- missing / unknown stage は工程へ丸めず explicit unavailable とすることで、旧 response と将来 stage の双方に正直に対応できる。
- backend が永続化しない chunk / embedding / indexing を UI だけで維持する案は No Mock Product UI と FR-002 の API 由来条件に反するため不採用とした。
- backend stage 粒度や `/events` subscription の追加は本 unit 外とした。

### 根本原因

user-visible progress の各値を local operation / API response / explicit unavailable / terminal result のどれに由来するか型と mapper で固定せず、polling 回数を domain state に変換できる構造と、intermediate progress の出所を検証しない tests を許していたこと。

## 実施作業

- `DocumentIngestRun.stage`、`DocumentIngestProgressPhase`、pure な `documentIngestProgressPhase` mapper を追加した。
- `pollCount` / `pollPhases` と架空の chunking / embedding / indexing phase を production polling path から削除した。
- known API stage のみ表示し、missing / unknown は live region 内で「詳細な取り込み段階を確認できません」と理由付きで表示した。
- 同一 stage の repeat poll、missing / unknown、done の誤昇格防止、terminal errors、hook / component の regression tests を追加・更新した。
- FR-002 に AC-FR002-006 を追加し、requirements coverage を実質的な Web / API contract tests へ更新した。
- 公式 inventory task により Web accessibility / feature / JSON inventory の実装行番号を同期した。
- GitHub Apps の callable tool がないため、規約に記録したうえで `gh` fallback により Draft stacked PR、label、comments を操作した。

## 成果物

- Web API client / source-aware progress mapper
- honest unavailable state を持つ upload progress panel
- API client / hook / component regression tests
- FR-002 正本と requirements coverage
- generated Web inventory 3 件
- task lifecycle 記録と本レポート
- Draft PR #440 (`semver:patch`)

## 検証

### tests-first

初回 targeted run は次の 4 回帰で期待どおり失敗した。

- mapper が未実装
- missing stage が extracting と表示される
- repeat `extracting` が poll 回数で chunking / embedding へ進む
- unknown / unavailable UI がない

実装後、同一 targeted 3 files / 122 tests は成功した。

### 成功したローカル検証

- `npm ci`: success（504 packages、既存 npm audit 8 件: low 2 / moderate 1 / high 5）
- targeted API client / hook / DocumentWorkspace: 3 files / 122 tests
- Web typecheck
- 変更 Web files への `npx eslint ...`
- requirements coverage direct test
- `task docs:web-inventory`
- `task docs:web-inventory:check`
- `task docs:web-trace:test`
- `npm run test:web-semantic-ui`
- Web full coverage: 61 files / 444 tests、statements 90.8% (4634/5103)、branches 85.75% (4581/5342)、functions 90.67% (1390/1533)、lines 93.61% (4005/4278)
- Web build
- `task docs:check`
- `npm run rag:release:source-audit`: SHA-256 `0d165d16bc7c90581986ca373e567d4f31378e30ac2691066c368a18c19157b6`、dataset-specific branches 0、artifact mismatch 0
- `task verify`
- `npm run ci`
- 変更ファイル限定 `pre-commit run --files ...`
- `git diff --check`

Vite >500 kB と Lambda bundle-size warning は既知であり、検証は exit 0。`npm run lint -w @memorag-mvp/web` は workspace に lint script がなく command selection error となったため、変更ファイルへの ESLint direct run に修正して成功した。`pre-commit run --all-files` は対象外の既存レポートの trailing whitespace を自動修正したためその変更を基点どおり復元し、変更ファイル限定で全 hook を成功させた。

### 外部検証

- implementation CI: [run 29602528837](https://github.com/tsuji-tomonori/rag-assist/actions/runs/29602528837) — success、8m23s
- initial AC: [comment 5006089178](https://github.com/tsuji-tomonori/rag-assist/pull/440#issuecomment-5006089178)
- initial self-review: [comment 5006089406](https://github.com/tsuji-tomonori/rag-assist/pull/440#issuecomment-5006089406)
- initial verification: [comment 5006089591](https://github.com/tsuji-tomonori/rag-assist/pull/440#issuecomment-5006089591)
- final-head CI、Issue progress、final comments、remote 一致は lifecycle commit 後に確認し、PR / Issue へ追記する。

## 指示への fit 評価

- bounded / non-duplicate unit: 適合。API / backend / infra を広げず FR-002 progress truthfulness に限定した。
- No Mock Product UI: 適合。表示値は local operation、known API stage、terminal result、explicit unavailable に由来する。
- docs と実装の同期: 適合。FR-002、coverage、generated inventory を同期した。README / OpenAPI / operation docs は public API / operation 非変更のため内容更新不要と判断し freshness check を実施した。
- tests / validation: 適合。tests-first、targeted、full Web、docs、repository、remote implementation CI を実施した。
- security / RAG: 適合。auth / tenant / scope / route / schema / worker / store / retrieval を変更せず、benchmark 期待語句、QA sample 固有値、dataset 固有分岐を追加していない。
- PR lifecycle: implementation head まで適合。final-head の証跡は lifecycle commit 後に完遂する。

## 未対応・制約・リスク

- actual AWS / manual E2E / visual / axe / real-device は未実施。
- backend stage 粒度、events subscription、scanner、migration、retention、owner policy は対象外。
- backend が coarse / missing stage を返す期間は詳細工程が unavailable または broad stage になる。unverified state を actual progress として表示しないための意図した制約である。
- npm audit 8 件、Vite / Lambda bundle-size warning、GitHub Actions の Node.js action deprecation annotation は既存で、本変更では未解消。
- merge / deploy / release は未実施であり、行わない。

## Rollback

Web response type、stage mapper、progress panel / tests、FR-002 / coverage / generated inventory を一括で戻す。API / data / auth / infra は変更していないため data rollback は不要。ただし rollback 後は poll-count pseudo progress が復活する。
