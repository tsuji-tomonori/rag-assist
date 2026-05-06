# Resolve main v0.38 conflicts

- 作成日時: 2026-05-06 23:19 JST
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/137
- ブランチ: `codex/benchmark-performance-improvement`

## 受けた指示

PR ブランチの競合を解消する。

## 実施作業

- `origin/main` を取得し、PR ブランチを最新 `origin/main` へ rebase。
- README の benchmark corpus seed 説明を統合し、既存 agent/search suite と `mmrag-docqa-v1` の両方を記載。
- OPERATIONS の benchmark seed 運用説明を統合し、search suite の standard corpus 共有と `mmrag-docqa-v1` の専用 corpus seed を両方維持。
- CodeBuild buildspec で `search-smoke-v1` / `search-standard-v1` は standard corpus、`mmrag-docqa-v1` は MMRAG corpus、Allganize は download corpus を使うよう conflict を解消。
- infra snapshot を rebase 後の buildspec に合わせて再生成。

## 検証

- `rg -n "<<<<<<<|=======|>>>>>>>" memorag-bedrock-mvp .github tasks .gitignore --glob '!reports/**'`: conflict marker なし
- `git diff --check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass, 21 tests
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass, 3 tests
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass, 148 tests

## fit 評価

main 側の MMRAG-DocQA suite 追加と、この PR の search benchmark seed 改善を両立させた。`.codex` は引き続き git 管理から除外されている。

## 未対応・制約・リスク

- AWS / Bedrock 実環境 benchmark はこの conflict 解消では実行していない。
