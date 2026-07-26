# Issue #359 FavoriteService narrow-port 抽出 作業完了レポート

## 1. 受けた指示

- Issue #359 の次の非重複 structural-debt unit を選定し、実装から draft PR lifecycle まで完遂する。
- PR #390 の characterization を利用し、open PR #387 と #339 の意味的重複を避ける。
- 専用 worktree/task、docs 同期、最小十分＋full 検証、日本語 gitmoji commit、draft PR、semver、AC/self-review、task/report lifecycle、final-head CI、Issue 進捗、CLEAN/upstream 一致まで実施する。
- merge / deploy / release は行わない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 既存 PR と意味的に非重複の Phase 4b 単位を選ぶ | 高 | favorites のみに限定 |
| R2 | `MemoRagService` の公開契約を維持して narrow-port subservice へ抽出する | 高 | 対応 |
| R3 | tenant / visibility / redaction / inaccessible 契約を維持する | 高 | domain/facade/full test で対応 |
| R4 | 設計・generated docs を実装と同期する | 高 | 対応 |
| R5 | local/full CI と PR lifecycle を完遂する | 高 | draft PR、label、AC/self-review 完了。final-head CI は lifecycle commit 後の外部 gate |
| R6 | merge / deploy / release をしない | 高 | 遵守 |

## 3. 検討・判断したこと

- Phase 1〜3 の候補は既に個別 PR 化済みで、PR #390 が次の候補として store-centric favorites/history を示していたため Phase 4b を選んだ。
- #387 が conversation history の公開 contract を変更するため、history public method は除外し、favorite の save/list/delete と visibility projection だけを抽出した。
- #339 の usage/cost、#387 の session-local evidence/RAG は変更していない。`memorag-service.ts` と generated docs の path overlap は残るが、semantic scope は独立している。
- `Dependencies` 全体を移動先へ渡すと構造負債の移送に留まるため、favorite/history store、owner key、認可済み document/folder query だけを port とした。
- document/folder visibility は新しい認可経路を作らず、既存 facade の `listDocuments` / `listDocumentGroups` を callback port として再利用した。
- 初期配置を `rag/` 直下にした誤りは runtime-layout guard が検出したため、非 RAG domain の `favorites/` へ修正した。

## 4. 実施作業

- `FavoriteService` と domain unit test を追加した。
- `MemoRagService` の favorite 3メソッドを同一 signature の委譲へ変更した。
- narrow dependency、tenant owner key、visibility、redaction、inaccessible response を test で固定した。
- `DES_DLD_012.md` に Phase 4b boundary と残作業を追記した。
- source-backed API docs を正規 generator で同期した。
- targeted test、API full、root CI、docs freshness、source audit を実行し、失敗を修正後に再実行した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/favorites/favorite-service.ts` | TypeScript | narrow-port favorite domain service | R2/R3 |
| `apps/api/src/favorites/favorite-service.test.ts` | TypeScript test | dependency/tenant/visibility/redaction characterization | R2/R3 |
| `apps/api/src/rag/memorag-service.ts` | TypeScript | public facade の委譲 | R2 |
| `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_012.md` | Markdown | Phase 4b boundary と互換方針 | R4 |
| `docs/generated/api-code/` | generated Markdown/JSON | 97 APIs / 582 docs の current source projection | R4 |
| `tasks/done/20260717-0904-issue-359-favorite-service-extraction.md` | Markdown | RCA、AC、検証、lifecycle | R1-R6 |
| PR #393 | GitHub draft PR | #390 branch を base にした stacked PR、`semver:patch`、日本語 AC/self-review | R5 |

## 6. 検証

- `npm ci`: pass。既存 8 vulnerabilities（low 2 / moderate 1 / high 5）。
- favorite domain test: 5/5 pass。
- runtime layout: 初回 fail（RAG root 誤配置）→`favorites/` へ移動後 13/13 pass。
- existing facade characterization: 91/91 pass。
- Phase 4a contract: 4/4 pass、公開 101 method signature snapshot 不変。
- API typecheck/build: pass。
- API full: 初回 runtime-layout failure →修正後 811/811 pass。
- OpenAPI freshness: pass。
- API code docs freshness: 初回 stale →正規再生成後 pass（97 APIs / 582 documents）。
- root `npm run ci`: pass（全 workspace lint/typecheck/test/build、Web 442 tests を含む）。
- source audit: `datasetSpecificBranchCount: 0`、`artifactManifestMismatchCount: 0`。
- `git diff --check`: pass。
- real AWS smoke / deploy / benchmark execution: 未実施。外部環境を変更しない refactor validation に限定。

## 7. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | implementation/local validation と draft PR/label/AC/self-review を完了。final-head CI は lifecycle commit 後に外部確認 |
| 制約遵守 | 5/5 | #387/#339 の semantic scope を避け、merge/deploy/release 未実施 |
| 成果物品質 | 4.5/5 | guard が配置ミスを検出し修復、公開 contract と security projection を維持 |
| 説明責任 | 5/5 | 初期 failure、generated 差分、残リスクを記録 |
| 検収容易性 | 5/5 | task/設計/test/report と PR #393 の日本語 evidence を対応付けた |

**総合fit: 4.9/5（約98%）**

repository deliverable、local validation、draft PR の受け入れ証跡は満たした。report を含む lifecycle commit を final head として push した後、GitHub Actions、Issue #359 進捗 comment、CLEAN/upstream 一致を外部 gate として確認する。

## 8. 未対応・制約・リスク

- conversation history の subservice 抽出は #387 の contract 方針確定後の別 PR とする。
- document/folder visibility callback は既存 facade method を経由する互換 seam であり、domain 間依存の最終分離ではない。
- source line/call graph の再生成で generated API docs 312 files が更新され、#387 との機械的 conflict が起こり得る。semantic review を伴う merge 順管理が必要。
- real AWS smoke は未実施。外部 AWS state を変更する validation は本 refactor の範囲外。
- GitHub Apps の callable capability が本セッションになかったため、認証済み `gh` fallback を使用し、理由を PR 本文に記録した。
- merge / deploy / release は実施しない。

## 10. PR lifecycle 証跡

- 実装 commit: `4a6344b7`
- stacked draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/393
- base: `codex/issue-359-service-characterization`（PR #390 branch）
- label: `semver:patch`
- 日本語 AC comment: https://github.com/tsuji-tomonori/rag-assist/pull/393#issuecomment-4997810997
- 日本語 self-review comment: https://github.com/tsuji-tomonori/rag-assist/pull/393#issuecomment-4997810999
- final-head CI と Issue #359 進捗 comment は、この report を含む lifecycle commit push 後に確認・投稿する。

## 9. 次に改善できること

- #387 の contract 結論後に conversation history を別 narrow-port domain として抽出する。
- document/folder visibility を専用の authorization-aware query port へ分離するか、後続 dependency graph で判断する。
