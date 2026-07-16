# Issue #359 contract 手書き declaration shim 削除

- 状態: do
- タスク種別: 修正
- 対象 Issue: #359 Phase 1d
- branch: `codex/issue-359-contract-dts-shims`
- base: `origin/main`

## 背景

`packages/contract/` 直下にある `access-control.d.ts`、`rag-quality-control.d.ts`、`infra.d.ts` は、`src/` 配下の正規 TypeScript source とは別に package subpath の型解決を成立させる手書き declaration shim である。特に `infra.d.ts` は `src/infra.ts` と同じ型を複製しており、正規実装の変更時に二重更新が必要になっている。

## 目的

公開 subpath、認可型、RAG 品質型、infra runtime env 型、NodeNext `.js` import、consumer compile を維持しながら、3つの手書き `.d.ts` shim を削除し、正規 source を唯一の型定義にする。

## スコープ

- `packages/contract/access-control.d.ts` の削除
- `packages/contract/rag-quality-control.d.ts` の削除
- `packages/contract/infra.d.ts` の削除
- package exports / legacy TypeScript resolver を正規 `src/*.ts` へ接続
- 3 shim の再導入を防ぐ contract guard test
- contract と全 consumer workspace の compile / declaration build 検証

対象外:

- benchmark の構成・fixture・実行契約変更
- `Taskfile.yml` の alias・task 変更
- API、認可、永続化、runtime env の仕様変更
- merge、deploy、release

## なぜなぜ分析

### 問題文

2026-07-16 時点の `origin/main` 由来 branch では、`packages/contract/` 直下に正規 source と重複する3つの手書き declaration shim が存在し、型契約を変更する際に複数箇所の同期が必要である。

### confirmed

- `packages/contract/src/access-control.ts`、`src/rag-quality-control.ts`、`src/infra.ts` が正規実装として存在する。
- `src/index.ts` は NodeNext 用の `.js` specifier で3正規 source を再 export している。
- `package.json#exports` は runtime/import を `src/*.ts` に向ける一方、`types` だけを root の3 shim に向けている。
- `access-control.d.ts` と `rag-quality-control.d.ts` は正規 source への1行 re-export だけである。
- `infra.d.ts` は `src/infra.ts` の型を手書きで複製しており、git history 上も両方を同期更新してきた。
- subpath consumer は API、Web、infra、benchmark に存在する。認可型・定数は runtime と type の両方、infra は type-only で利用される。
- API と benchmark の TypeScript resolver は NodeNext、Web は Bundler、infra は CommonJS + legacy `moduleResolution: Node` である。
- legacy Node resolver は package `exports` を解釈しないため、root shim を単純削除すると infra の subpath compile が失敗し得る。
- open PR #339 は `packages/contract/infra.d.ts` を変更しており、この PR と delete/modify の競合可能性がある。他の open PR には `packages/contract/package.json` と対象3 shim の重複は確認できなかった。

### inferred

- 3 shim は、異なる resolver 設定の consumer に同じ subpath を公開するために追加されたが、正規 source への型解決を manifest で一元化する guard がなかったため残存した。
- `typesVersions` を明示すれば legacy Node resolver を正規 `src/*.ts` へ接続でき、NodeNext/Bundler は `exports.types` で同じ正規 source を解決できる見込みである。

### open_question

- clean install 相当で `typesVersions` と `exports.types` の双方が全 consumer resolver で期待どおり解決されるかは、実変更後の workspace typecheck / build で確定する。
- PR #339 を先に merge する場合、同 PR の `infra.d.ts` 追加分が `src/infra.ts` にも存在することを merge 時に再確認する必要がある。

### root cause

package subpath の型入口が resolver ごとに正規 source へ宣言的に接続されず、root-level `.d.ts` を手書きの互換入口として維持する構成になっていたこと。さらに、shim 再導入を検出する guard がなかったことが流出原因である。

### 削除可能性の証拠

- 3 shim が提供する symbol はすべて `src/access-control.ts`、`src/rag-quality-control.ts`、`src/infra.ts` に存在する。
- `src/index.ts` の正規 re-export は `.js` specifier を維持しており、NodeNext declaration emit の基点が存在する。
- package subpath 名自体は削除せず、`exports` の `types` target のみを正規 source へ移すため、consumer import specifier は不変である。
- legacy resolver には `typesVersions` の明示 mapping を用意し、consumer source の一括 import 変更を避ける。
- contract build の `declaration: true` により、`src/*.ts` から declaration output を生成できる。

## 参照グラフと影響

| 入口 | 正規 source | consumer / resolver | 維持方法 |
|---|---|---|---|
| `@memorag-mvp/contract/access-control` | `src/access-control.ts` | API(NodeNext), Web(Bundler), infra(Node) | `exports.types` + `typesVersions` |
| `@memorag-mvp/contract/rag-quality-control` | `src/rag-quality-control.ts` | API(NodeNext), benchmark(NodeNext) | `exports.types` + `typesVersions` |
| `@memorag-mvp/contract/infra` | `src/infra.ts` | infra(Node, type-only) | `exports.types` + `typesVersions` |
| package root | `src/index.ts` | 全 workspace | 既存 `types` / `exports` を維持 |

NodeNext への影響:

- 正規 source 内の relative import / export は既存の `.js` specifier を変更しない。
- consumer の package subpath specifier は変更しない。
- declaration build 後の `dist/*.d.ts` が `.js` specifier を保持することを確認する。

## 実装計画

1. package subpath の `exports.types` を正規 `src/*.ts` に変更する。
2. legacy Node resolver 向け `typesVersions` を正規 source に追加する。
3. 3 shim を削除する。
4. root shim 不在と manifest mapping を検査する guard test を追加する。
5. targeted contract test/typecheck/declaration build と consumer workspace compile を実行する。
6. root CI、docs check、差分検査を実行し、失敗時は根本原因を修正して再実行する。

## ドキュメント保守計画

公開 import specifier、型、runtime 挙動、運用手順は変更しないため、README / `docs/` の恒久文書更新は不要と判断する。調査根拠、検証結果、競合リスクは本 task md、PR 本文、`reports/working/` に記録する。

## 受け入れ条件

- [ ] `packages/contract/` 直下の対象3 `.d.ts` が削除され、再導入 guard が成功する。
- [ ] `@memorag-mvp/contract/access-control`、`rag-quality-control`、`infra` の公開 subpath が正規 `src/*.ts` へ型解決される。
- [ ] 認可型・定数、RAG 品質型、infra runtime env 型の consumer compile が成功する。
- [ ] contract の test、typecheck、declaration build が成功する。
- [ ] NodeNext `.js` import / declaration specifier が維持される。
- [ ] API、Web、infra、benchmark の targeted typecheck/build が成功する。
- [ ] `npm run ci` と `task docs:check` が成功する。
- [ ] benchmark / `Taskfile.yml` の変更を含めない。
- [ ] work report、規約準拠 commit/push、main 向け PR、受け入れ条件コメント、セルフレビューコメント、task done 更新が完了する。

## 検証計画

- `npm test -w @memorag-mvp/contract`
- `npm run typecheck -w @memorag-mvp/contract`
- `npm run build -w @memorag-mvp/contract`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/infra`
- `npm run typecheck -w @memorag-mvp/benchmark`
- `npm run build -w @memorag-mvp/infra`
- `npm run ci`
- `task docs:check`（実体は `validate_docs.py` と各 docs freshness / hidden Unicode check）
- `git diff --check`
- 対象 path / symbol の `rg` による参照再確認

## PR レビュー観点

- public subpath と symbol shape が変わっていないこと
- CommonJS infra、NodeNext API/benchmark、Bundler Web の resolver 差を全て検証していること
- 認可境界を弱める型変更がないこと
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を含まないこと
- docs と実装に矛盾がないこと

## リスク

- PR #339 と `infra.d.ts` が競合する。merge 順に応じて、正規 `src/infra.ts` の追加型が失われないよう再確認が必要。
- `typesVersions` の resolver 差は narrow contract test だけでなく全 consumer compile で検証する。
- declaration output は build artifact のためコミット対象にせず、生成内容のみ検査する。

## 実施結果（PR 作成前）

- 3 shim を削除し、`exports.types` と `typesVersions` を正規 `src/*.ts` へ接続した。
- `exports.types` のみの状態では、legacy Node resolver の infra consumer が `access-control` / `infra` subpath を解決できず TS2307 となることを確認した。
- `typesVersions` 追加後の `--traceResolution` で、infra consumer が `src/access-control.ts` と `src/infra.ts` を解決することを確認した。
- contract guard は対象3 shim 不在、manifest の正規 source mapping、`src/index.ts` の NodeNext `.js` re-export を検査する。
- `npm run ci`: pass（contract 4 tests、API 801 tests、Web 442 tests、infra 38 tests、benchmark 102 tests、全 workspace typecheck/build を含む）
- `node --import tsx --test "packages/contract/src/**/*.test.ts"`: pass（root-level contract tests を含む5 files）
- `npm run typecheck -w @memorag-mvp/contract`: pass
- `npm run build -w @memorag-mvp/contract`: pass。`dist/index.d.ts` の3つの `.js` re-export と正規 source 由来 declaration output を確認した。
- API / Web / infra / benchmark targeted typecheck: pass
- `npm run build -w @memorag-mvp/infra`: pass
- `task docs:check`: pass（97 APIs / 582 API documents、Web / infra inventory freshness を含む）
- `git diff --check`: pass
- 初回は共有 root の stale workspace symlink / 不足 dependency と `tsx` IPC 制約で失敗したが、専用 worktree で `npm install` 後に root CI を通常権限で再実行し成功した。
- `npm install` は package-lock 差分を生成しなかったが、audit は8件（low 2 / moderate 1 / high 5）を報告した。本 task では dependency 更新を行わない。
