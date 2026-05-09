# チャット添付メニュー hover 改善

状態: done

## 背景

チャット入力欄のファイル添付ボタンにマウスオーバーすると選択肢が表示されるが、ボタンから選択肢へカーソルを移動する途中でメニューが消え、項目を選びにくい。現状の添付メニューは CSS hover だけで表示され、ボタンとメニューの間に隙間がある。

## 目的

添付ボタンから表示される選択肢を、マウス・キーボード・タッチで押しやすくし、ファイルアップロード導線を明確にする。

## 範囲

- 対象: `memorag-bedrock-mvp/apps/web/src/features/chat/components/ChatComposer.tsx`
- 対象: `memorag-bedrock-mvp/apps/web/src/styles/features/chat.css`
- 必要に応じて web UI test / generated UI docs の更新を行う。
- API、認証、RAG 検索ロジック、文書管理画面は対象外。

## 実装計画

1. 添付ボタン周辺の DOM を、hover だけに依存しない実操作可能なメニュー構造へ変える。
2. ファイルアップロード項目は実際の file input と紐づく操作として押せるようにする。
3. フォルダ項目は現時点で変更ハンドラがないため、現在の参照フォルダを示す非破壊の status 項目として扱う。
4. メニューとトリガーの間の hover 切れを防ぐ CSS に調整する。
5. focus-visible、disabled、responsive 幅のスタイルを確認する。

## ドキュメント保守計画

- README や運用手順の更新は不要見込み。理由: API やセットアップ手順ではなく、既存チャット UI の操作性改善に限定されるため。
- generated web UI inventory / accessibility docs がテストや generator の対象であれば更新する。
- 作業完了レポートを `reports/working/` に残す。

## 受け入れ条件

1. 添付ボタンを hover した後、表示されたメニューへポインタを移動してもすぐ消えない。
2. 「ファイルをアップロード」項目を押して file input を操作できる。
3. キーボード focus でも添付メニューが表示され、focus が見える。
4. loading / disabled 時に添付操作が誤って実行されない。
5. 320px 付近の狭い幅でもメニューが画面外にはみ出しにくい。
6. 既存のファイル添付 upload flow のテストが通る。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- generated web UI docs が差分検出する場合は `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`

## PR レビュー観点

- hover gap の解消が CSS 上明確か。
- 実装されていない操作を本番 UI に見せていないか。
- keyboard / touch target / disabled state が妥当か。
- docs と実装の同期が必要な generated docs を残していないか。

## リスク

- 既存テストが `title="資料を添付"` の label 配下 input を直接探しているため、DOM 構造変更に合わせたテスト更新が必要になる可能性がある。
- フォルダ選択の変更ハンドラが `ChatComposer` にないため、今回の変更ではフォルダ切替操作そのものは追加しない。
