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

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | button | チャットへ戻る | チャットへ戻る (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onBack | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:113 | confirmed |
| AssigneeWorkspace | button | `${question.title}を選択` | `${question.title}を選択` (aria-label) | aria-pressed=selected?.questionId === question.questionId | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onSelect(question.questionId) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:161 | confirmed |
| AssigneeWorkspace | button | 下書き保存 | 下書き保存 (visible-text) | disabled=loading \|\| !isDirty | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onSaveDraft | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:233 | confirmed |
| AssigneeWorkspace | button | loading && <LoadingSpinner className="button-spinner" /> / 回答を送信 | loading && <LoadingSpinner className="button-spinner" /> / 回答を送信 (visible-text) | disabled=loading \|\| !answerTitle.trim() \|\| !answerBody.trim() | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:234 | confirmed |

## フォーム

| コンポーネント | ラベル | 説明参照 | a11y | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / isDirty ? "未保存の変更があります"… | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onSubmit | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:207 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | アクセシブル名 | 説明参照 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | select | statusFilter | すべて / ASSIGNEE_LANES.map((lane) => ( <option key={lane.id} value={lane.id}>{lane.labe… (visible-text) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setStatusFilter(event.target.value as AssigneeLaneId \| "all") | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:128 | confirmed |
| AssigneeWorkspace | input | タイトル・名前・部署で検索 | タイトル・名前・部署で検索 (placeholder) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setSearchQuery(event.target.value) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:137 | confirmed |
| AssigneeWorkspace | input | answerTitle | 回答タイトル (label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setAnswerTitle(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:211 | confirmed |
| AssigneeWorkspace | textarea | answerBody | 回答内容 (label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setAnswerBody(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:215 | confirmed |
| AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | 資料名、URL、またはナレッジリンク (placeholder) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setReferences(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:219 | confirmed |
| AssigneeWorkspace | textarea | internalMemo | 内部メモ (label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setInternalMemo(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:223 | confirmed |
| AssigneeWorkspace | input | 質問者へ通知する | 質問者へ通知する (label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setNotifyRequester(event.target.checked); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:226 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AssigneeWorkspace | button | チャットへ戻る | チャットへ戻る (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onBack | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:113 | confirmed |
| AssigneeWorkspace | label | ステータス / すべて / ASSIGNEE_LANES.map((lane) => ( <option key={lane.id} value={lane.… | ステータス / すべて / ASSIGNEE_LANES.map((lane) => ( <option key={lane.id} value={lane.id}>{lane.labe… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:126 | confirmed |
| AssigneeWorkspace | select | statusFilter | すべて / ASSIGNEE_LANES.map((lane) => ( <option key={lane.id} value={lane.id}>{lane.labe… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setStatusFilter(event.target.value as AssigneeLaneId \| "all") | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:128 | confirmed |
| AssigneeWorkspace | option | all | すべて (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:129 | confirmed |
| AssigneeWorkspace | option | lane.id | lane.label (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:131 | confirmed |
| AssigneeWorkspace | label | 検索 | 検索 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:135 | confirmed |
| AssigneeWorkspace | input | タイトル・名前・部署で検索 | タイトル・名前・部署で検索 (placeholder) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setSearchQuery(event.target.value) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:137 | confirmed |
| AssigneeWorkspace | button | `${question.title}を選択` | `${question.title}を選択` (aria-label) | aria-pressed=selected?.questionId === question.questionId | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onSelect(question.questionId) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:161 | confirmed |
| AssigneeWorkspace | form | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / isDirty ? "未保存の変更があります"… | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / isDirty ? "未保存の変更があります" : draftSavedAt ? `下書きを保存済み（${formatDate… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onSubmit | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:207 | confirmed |
| AssigneeWorkspace | label | 回答タイトル | 回答タイトル (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:209 | confirmed |
| AssigneeWorkspace | input | answerTitle | 回答タイトル (label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setAnswerTitle(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:211 | confirmed |
| AssigneeWorkspace | label | 回答内容 | 回答内容 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:213 | confirmed |
| AssigneeWorkspace | textarea | answerBody | 回答内容 (label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setAnswerBody(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:215 | confirmed |
| AssigneeWorkspace | label | 参照資料 / 関連リンク | 参照資料 / 関連リンク (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:217 | confirmed |
| AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | 資料名、URL、またはナレッジリンク (placeholder) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setReferences(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:219 | confirmed |
| AssigneeWorkspace | label | 内部メモ | 内部メモ (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:221 | confirmed |
| AssigneeWorkspace | textarea | internalMemo | 内部メモ (label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setInternalMemo(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:223 | confirmed |
| AssigneeWorkspace | label | 質問者へ通知する | 質問者へ通知する (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:225 | confirmed |
| AssigneeWorkspace | input | 質問者へ通知する | 質問者へ通知する (label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { setNotifyRequester(event.target.checked); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:226 | confirmed |
| AssigneeWorkspace | button | 下書き保存 | 下書き保存 (visible-text) | disabled=loading \|\| !isDirty | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onSaveDraft | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:233 | confirmed |
| AssigneeWorkspace | button | loading && <LoadingSpinner className="button-spinner" /> / 回答を送信 | loading && <LoadingSpinner className="button-spinner" /> / 回答を送信 (visible-text) | disabled=loading \|\| !answerTitle.trim() \|\| !answerBody.trim() | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:234 | confirmed |
