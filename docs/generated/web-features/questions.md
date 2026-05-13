# Web 機能詳細: 担当者対応

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

担当者が問い合わせを確認し、回答作成、下書き保存、回答送信を行う領域です。

## 関連画面

| 表示名 | view | 画面コンポーネント | 権限条件 | 説明 |
| --- | --- | --- | --- | --- |
| 担当者対応 | assignee | AssigneeWorkspace | canAnswerQuestions | 担当者対応。問い合わせ一覧から質問を選び、回答本文や参考資料を作成します。 |

## コンポーネント

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | AssigneeWorkspace は 担当者対応 領域の 画面または画面内 UI コンポーネント です。関連画面: 担当者対応。 | 画面または画面内 UI コンポーネント | apps/web/src/features/questions/components/AssigneeWorkspace.tsx | AssigneeWorkspace | Icon, LoadingSpinner, LoadingStatus, aside, button, dd, div, dl, dt, form, h2, h3, h4, header, input, label, option, p, section, select, span, strong, textarea, time |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:117 | confirmed |
| AssigneeWorkspace | button | `${question.title}を選択` | 「`${question.title}を選択`」を実行するボタン。 | 状態: aria-pressed=selected?.questionId === question.questionId | onClick=() => onSelect(question.questionId) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:165 | confirmed |
| AssigneeWorkspace | button | 下書き保存 | 「下書き保存」を実行するボタン。 | 状態: disabled=loading \|\| !isDirty | onClick=onSaveDraft | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:237 | confirmed |
| AssigneeWorkspace | button | 回答を送信 | 「回答を送信」を実行するボタン。 | 状態: disabled=loading \|\| !answerTitle.trim() \|\| !answerBody.trim() | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:238 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信 | 「回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:211 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setStatusFilter(event.target.value as AssigneeLaneId \| "all") | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:132 | confirmed |
| AssigneeWorkspace | input | タイトル・名前・部署で検索 | 「タイトル・名前・部署で検索」を入力または選択する項目。 | - | onChange=(event) => setSearchQuery(event.target.value) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:141 | confirmed |
| AssigneeWorkspace | input | 回答タイトル | 「回答タイトル」を入力または選択する項目。 | - | onChange=(event) => { setAnswerTitle(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:215 | confirmed |
| AssigneeWorkspace | textarea | 回答内容 | 「回答内容」を複数行で入力する項目。 | - | onChange=(event) => { setAnswerBody(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:219 | confirmed |
| AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | 「資料名、URL、またはナレッジリンク」を入力または選択する項目。 | - | onChange=(event) => { setReferences(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:223 | confirmed |
| AssigneeWorkspace | textarea | 内部メモ | 「内部メモ」を複数行で入力する項目。 | - | onChange=(event) => { setInternalMemo(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:227 | confirmed |
| AssigneeWorkspace | input | 質問者へ通知する | 「質問者へ通知する」を入力または選択する項目。 | - | onChange=(event) => { setNotifyRequester(event.target.checked); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:230 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:117 | confirmed |
| AssigneeWorkspace | label | ステータス / すべて | 「ステータス / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:130 | confirmed |
| AssigneeWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setStatusFilter(event.target.value as AssigneeLaneId \| "all") | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:132 | confirmed |
| AssigneeWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:133 | confirmed |
| AssigneeWorkspace | option | ステータス / すべて | 「ステータス / すべて」を表す option 要素。 | - | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:135 | confirmed |
| AssigneeWorkspace | label | 検索 | 「検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:139 | confirmed |
| AssigneeWorkspace | input | タイトル・名前・部署で検索 | 「タイトル・名前・部署で検索」を入力または選択する項目。 | - | onChange=(event) => setSearchQuery(event.target.value) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:141 | confirmed |
| AssigneeWorkspace | button | `${question.title}を選択` | 「`${question.title}を選択`」を実行するボタン。 | 状態: aria-pressed=selected?.questionId === question.questionId | onClick=() => onSelect(question.questionId) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:165 | confirmed |
| AssigneeWorkspace | form | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信 | 「回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:211 | confirmed |
| AssigneeWorkspace | label | 回答タイトル | 「回答タイトル」に紐づく入力ラベル。 | - | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:213 | confirmed |
| AssigneeWorkspace | input | 回答タイトル | 「回答タイトル」を入力または選択する項目。 | - | onChange=(event) => { setAnswerTitle(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:215 | confirmed |
| AssigneeWorkspace | label | 回答内容 | 「回答内容」に紐づく入力ラベル。 | - | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:217 | confirmed |
| AssigneeWorkspace | textarea | 回答内容 | 「回答内容」を複数行で入力する項目。 | - | onChange=(event) => { setAnswerBody(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:219 | confirmed |
| AssigneeWorkspace | label | 参照資料 / 関連リンク | 「参照資料 / 関連リンク」に紐づく入力ラベル。 | - | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:221 | confirmed |
| AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | 「資料名、URL、またはナレッジリンク」を入力または選択する項目。 | - | onChange=(event) => { setReferences(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:223 | confirmed |
| AssigneeWorkspace | label | 内部メモ | 「内部メモ」に紐づく入力ラベル。 | - | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:225 | confirmed |
| AssigneeWorkspace | textarea | 内部メモ | 「内部メモ」を複数行で入力する項目。 | - | onChange=(event) => { setInternalMemo(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:227 | confirmed |
| AssigneeWorkspace | label | 質問者へ通知する | 「質問者へ通知する」に紐づく入力ラベル。 | - | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:229 | confirmed |
| AssigneeWorkspace | input | 質問者へ通知する | 「質問者へ通知する」を入力または選択する項目。 | - | onChange=(event) => { setNotifyRequester(event.target.checked); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:230 | confirmed |
| AssigneeWorkspace | button | 下書き保存 | 「下書き保存」を実行するボタン。 | 状態: disabled=loading \|\| !isDirty | onClick=onSaveDraft | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:237 | confirmed |
| AssigneeWorkspace | button | 回答を送信 | 「回答を送信」を実行するボタン。 | 状態: disabled=loading \|\| !answerTitle.trim() \|\| !answerBody.trim() | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:238 | confirmed |
