# Issue #358 folder parent integrity mandatory deny order 作業完了レポート

## 受けた指示

Issue #358 の未完了項目を再監査し、他 PR と重複しない最小 unit として folder parent integrity と administrative-principal invariant の評価順を修正する。専用 worktree / task、検証、canonical docs、作業レポート、stacked Draft PR、日本語の受け入れ条件・セルフレビュー、implementation / final head CI、Issue 進捗、clean / upstream / remote 一致まで完遂する。actual AWS / manual evidence、migration、scanner、merge、deploy、releaseは行わない。

## 要件整理と判断

- missing parent は `hasFolderCycle` が既に admin 判定前に fail closed にしていたため、既存挙動の regression control とした。
- 一覧内に存在する archived / cross-tenant parent は cycle と判定されず、後段の explicit parent check より前に admin `full` が返ることを実欠陥と特定した。
- explicit parent が active same-tenant であることを administrative-principal resolution 前の mandatory precondition とする。
- root folder と active same-tenant parent の valid admin `full`、ordinary inheritance / explicit policy は維持する。
- broken data の修復や migration は authorization decision の範囲外かつ owner 判断が必要なため、本 unit では fail closed に限定する。

## 実施作業

- `FolderPermissionService.resolveEffectiveFolderPermissionDetail` の explicit parent exists / tenant / active check を administrative-principal `full` 判定より前へ移動した。
- missing / archived parent の admin negative test と、corrupt cross-tenant parent を表す custom store の negative test を追加した。
- root / active same-tenant parent の admin positive control を追加した。
- FR-061 / FR-077 の実装 evidence を更新し、requirements coverage を確認した。
- source-backed API docs を 98 APIs / 588 documents として再生成し、構造・freshness check を確認した。生成差分はなかった。
- public API / OpenAPI / store schema / mutation / audit / cleanup / Web UI / infra / IAM は変更していない。

## 成果物

- folder parent integrity mandatory-deny order の実装と direct tests
- 更新した FR-061 / FR-077 canonical requirements
- task: `tasks/done/20260718-0141-issue-358-folder-parent-integrity-order.md`
- Draft PR #439
- 本レポート

## 検証結果

- targeted folder permission test: 成功
- targeted requirements coverage test: 成功
- `npm run typecheck -w @memorag-mvp/api`: 成功
- API full coverage: 916件成功、0件失敗。statements / lines 90.69%（58153 / 64119）、branches 80.31%（13691 / 17046）、functions 93.47%（3022 / 3233）
- `task docs:api-code`: 成功（98 APIs / 588 generated documents、生成差分なし）
- `task docs:check`: 成功
- `task verify`: 成功（lint、全 workspace typecheck / build）
- `npm run rag:release:source-audit`: 成功（audit sha256 `10895f32607e48c4f52e985ba41cb40171e07ece51d4d1976abc9044c35834b6`、dataset-specific branch 0、artifact mismatch 0）
- `npm run ci`: 成功（Contract 4、API 916、Web 442、Infra 38、Benchmark 102、全 build 成功）
- `pre-commit run`: 成功
- `git diff --check`: 成功
- implementation-head GitHub Actions run `29598881190`: head `2a4f75cd7e3e45bf0b29d24cbea8e80bd2fce000`、success

fresh worktree の初回 targeted test は親 worktree 由来の stale `node_modules` により、製品コード load 前に `ERR_PACKAGE_PATH_NOT_EXPORTED` で失敗した。`npm ci` で lockfile どおり 504 packages を再構築し、同一 test を再実行して成功した。requirements coverage の初回実行は repository root から起動したため test の期待 cwd と不一致で失敗し、`apps/api` から同一 test を再実行して成功した。未解決 test failure はない。既存 `npm audit` は 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告し、本 unit では依存更新を行っていない。

## 指示への fit 評価

archived / cross-tenant parent を admin を含む全 principal へ `none` / `resource_integrity_unverified` とする最小の評価順変更を実装した。missing の既存 fail-closed と valid root / parent の positive behavior を直接固定し、tenant / lifecycle / cycle / account / identity の mandatory deny を弱めていない。RAG retrieval / citation / ingestion、benchmark 期待語句、QA sample 固有値、dataset 固有分岐、production mock fallback は変更・追加していない。

## ドキュメント・セキュリティ確認

- canonical FR-061 / FR-077 と実装・tests の mandatory-deny priority を同期した。
- README、API example、運用手順、AGENTS.md は public contract / operation 非変更のため更新不要と判断した。
- resource integrity precondition を admin invariant より前へ移したため、認証・tenant・ownership boundary は強化され、返却 schema や機微 field は変更していない。
- API route / middleware / access-control static policy の変更はないため、policy test の追加更新は不要と判断した。

## 未対応・制約・リスク

- actual data に broken parent を持つ active child が存在するかは未確認である。存在する場合は修復まで admin を含む全利用者が fail closed になる。
- actual data 調査、repair / migration owner、管理操作面は後続 owner-decision unit で扱う。
- actual AWS / manual E2E、scanner、merge、deploy、release は未実施。
- stacked Draft chain が未 merge のため、PR #439 は PR #438 final head を前提とする。
- 既存 `npm audit` 8 vulnerabilities は未解消である。

## 外部証跡

- implementation commit: `2a4f75cd7e3e45bf0b29d24cbea8e80bd2fce000`
- Draft PR: #439 `https://github.com/tsuji-tomonori/rag-assist/pull/439`
- stacked base: PR #438 branch `codex/issue-358-fr068-malware-promotion-guard`
- semver label: `semver:patch`
- 初回受け入れ条件コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/439#issuecomment-5005643577`
- 初回セルフレビューコメント: `https://github.com/tsuji-tomonori/rag-assist/pull/439#issuecomment-5005643787`
- implementation-head CI: run `29598881190`、success
- final-head CI、最終コメント、Issue #358 進捗、clean / upstream / remote 一致は task lifecycle commit 後に外部証跡として確認する。
- GitHub Apps PR 操作 tool は利用できなかったため、規定 fallback として `gh` を使用した。
