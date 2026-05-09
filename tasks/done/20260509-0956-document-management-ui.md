# ドキュメント管理UI調整

## 背景

画像で示されたドキュメント管理画面に対して、現行UIにはフォルダ検索がなく、左ペイン下部に `登録済みドキュメント`、`チャンク`、`メモリカード` の余分な集計表示が残っている。また、中央ペイン見出しに `+` と共有ボタンがない。

## 目的

ドキュメント管理画面を画像の構成に近づけ、フォルダ検索、中央ペイン操作、余分な集計表示の削除を行う。

## スコープ

- 対象: `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- 対象: `memorag-bedrock-mvp/apps/web/src/styles/features/documents.css`
- 対象: `memorag-bedrock-mvp/apps/web/src/styles/responsive.css`
- 対象: 関連 unit test / visual regression fixture の必要最小更新

## 計画

1. フォルダ検索 state と入力欄を追加する。
2. 検索語に応じてフォルダツリーのグループ表示を絞り込む。
3. 左ペイン下部の余分な集計カードを削除する。
4. 中央ペイン見出し右に `+` と共有アイコンボタンを追加し、既存フォームへフォーカスする実操作に接続する。
5. CSS と responsive を調整する。
6. unit test を更新し、対象検証を実行する。

## ドキュメントメンテナンス計画

ユーザー可視UIの構成変更だが、API、権限、運用手順、永続仕様の変更は伴わない想定。README / `memorag-bedrock-mvp/docs` は関連記載を検索し、操作説明が存在しなければ更新不要として作業レポートに理由を記録する。

## 受け入れ条件

- フォルダ検索入力でフォルダ名を絞り込める。
- 検索結果が空の場合、固定フォルダを出さず空状態を表示する。
- 左ペイン下部に `登録済みドキュメント`、`チャンク`、`メモリカード` の集計カードが表示されない。
- 中央ペインの見出し右側に `+` と共有アイコンボタンが表示される。
- `+` ボタンはアップロード操作へ、共有ボタンは共有設定操作へ到達できる。
- 本番UIに固定フォルダ、固定件数、架空容量、架空共有先、未実装操作ボタンを追加しない。
- 既存のアップロード、フォルダ作成、共有更新、削除、再インデックス操作が壊れない。
- 対象 unit test と差分チェックが pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace`
- `git diff --check`
- 必要に応じて web typecheck または visual regression の対象確認

## PRレビュー観点

- 画像に近い構成になっているか。
- 本番UIに固定値や見せかけデータが混入していないか。
- アイコンボタンに accessible name と実処理があるか。
- モバイル幅で操作要素が重ならないか。

## リスク

- 画像にある右ペインの共有編集 UI は現行APIの共有フォーム範囲に合わせるため、見た目の完全一致ではなく既存機能を保つ調整になる。
- visual regression snapshot が既存基準と差分になる可能性がある。

## PR

- https://github.com/tsuji-tomonori/rag-assist/pull/211
- 受け入れ条件確認コメント: 投稿済み

## 状態

done
