# ドキュメント管理画面の実データ表示化

保存先: `tasks/done/20260509-0158-document-ui-real-data.md`

状態: done

## 背景

ドキュメント管理画面に、固定フォルダ、固定件数、固定ストレージ容量、推定メモリ量、架空共有メンバーなどのモック表示が残っている。実際の API レスポンスやユーザーの権限状態に合わない表示となり、管理画面として誤解を招く。

## 目的

本番 UI でモックデータを表示しないようにし、`documents`、`documentGroups`、`migrations` などの実データに基づく表示へ修正する。以降同種の実装を防ぐため、リポジトリローカル skill と AGENTS ルールも追加する。

## 対象範囲

- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/documents/types.ts`
- `memorag-bedrock-mvp/apps/web/src/styles/features/documents.css`
- `skills/no-mock-product-ui/SKILL.md`
- `AGENTS.md`
- 作業完了レポート

## 方針

- 本番コンポーネントから固定の業務データ、固定件数、固定容量、架空ユーザー、架空グループを削除する。
- 実 API が持たないストレージ容量の代替値は出さず、登録済み文書数、チャンク数、メモリカード数だけを表示する。
- フォルダは `documentGroups` と「すべてのドキュメント」だけにする。
- 未実装操作は表示しないか、実装済み操作に限定する。
- テストの mock は許容するが、本番経路の fallback と混同しない。

## 必要情報

- `GET /documents` は `DocumentManifest` 配列を返す。
- `DocumentManifest` には `mimeType` が含まれる場合がある。
- 現時点でドキュメント一覧用の実ストレージ容量 API は確認できていない。
- UI 変更は API の認可境界や RAG 回答品質には直接影響しない。

## 実行計画

1. 現在のモック表示箇所を特定する。
2. `DocumentWorkspace` を実データ由来の表示に修正する。
3. ストレージ使用状況の progress 表示を削除する。
4. Web 型定義を API レスポンスに合わせる。
5. 関連テストを更新し、モック表示が残らないことを確認する。
6. `skills/no-mock-product-ui/SKILL.md` と `AGENTS.md` を追加・更新する。
7. 変更範囲に応じた検証を実行する。
8. 作業完了レポートを作成する。
9. commit、push、PR 作成、受け入れ条件コメント、セルフレビューコメントまで進める。

## ドキュメントメンテナンス計画

- ユーザー可視 UI と agent 実装ルールが変わるため、`AGENTS.md` に新 skill の適用条件を追加する。
- `memorag-bedrock-mvp/docs` は API 契約や運用手順を変更しないため更新不要と判断する。
- PR 本文には、ストレージ容量 API がないため固定容量表示を削除したことを記載する。

## 受け入れ条件

- ドキュメント管理画面の本番コンポーネントに固定フォルダ、固定件数、固定容量、架空共有メンバー、推定メモリ量が残っていない。
- ストレージ使用状況のシークバーまたは progress bar が削除されている。
- 文書一覧、フォルダ、共有情報、最近の更新、件数は実 props/API レスポンス由来で表示される。
- 未実装の rename/move などの操作が本番 UI から削除されている。
- モックデータ禁止の repo-local skill が追加され、`AGENTS.md` から参照できる。
- 関連 Web テストと差分チェックが pass している。
- PR に受け入れ条件確認とセルフレビューの日本語コメントがある。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `git diff --check`
- skill frontmatter と `AGENTS.md` の参照先を目視確認する。

## PRレビュー観点

- blocking: 本番 UI に固定業務データや架空値が残っていないこと。
- blocking: 実施していないストレージ容量を実データとして表示していないこと。
- should fix: optional な `mimeType` や group metadata が欠落しても画面が崩れないこと。
- should fix: Web テストが新しい実データ表示ルールを回帰防止していること。
- suggestion: 今後ストレージ容量 API が追加された場合に、別途実データとして表示できる余地があること。

## 未決事項・リスク

- 決定事項: 実ストレージ使用量 API がないため、容量値や使用率は表示しない。
- 決定事項: テスト内の mock data は、本番 fallback ではなくテスト fixture として明示される限り許容する。
- リスク: visual regression の既存スクリーンショットは実行環境が重いため、今回の最小検証では unit/component test と typecheck を優先する。

## 完了メモ

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/209
- 受け入れ条件確認コメント: 投稿済み。
- セルフレビューコメント: 投稿済み。
- 実行した検証:
  - `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
  - `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
  - `git diff --check`: pass
