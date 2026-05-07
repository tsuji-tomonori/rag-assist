# benchmark CI typecheck failure 修正

状態: done

## 背景

PR #149 の MemoRAG CI で `@memorag-mvp/benchmark` の typecheck と build が失敗した。ユーザー提示の CI 結果では他 workspace は成功しており、失敗範囲は benchmark に限定されている。

## 目的

benchmark workspace の TypeScript compile error を修正し、PR CI が通る状態へ戻す。

## スコープ

- `memorag-bedrock-mvp/benchmark/search-run.test.ts`
- 作業完了レポート
- PR 更新コメント

## 計画

1. benchmark typecheck/build の失敗をローカルで再現する。
2. 重複した test helper 宣言を削除する。
3. benchmark の typecheck/build/test を再実行する。
4. 作業レポート、commit、push、PR 更新コメントを行う。

## 受け入れ条件

- `npm run typecheck -w @memorag-mvp/benchmark` が成功する。
- `npm run build -w @memorag-mvp/benchmark` が成功する。
- benchmark test が成功する。
- 修正が重複 helper 削除に限定され、benchmark ロジックや dataset 固有分岐を変更しない。
- PR に未実施検証と制約を明記する。

## 検証計画

- `npm run typecheck -w @memorag-mvp/benchmark`
- `npm run build -w @memorag-mvp/benchmark`
- `npm test -w @memorag-mvp/benchmark`
- `git diff --check`

## リスク

- `gh` token が無効なため Actions log の直接取得はできない。ユーザー提示の CI summary とローカル再現結果を根拠に修正する。
