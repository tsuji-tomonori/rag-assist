# 担当者へ送信ボタンラベル色の修正

状態: do

## 背景

`QuestionEscalationPanel` の送信エリアには、補助テキストの直下 `span` と送信ボタン内ラベルの `span` がある。`apps/web/src/styles/features/chat.css` の `.question-form-actions span` が子孫の `span` 全体に適用され、青い送信ボタン内の文字色まで補助テキスト用のグレーになる。

## 目的

補助テキスト用スタイルの適用範囲を直下 `span` に限定し、送信ボタン内ラベルはボタンの文字色を継承する状態に戻す。

## タスク種別

修正

## なぜなぜ分析サマリ

- confirmed: `QuestionEscalationPanel` の `.question-form-actions` 直下に補助テキスト `span` があり、同じ領域の `button` 内にもラベル `span` がある。
- confirmed: `chat.css` に `.question-form-actions span` があり、子孫 `span` すべてへ `color: #68758f` を適用している。
- confirmed: `button` 自体は `color: #fff` と `background: #2f6fed` を持つため、意図されるラベル色は白。
- inferred: CSS セレクタが直下要素に限定されていないため、ボタン内ラベルが補助テキスト用スタイルを継承せず上書きされる。
- open_question: 実ブラウザでの全ビューポート確認は未実施。今回は単体テストと CSS 差分確認を主検証にする。
- root cause: 補助テキスト専用の CSS セレクタが `.question-form-actions span` と広すぎ、ボタン内部の構造へ侵食していた。
- remediation: セレクタを `.question-form-actions > span` に限定し、`.question-form-actions button span` で `color: inherit` などの継承を明示する。関連する responsive 側の補助テキスト指定も直下指定へ揃える。

## スコープ

- `QuestionEscalationPanel` 送信エリアの CSS 修正
- CSS セレクタの回帰テスト追加
- 送信ボタン enabled 状態のコンポーネントテスト追加

## 実装計画

1. `chat.css` の `.question-form-actions span` を直下 `span` 対象に変更する。
2. `chat.css` にボタン内 `span` が `button` の文字スタイルを継承するルールを追加する。
3. `responsive.css` の `.question-form-actions span` も直下 `span` に限定する。
4. CSS ファイル内容と `QuestionEscalationPanel` の enabled 状態を検証するテストを追加する。

## ドキュメント保守計画

ユーザー可視 UI の不具合修正だが、挙動仕様や操作手順の変更ではないため、README や `docs/` の更新は不要と判断する。作業記録は `reports/working/` に残す。

## 受け入れ条件

- `apps/web/src/styles/features/chat.css` に `.question-form-actions span` が残らず、`.question-form-actions > span` が存在する。
- `apps/web/src/styles/features/chat.css` の `.question-form-actions button span` に `color: inherit` が定義される。
- `QuestionEscalationPanel` の送信ボタンは `sourceQuestion` を持つ message で入力済みなら disabled ではない。

## 検証計画

- `npm run test -w @memorag-mvp/web -- QuestionEscalationPanel`
- `npm run typecheck -w @memorag-mvp/web`
- `git diff --check`

## PR レビュー観点

- CSS の適用範囲が補助テキストだけに絞れていること。
- ボタン内の `span` が補助テキスト用フォント指定を受けないこと。
- テストが CSS セレクタの回帰を検出できること。

## リスク

- CSS テキスト検査は実ブラウザのカスケード計算そのものではない。ただし今回の根本原因はセレクタ文字列の過剰適用であり、単体テストで十分に検出可能と判断する。
