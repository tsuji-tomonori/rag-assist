# 作業完了レポート

保存先: `reports/working/20260716-1933-issue-359-contract-dts-shims.md`

## 1. 受けた指示

- Issue #359 Phase 1d として `packages/contract/` 直下の手書き `.d.ts` shim 3件を削除する。
- package exports、consumer compile、declaration build、NodeNext import、公開契約、認可型を維持する。
- benchmark / Taskfile 変更を混ぜず、再導入防止 guard を追加する。
- task / report、検証、commit / push、GitHub Apps PR、受け入れ条件・セルフレビューコメント、task done 更新まで進める。
- merge / deploy / release は行わない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 3つの手書き declaration shim を削除 | 高 | 対応済み |
| R2 | 公開 package subpath と consumer compile を維持 | 高 | 対応済み・検証済み |
| R3 | declaration build と NodeNext `.js` specifier を維持 | 高 | 対応済み・検証済み |
| R4 | shim 再導入 guard を追加 | 高 | 対応済み・検証済み |
| R5 | benchmark / Taskfile 変更を分離 | 高 | 対応済み |
| R6 | root CI と docs check を成功させる | 高 | 対応済み |
| R7 | PR lifecycle を完了 | 高 | PR 作成前のため継続中 |

## 3. 検討・判断したこと

- `src/access-control.ts`、`src/rag-quality-control.ts`、`src/infra.ts` を唯一の正規型定義とした。
- NodeNext / Bundler consumer には `exports.types`、legacy `moduleResolution: Node` の CommonJS infra consumer には `typesVersions` を使用し、既存 subpath import を維持した。
- `exports.types` のみでは infra が package exports を解釈せず TS2307 になったため、`typesVersions` は必要と判断した。追加後の resolution trace で正規 source 解決を確認した。
- guard test は root shim 不在だけでなく、manifest mapping と NodeNext `.js` re-export を同時に検査し、削除後の契約経路を固定した。
- 公開 import、symbol、挙動、運用手順は変わらないため、README / `docs/` の恒久文書は更新せず、task / report / PR に構造変更を記録する方針とした。

## 4. 実施した作業

- 参照グラフ、package exports、consumer resolver、git history、open PR overlap を調査した。
- `packages/contract/package.json` の3 subpath を正規 source へ接続した。
- root-level `.d.ts` 3件を削除した。
- `packages/contract/src/package-subpath/exports.test.ts` を追加した。
- contract 全 test、typecheck、declaration build、全 consumer typecheck、infra build、root CI、docs check を実行した。
- `dist/index.d.ts` の `.js` re-export と3 declaration output を検査した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `packages/contract/package.json` | JSON | 正規 subpath 型解決 | R2 / R3 |
| `packages/contract/src/package-subpath/exports.test.ts` | TypeScript test | shim 再導入・mapping・NodeNext guard | R4 |
| 対象3 `.d.ts` の削除 | Git deletion | 重複した手書き型の除去 | R1 |
| `tasks/do/20260716-1918-issue-359-contract-dts-shims.md` | Markdown | RCA、受け入れ条件、検証証拠 | workflow |
| 本レポート | Markdown | 作業・fit・リスク記録 | workflow |

## 6. 実行した検証

- `node --import tsx --test "packages/contract/src/**/*.test.ts"`: pass（5 files）
- `npm run typecheck -w @memorag-mvp/contract`: pass
- `npm run build -w @memorag-mvp/contract`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/infra`: pass
- `npm run typecheck -w @memorag-mvp/benchmark`: pass
- `npm run build -w @memorag-mvp/infra`: pass
- `npm run ci`: pass
- `task docs:check`: pass
- `git diff --check`: pass
- `tsc -p infra/tsconfig.json --noEmit --traceResolution`: `typesVersions` により正規 `src/access-control.ts` / `src/infra.ts` を解決することを確認
- declaration inspection: `dist/index.d.ts` の `access-control.js` / `rag-quality-control.js` / `infra.js` と3 declaration output を確認

初回検証では、共有 root の workspace symlink が元 worktree の contract を参照し、API dependency も不足していたため consumer compile が失敗した。専用 worktree で `npm install` して現在の branch を解決対象にした後、全 targeted check と root CI が成功した。`npm install` は lockfile 差分を生成しなかった。

## 7. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.7/5 | 実装・検証済み。PR lifecycle はこれから実施 |
| 制約遵守 | 5/5 | benchmark / Taskfile /挙動変更を含めず、merge等も未実施 |
| 成果物品質 | 4.9/5 | resolver 差を比較検証し、再導入 guard を追加 |
| 説明責任 | 4.9/5 | 初回失敗、修復、open PR 競合、audit を明記 |
| 検収容易性 | 4.9/5 | task、test、report、コマンド結果を対応付けた |

**総合fit: 4.8/5（約96%）**

理由: 実装と要求範囲のローカル検証は完了した。PR 作成・コメント・task done 更新は workflow 後半として継続する。

## 8. 未対応・制約・リスク

- 未対応: PR 作成、受け入れ条件コメント、セルフレビューコメント、task done 更新は本レポート作成時点では未実施。
- 制約: GitHub Actions の新規 PR head 結果は PR 作成後まで未確認。
- 競合リスク: open PR #339 は `packages/contract/infra.d.ts` を変更し、2026-06-01 更新の head は現在 `CONFLICTING` である。後発の PR #357 は merge 済みで usage/cost 実装を main に収束しているため、#339 の内容は実質的に置き換えられた可能性が高いが、close/supersede は reviewer 判断であり断定しない。#339 を再利用する場合は `src/infra.ts` の現行型を正として競合解消する必要がある。
- dependency audit: `npm install` は8件（low 2 / moderate 1 / high 5）を報告した。lockfile を変える dependency remediation は本 task 対象外。
- 既存警告: Web build の 500 kB 超 chunk と infra bundle size warning は root CI を失敗させていない。

## 9. 次に行うこと

- 規約準拠 commit / push と GitHub Apps PR 作成を行う。
- PR へ受け入れ条件結果とセルフレビュー結果を日本語で投稿する。
- task を `tasks/done/` に移し、report の PR lifecycle 状態を更新して追加 commit / push する。
