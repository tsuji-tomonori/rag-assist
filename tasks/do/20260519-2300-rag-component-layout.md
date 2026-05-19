# RAG コンポーネント構成整理

状態: do
タスク種別: 機能追加

## 背景

ユーザーから、RAG コンポーネントを runtime 軸の `offline/` と `online/` に分け、その下を `pre-retrieval`、`retrieval`、`post-retrieval`、`generation` の pipeline 軸で整理する構成が提示された。

## 目的

既存実装を破壊せず、今後の RAG 実装移設・拡張に使えるディレクトリとファイルの配置をリポジトリに追加する。

## スコープ

- `apps/api/src/rag/` 配下の責務別構成と README
- `apps/web/src/features/rag/` 配下の UI コンポーネント・ページ配置
- `packages/contract/src/rag/` 配下の契約型配置と package export
- `benchmark/src/rag/` 配下の RAG benchmark 配置
- 作業レポート

## スコープ外

- 既存 RAG 処理の全面移設
- 新規 API route のアプリ本体への接続
- 本番 UI ルーティングへの接続
- 実データ検索・生成ロジックの変更

## 実装計画

- 指定パスに最小の TypeScript module を追加する。
- 共有型・契約型は今後利用しやすいように基礎 type を定義する。
- 未接続のファイルは placeholder 実装として明示し、架空データを本番 UI として表示しない。
- `README.md` に配置方針と既存実装との関係を記載する。

## ドキュメント保守計画

RAG 構成の durable な説明は `apps/api/src/rag/README.md` に追加する。`docs/` は仕様要件の変更ではなく実装配置の足場作成のため更新しない。

## 受け入れ条件

- [x] `apps/api/src/rag/` に指定された `_shared`、`offline`、`online`、`orchestration`、`api`、`__tests__` 構成が存在する。
- [x] `apps/web/src/features/rag/` に指定された components/pages 構成が存在する。
- [x] `packages/contract/src/rag/` に指定された offline/online 契約ファイルと `index.ts` が存在し、package root から export される。
- [x] `benchmark/src/rag/` に指定された offline/online/fixtures 構成が存在する。
- [x] 既存 RAG 実装を削除・破壊しない。
- [x] 最小十分な検証を実行し、未実施の検証があれば理由を記録する。
- [x] 作業完了レポートを `reports/working/` に保存する。

## 検証計画

- `git diff --check`
- `npm run typecheck --workspaces --if-present`

## PR レビュー観点

- 構成がユーザー提示パスと一致していること。
- placeholder が本番経路で架空データを返す形になっていないこと。
- 契約 package の export が TypeScript 解決可能であること。

## リスク

- 大量の placeholder ファイル追加のため、後続実装で実責務を埋める必要がある。
- 既存実装の移設は未実施のため、現時点では新構成と旧フラット実装が併存する。
