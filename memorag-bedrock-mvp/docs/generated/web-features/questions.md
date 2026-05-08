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

| コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- |
| AssigneeWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/questions/components/AssigneeWorkspace.tsx | AssigneeWorkspace | Icon, LoadingSpinner, LoadingStatus, aside, button, dd, div, dl, dt, form, h2, h3, h4, header, input, label, option, p, section, select, span, strong, textarea, time |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | button | チャットへ戻る | onClick=onBack | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:113 | confirmed |
| AssigneeWorkspace | button | / / （ / ） | onClick=() => onSelect(question.questionId) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:161 | confirmed |
| AssigneeWorkspace | button | 下書き保存 | onClick=onSaveDraft | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:231 | confirmed |
| AssigneeWorkspace | button | 回答を送信 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:232 | confirmed |

## フォーム

| コンポーネント | ラベル | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- |
| AssigneeWorkspace | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信 | onSubmit=onSubmit | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:205 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | select | statusFilter | onChange=(event) => setStatusFilter(event.target.value as AssigneeLaneId \| "all") | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:128 | confirmed |
| AssigneeWorkspace | input | タイトル・名前・部署で検索 | onChange=(event) => setSearchQuery(event.target.value) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:137 | confirmed |
| AssigneeWorkspace | input | answerTitle | onChange=(event) => { setAnswerTitle(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:209 | confirmed |
| AssigneeWorkspace | textarea | answerBody | onChange=(event) => { setAnswerBody(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:213 | confirmed |
| AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | onChange=(event) => { setReferences(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:217 | confirmed |
| AssigneeWorkspace | textarea | internalMemo | onChange=(event) => { setInternalMemo(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:221 | confirmed |
| AssigneeWorkspace | input | 未推定 | onChange=(event) => { setNotifyRequester(event.target.checked); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:224 | unknown |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | button | チャットへ戻る | onClick=onBack | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:113 | confirmed |
| AssigneeWorkspace | label | ステータス / すべて | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:126 | confirmed |
| AssigneeWorkspace | select | statusFilter | onChange=(event) => setStatusFilter(event.target.value as AssigneeLaneId \| "all") | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:128 | confirmed |
| AssigneeWorkspace | option | all | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:129 | confirmed |
| AssigneeWorkspace | option | lane.id | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:131 | confirmed |
| AssigneeWorkspace | label | 検索 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:135 | confirmed |
| AssigneeWorkspace | input | タイトル・名前・部署で検索 | onChange=(event) => setSearchQuery(event.target.value) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:137 | confirmed |
| AssigneeWorkspace | button | / / （ / ） | onClick=() => onSelect(question.questionId) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:161 | confirmed |
| AssigneeWorkspace | form | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信 | onSubmit=onSubmit | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:205 | confirmed |
| AssigneeWorkspace | label | 回答タイトル | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:207 | confirmed |
| AssigneeWorkspace | input | answerTitle | onChange=(event) => { setAnswerTitle(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:209 | confirmed |
| AssigneeWorkspace | label | 回答内容 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:211 | confirmed |
| AssigneeWorkspace | textarea | answerBody | onChange=(event) => { setAnswerBody(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:213 | confirmed |
| AssigneeWorkspace | label | 参照資料 / 関連リンク | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:215 | confirmed |
| AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | onChange=(event) => { setReferences(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:217 | confirmed |
| AssigneeWorkspace | label | 内部メモ | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:219 | confirmed |
| AssigneeWorkspace | textarea | internalMemo | onChange=(event) => { setInternalMemo(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:221 | confirmed |
| AssigneeWorkspace | label | 質問者へ通知する | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:223 | confirmed |
| AssigneeWorkspace | input | 未推定 | onChange=(event) => { setNotifyRequester(event.target.checked); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:224 | unknown |
| AssigneeWorkspace | button | 下書き保存 | onClick=onSaveDraft | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:231 | confirmed |
| AssigneeWorkspace | button | 回答を送信 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:232 | confirmed |
