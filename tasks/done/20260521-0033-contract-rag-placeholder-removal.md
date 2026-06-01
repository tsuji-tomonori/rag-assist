# PR329 contract RAG placeholder 削除

状態: done

タスク種別: 修正

## 背景

PR #329 の再レビューで、RAG contract 本物化を今回 scope 外にしたにもかかわらず、`packages/contract/src/rag/**` に id/version 中心の placeholder contract が残っていると指摘された。

## 目的

今回の PR を既存 RAG 実装の runtime layout 移設に絞り、未実装の RAG contract placeholder を contract package の source tree / typecheck / build 対象から外す。

## なぜなぜ分析サマリ

- confirmed: `packages/contract/src/index.ts` から `./rag/index.js` の root export は削除済み。
- confirmed: `packages/contract/src/rag/**` には placeholder contract files が残っている。
- confirmed: `packages/contract/tsconfig.json` は `src/**/*.ts` を対象にするため、root export されなくても source tree / typecheck 対象には残る。
- inferred: 前回対応は package root API からの公開抑止に寄り、source tree に残る placeholder 自体を scope 外として削除する観点が不足していた。
- root cause: 「公開 API ではないこと」と「未実装 placeholder を PR scope から外すこと」を同一視したため、未実装 contract source が残った。
- remediation: `packages/contract/src/rag/**` を削除し、`rag-contract-public-export.test.ts` で `src/rag` が存在しないことを検証する。

## スコープ

- `packages/contract/src/rag/**` の削除
- contract package の placeholder 残存検出テスト更新
- contract test / typecheck
- PR コメント、作業レポート、task 完了更新

## スコープ外

- RAG contract の本物化。既存 `schemas/chat.ts` と整合する実契約設計は後続 PR とする。

## 実装計画

- `packages/contract/src/rag/**` を削除する。
- `packages/contract/src/rag-contract-public-export.test.ts` に `src/rag` ディレクトリ非存在の検証を追加する。
- contract の test / typecheck を実行する。

## ドキュメント保守計画

- PR 本文の scope 外説明と整合するよう、必要なら PR コメントで削除方針を補足する。
- runtime docs / API docs の仕様変更はない。

## 受け入れ条件

- `packages/contract/src/rag/**` が削除される。
- contract package の単体テストで `packages/contract/src/rag` が残っていないことを検出する。
- `npm test -w @memorag-mvp/contract` が pass する。
- `npm run typecheck -w @memorag-mvp/contract` が pass する。

## 検証計画

- `npm test -w @memorag-mvp/contract`
- `npm run typecheck -w @memorag-mvp/contract`
- `git diff --check`

## PR レビュー観点

- placeholder contract を root export から外すだけでなく source tree から削除できているか。
- 後続 PR で本物の RAG contract を設計する余地を残しているか。
- 未実施の本物化を実施済みとして書いていないか。

## リスク

- contract package 内で `src/rag/**` を参照する import が残っている場合、typecheck で検出される。
- RAG contract 本物化は後続 scope なので、今回の削除により将来の設計タスクは別途必要。

## 完了結果

- `packages/contract/src/rag/**` の placeholder contract files を削除した。
- `packages/contract/src/rag-contract-public-export.test.ts` で `src/rag` ディレクトリが残らないことを検証するようにした。
- PR #329 に受け入れ条件確認コメントとセルフレビューコメントを投稿した。

## 実行した検証

- `npm test -w @memorag-mvp/contract`: pass
- `npm run typecheck -w @memorag-mvp/contract`: pass
- `git diff --check`: pass
- `test ! -d packages/contract/src/rag`: pass
