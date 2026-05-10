# 破壊的・高コスト操作の確認ダイアログ

## 背景

UI 改善ロードマップの P0 として、履歴削除、管理ユーザー操作、alias 公開/無効化、benchmark 起動など、破壊的または高コストな操作に確認と影響説明を追加する。

## 目的

誤操作を防ぎ、利用者が対象・影響・復元可否を理解してから実行できる UI にする。

## スコープ

- 共通 `ConfirmDialog` コンポーネントの追加。
- 履歴削除の確認。
- benchmark 起動の確認。
- 管理ユーザー停止/削除の確認。
- alias 公開/無効化の確認。
- 対象 UI テストと生成インベントリ更新。

## 非スコープ

- Undo toast の永続化。
- 文書削除 hook の `window.confirm` 置換。
- reindex cutover / rollback の確認導入。
- 監査ログの理由入力。

## 実施計画

1. 既存の操作 handler とテストを確認する。
2. 共通 `ConfirmDialog` を作成する。
3. History / Benchmark / Admin の対象操作に適用する。
4. 対象テストを更新し、確認前に handler が呼ばれないこと、確認後に呼ばれることを検証する。
5. web inventory を更新する。
6. web test / typecheck / lint / inventory check を実行する。

## ドキュメント保守計画

生成インベントリは UI 操作要素が変わるため更新する。耐久 docs は API や運用手順を変えないため不要と判断する。

## 受け入れ条件

- [x] 履歴削除は専用確認ダイアログで対象会話と復元不可を表示し、確認するまで削除 handler を呼ばない。
- [x] benchmark 起動は専用確認ダイアログで suite / model / concurrency とコスト・時間影響を表示し、確認するまで起動 handler を呼ばない。
- [x] ユーザー停止/削除は対象ユーザーと影響を表示し、確認するまで status handler を呼ばない。
- [x] alias 公開/無効化は対象操作の影響を表示し、確認するまで publish/disable handler を呼ばない。
- [x] 確認ダイアログはキーボード操作で閉じられ、busy 中は二重実行を防ぐ。
- [x] 対象 web test、typecheck、lint、web inventory check が pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run lint`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- 既存の権限判定と disabled 条件を弱めていないこと。
- 確認前に高リスク操作が発火しないこと。
- 確認文が架空の件数・コストを表示せず、実 props や正直な影響説明に留まること。

## リスク

- Undo toast や理由入力は未対応のため、完全な誤操作復旧までは次タスクが必要。
- 既存の文書削除 `window.confirm` は今回の scope 外に残る。

## 完了メモ

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/236
- 受け入れ条件確認コメント: 投稿済み
- セルフレビューコメント: 投稿済み

状態: done
