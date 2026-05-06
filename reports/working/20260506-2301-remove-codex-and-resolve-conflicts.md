# Remove codex tracking and resolve conflicts

- 作成日時: 2026-05-06 23:01 JST
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/137
- ブランチ: `codex/benchmark-performance-improvement`

## 受けた指示

`.codex` を git 管理しないよう削除し、今後も管理されないよう `.gitignore` に入れる。あわせて PR ブランチの競合を解決する。

## 実施作業

- `origin/main` を取得し、PR ブランチを `origin/main` へ rebase。
- tracked だった `.codex/completion-status.json` を削除し、`.gitignore` を `.codex/` のディレクトリ ignore に更新。
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` の conflict を解消し、main 側の Allganize benchmark suite 分岐と、この PR の search suite corpus seed 条件を両方維持。
- infra snapshot を `UPDATE_SNAPSHOTS=1` で再生成。

## 検証

- `git diff --check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass, 147 tests
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass, 21 tests
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass, 3 tests
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass

## fit 評価

`.codex` は `git ls-files .codex` で出なくなり、今後は `.gitignore` の `.codex/` で無視される。PR ブランチは `origin/main` ベースへ rebase 済みで、CodeBuild buildspec は Allganize と search suite の両方に対応している。

## 未対応・制約・リスク

- rebase により remote branch は履歴更新が必要なため、`--force-with-lease` で push する。
- AWS / Bedrock 実環境 benchmark はこの追加対応では実行していない。
