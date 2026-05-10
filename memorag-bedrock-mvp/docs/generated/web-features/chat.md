# Web 機能詳細: チャット

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

RAG 質問、回答表示、引用、追加確認、担当者エスカレーション、チャット入力を扱う領域です。

## 関連画面

| 表示名 | view | 画面コンポーネント | 権限条件 | 説明 |
| --- | --- | --- | --- | --- |
| チャット | chat | ChatView | - | チャット。利用者が質問し、RAG 回答、引用、確認質問、担当者への問い合わせ導線を確認します。 |

## コンポーネント

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| AnswerCopyAction | AnswerCopyAction は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/answer/AnswerCopyAction.tsx | AnswerCopyAction | Icon, button, div, p, span |
| AnswerText | AnswerText は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/answer/AnswerText.tsx | AnswerText | p |
| CitationList | CitationList は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/answer/CitationList.tsx | CitationList | Icon, a, div, li, span, strong, ul |
| ClarificationOptions | ClarificationOptions は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/answer/ClarificationOptions.tsx | ClarificationOptions | button, div |
| FollowupSuggestions | FollowupSuggestions は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/answer/FollowupSuggestions.tsx | FollowupSuggestions | button, div |
| AssistantAnswer | AssistantAnswer は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/AssistantAnswer.tsx | AssistantAnswer | AnswerCopyAction, AnswerText, CitationList, ClarificationOptions, FollowupSuggestions, QuestionAnswerPanel, QuestionEscalationPanel, div |
| ChatComposer | ChatComposer は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatComposer.tsx | ChatComposer | Icon, LoadingSpinner, button, div, form, input, label, option, select, span, textarea |
| ChatEmptyState | ChatEmptyState は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatEmptyState.tsx | ChatEmptyState | Icon, button, div, h2, section, span |
| ChatRunIdBar | ChatRunIdBar は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatRunIdBar.tsx | ChatRunIdBar | Icon, button, code, div, span |
| ChatView | ChatView は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatView.tsx | ChatView | ChatComposer, ChatRunIdBar, DebugPanel, MessageList, p, section |
| MessageItem | MessageItem は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/MessageItem.tsx | MessageItem | AssistantAnswer, Icon, UserPromptBubble, article, div, span, strong |
| MessageList | MessageList は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/MessageList.tsx | MessageList | ChatEmptyState, LoadingSpinner, MessageItem, ProcessingAnswer, article, div, span, strong |
| ProcessingAnswer | ProcessingAnswer は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ProcessingAnswer.tsx | ProcessingAnswer | LoadingSpinner, div, p, span |
| QuestionAnswerPanel | QuestionAnswerPanel は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx | QuestionAnswerPanel | Icon, LoadingSpinner, button, dd, div, dl, dt, footer, header, p, section, span, strong |
| QuestionEscalationPanel | QuestionEscalationPanel は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx | QuestionEscalationPanel | LoadingSpinner, button, div, form, h3, input, label, option, p, section, select, span, strong, textarea |
| UserPromptBubble | UserPromptBubble は チャット 領域の 画面または画面内 UI コンポーネント です。関連画面: チャット。 | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/UserPromptBubble.tsx | UserPromptBubble | Icon, button, div, p, span |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AnswerCopyAction | button | 回答をコピー済み / 回答をコピー | 「回答をコピー済み / 回答をコピー」を実行するボタン。 | 状態: disabled=!canCopy | onClick=onCopy | apps/web/src/features/chat/components/answer/AnswerCopyAction.tsx:18 | confirmed |
| CitationList | a | 未推定 | a 要素。静的解析では具体的な操作名を推定できません。 | - | - | apps/web/src/features/chat/components/answer/CitationList.tsx:13 | unknown |
| ClarificationOptions | button | この候補で質問する | 「この候補で質問する」を実行するボタン。 | 状態: disabled=disabled | onClick=() => void onSubmitClarificationOption(option, originalQuestion) | apps/web/src/features/chat/components/answer/ClarificationOptions.tsx:19 | confirmed |
| ClarificationOptions | button | 自分で入力 | 「自分で入力」を実行するボタン。 | 状態: disabled=disabled | onClick=() => onStartClarificationFreeform(originalQuestion, "例: 経費精算の申請期限は？") | apps/web/src/features/chat/components/answer/ClarificationOptions.tsx:29 | confirmed |
| FollowupSuggestions | button | 追加質問候補 | 「追加質問候補」を実行するボタン。 | 状態: disabled=disabled | onClick=() => onAdditionalQuestion(followup) | apps/web/src/features/chat/components/answer/FollowupSuggestions.tsx:17 | unknown |
| ChatComposer | button | 資料を添付 | 「資料を添付」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/chat/components/ChatComposer.tsx:86 | confirmed |
| ChatComposer | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=loading | onClick=() => fileInputRef.current?.click() | apps/web/src/features/chat/components/ChatComposer.tsx:101 | confirmed |
| ChatComposer | button | 質問を送信 | 「質問を送信」を実行するボタン。 | 状態: disabled=!canAsk | - | apps/web/src/features/chat/components/ChatComposer.tsx:128 | confirmed |
| ChatEmptyState | button | 質問例 | 「質問例」を実行するボタン。 | - | onClick=() => onSelectPrompt(prompt) | apps/web/src/features/chat/components/ChatEmptyState.tsx:21 | unknown |
| ChatRunIdBar | button | 実行IDをコピー済み / 実行IDをコピー | 「実行IDをコピー済み / 実行IDをコピー」を実行するボタン。 | 状態: disabled=!canCopy | onClick=() => void copyRunId() | apps/web/src/features/chat/components/ChatRunIdBar.tsx:52 | confirmed |
| QuestionAnswerPanel | button | 解決した | 「解決した」を実行するボタン。 | 状態: disabled=loading \|\| question.status === "resolved" | onClick=() => onResolveQuestion(question.questionId) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:40 | confirmed |
| QuestionAnswerPanel | button | 追加で質問する | 「追加で質問する」を実行するボタン。 | - | onClick=() => onAdditionalQuestion(`追加確認: ${question.title}\n`) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:44 | confirmed |
| QuestionEscalationPanel | button | 担当者へ送信 | 「担当者へ送信」を実行するボタン。 | 状態: disabled=loading \|\| !title.trim() \|\| !body.trim() | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:105 | confirmed |
| UserPromptBubble | button | プロンプトをコピー済み / プロンプトをコピー | 「プロンプトをコピー済み / プロンプトをコピー」を実行するボタン。 | 状態: disabled=!canCopyPrompt | onClick=copyPrompt | apps/web/src/features/chat/components/UserPromptBubble.tsx:47 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| ChatComposer | 質問入力 | 「質問入力」を入力・送信するフォーム。 | - | onSubmit=onAsk | apps/web/src/features/chat/components/ChatComposer.tsx:44 | confirmed |
| QuestionEscalationPanel | 担当者へ質問 | 「担当者へ質問」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:60 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ChatComposer | textarea | 質問 | 「質問」を複数行で入力する項目。 | 説明参照: chat-composer-shortcut<br>状態: disabled=loading | onChange=(event) => onSetQuestion(event.target.value)<br>onKeyDown=(event) => { if (event.key !== "Enter") return if (submitShortcut === "enter") { if (!eve… | apps/web/src/features/chat/components/ChatComposer.tsx:45 | confirmed |
| ChatComposer | input | ファイルをアップロード | 「ファイルをアップロード」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => onSetFile(event.target.files?.[0] ?? null) | apps/web/src/features/chat/components/ChatComposer.tsx:77 | confirmed |
| ChatComposer | select | モデルを選択 | 「モデルを選択」を選ぶ選択項目。 | 状態: disabled=loading | onChange=(event) => onModelChange(event.target.value) | apps/web/src/features/chat/components/ChatComposer.tsx:115 | confirmed |
| QuestionEscalationPanel | input | 件名 | 「件名」を入力または選択する項目。 | - | onChange=(event) => setTitle(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:69 | confirmed |
| QuestionEscalationPanel | textarea | 質問内容 | 「質問内容」を複数行で入力する項目。 | - | onChange=(event) => setBody(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:73 | confirmed |
| QuestionEscalationPanel | select | その他の質問 / 手続き / 社内制度 / 資料確認 | 「その他の質問 / 手続き / 社内制度 / 資料確認」を選ぶ選択項目。 | - | onChange=(event) => setCategory(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:78 | confirmed |
| QuestionEscalationPanel | select | 通常 / 高 / 緊急 | 「通常 / 高 / 緊急」を選ぶ選択項目。 | - | onChange=(event) => setPriority(event.target.value as HumanQuestion["priority"]) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:87 | confirmed |
| QuestionEscalationPanel | select | 総務部 / 人事部 / 情報システム部 / 経理部 | 「総務部 / 人事部 / 情報システム部 / 経理部」を選ぶ選択項目。 | - | onChange=(event) => setAssigneeDepartment(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:96 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AnswerCopyAction | button | 回答をコピー済み / 回答をコピー | 「回答をコピー済み / 回答をコピー」を実行するボタン。 | 状態: disabled=!canCopy | onClick=onCopy | apps/web/src/features/chat/components/answer/AnswerCopyAction.tsx:18 | confirmed |
| CitationList | a | 未推定 | a 要素。静的解析では具体的な操作名を推定できません。 | - | - | apps/web/src/features/chat/components/answer/CitationList.tsx:13 | unknown |
| ClarificationOptions | button | この候補で質問する | 「この候補で質問する」を実行するボタン。 | 状態: disabled=disabled | onClick=() => void onSubmitClarificationOption(option, originalQuestion) | apps/web/src/features/chat/components/answer/ClarificationOptions.tsx:19 | confirmed |
| ClarificationOptions | button | 自分で入力 | 「自分で入力」を実行するボタン。 | 状態: disabled=disabled | onClick=() => onStartClarificationFreeform(originalQuestion, "例: 経費精算の申請期限は？") | apps/web/src/features/chat/components/answer/ClarificationOptions.tsx:29 | confirmed |
| FollowupSuggestions | button | 追加質問候補 | 「追加質問候補」を実行するボタン。 | 状態: disabled=disabled | onClick=() => onAdditionalQuestion(followup) | apps/web/src/features/chat/components/answer/FollowupSuggestions.tsx:17 | unknown |
| ChatComposer | form | 質問入力 | 「質問入力」を入力・送信するフォーム。 | - | onSubmit=onAsk | apps/web/src/features/chat/components/ChatComposer.tsx:44 | confirmed |
| ChatComposer | textarea | 質問 | 「質問」を複数行で入力する項目。 | 説明参照: chat-composer-shortcut<br>状態: disabled=loading | onChange=(event) => onSetQuestion(event.target.value)<br>onKeyDown=(event) => { if (event.key !== "Enter") return if (submitShortcut === "enter") { if (!eve… | apps/web/src/features/chat/components/ChatComposer.tsx:45 | confirmed |
| ChatComposer | input | ファイルをアップロード | 「ファイルをアップロード」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => onSetFile(event.target.files?.[0] ?? null) | apps/web/src/features/chat/components/ChatComposer.tsx:77 | confirmed |
| ChatComposer | button | 資料を添付 | 「資料を添付」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/chat/components/ChatComposer.tsx:86 | confirmed |
| ChatComposer | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=loading | onClick=() => fileInputRef.current?.click() | apps/web/src/features/chat/components/ChatComposer.tsx:101 | confirmed |
| ChatComposer | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」に紐づく入力ラベル。 | - | - | apps/web/src/features/chat/components/ChatComposer.tsx:113 | confirmed |
| ChatComposer | select | モデルを選択 | 「モデルを選択」を選ぶ選択項目。 | 状態: disabled=loading | onChange=(event) => onModelChange(event.target.value) | apps/web/src/features/chat/components/ChatComposer.tsx:115 | confirmed |
| ChatComposer | option | Nova Lite v1 | 「Nova Lite v1」を表す option 要素。 | - | - | apps/web/src/features/chat/components/ChatComposer.tsx:116 | confirmed |
| ChatComposer | option | Claude 3.5 Sonnet | 「Claude 3.5 Sonnet」を表す option 要素。 | - | - | apps/web/src/features/chat/components/ChatComposer.tsx:117 | confirmed |
| ChatComposer | option | Claude 3 Haiku | 「Claude 3 Haiku」を表す option 要素。 | - | - | apps/web/src/features/chat/components/ChatComposer.tsx:118 | confirmed |
| ChatComposer | button | 質問を送信 | 「質問を送信」を実行するボタン。 | 状態: disabled=!canAsk | - | apps/web/src/features/chat/components/ChatComposer.tsx:128 | confirmed |
| ChatEmptyState | button | 質問例 | 「質問例」を実行するボタン。 | - | onClick=() => onSelectPrompt(prompt) | apps/web/src/features/chat/components/ChatEmptyState.tsx:21 | unknown |
| ChatRunIdBar | button | 実行IDをコピー済み / 実行IDをコピー | 「実行IDをコピー済み / 実行IDをコピー」を実行するボタン。 | 状態: disabled=!canCopy | onClick=() => void copyRunId() | apps/web/src/features/chat/components/ChatRunIdBar.tsx:52 | confirmed |
| QuestionAnswerPanel | button | 解決した | 「解決した」を実行するボタン。 | 状態: disabled=loading \|\| question.status === "resolved" | onClick=() => onResolveQuestion(question.questionId) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:40 | confirmed |
| QuestionAnswerPanel | button | 追加で質問する | 「追加で質問する」を実行するボタン。 | - | onClick=() => onAdditionalQuestion(`追加確認: ${question.title}\n`) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:44 | confirmed |
| QuestionEscalationPanel | form | 担当者へ質問 | 「担当者へ質問」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:60 | confirmed |
| QuestionEscalationPanel | label | 件名 | 「件名」に紐づく入力ラベル。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:67 | confirmed |
| QuestionEscalationPanel | input | 件名 | 「件名」を入力または選択する項目。 | - | onChange=(event) => setTitle(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:69 | confirmed |
| QuestionEscalationPanel | label | 質問内容 | 「質問内容」に紐づく入力ラベル。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:71 | confirmed |
| QuestionEscalationPanel | textarea | 質問内容 | 「質問内容」を複数行で入力する項目。 | - | onChange=(event) => setBody(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:73 | confirmed |
| QuestionEscalationPanel | label | カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認 | 「カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認」に紐づく入力ラベル。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:76 | confirmed |
| QuestionEscalationPanel | select | その他の質問 / 手続き / 社内制度 / 資料確認 | 「その他の質問 / 手続き / 社内制度 / 資料確認」を選ぶ選択項目。 | - | onChange=(event) => setCategory(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:78 | confirmed |
| QuestionEscalationPanel | option | その他の質問 | 「その他の質問」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:79 | confirmed |
| QuestionEscalationPanel | option | 手続き | 「手続き」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:80 | confirmed |
| QuestionEscalationPanel | option | 社内制度 | 「社内制度」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:81 | confirmed |
| QuestionEscalationPanel | option | 資料確認 | 「資料確認」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:82 | confirmed |
| QuestionEscalationPanel | label | 優先度 / 通常 / 高 / 緊急 | 「優先度 / 通常 / 高 / 緊急」に紐づく入力ラベル。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:85 | confirmed |
| QuestionEscalationPanel | select | 通常 / 高 / 緊急 | 「通常 / 高 / 緊急」を選ぶ選択項目。 | - | onChange=(event) => setPriority(event.target.value as HumanQuestion["priority"]) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:87 | confirmed |
| QuestionEscalationPanel | option | 通常 | 「通常」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:88 | confirmed |
| QuestionEscalationPanel | option | 高 | 「高」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:89 | confirmed |
| QuestionEscalationPanel | option | 緊急 | 「緊急」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:90 | confirmed |
| QuestionEscalationPanel | label | 担当部署 / 総務部 / 人事部 / 情報システム部 / 経理部 | 「担当部署 / 総務部 / 人事部 / 情報システム部 / 経理部」に紐づく入力ラベル。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:94 | confirmed |
| QuestionEscalationPanel | select | 総務部 / 人事部 / 情報システム部 / 経理部 | 「総務部 / 人事部 / 情報システム部 / 経理部」を選ぶ選択項目。 | - | onChange=(event) => setAssigneeDepartment(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:96 | confirmed |
| QuestionEscalationPanel | option | 総務部 | 「総務部」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:97 | confirmed |
| QuestionEscalationPanel | option | 人事部 | 「人事部」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:98 | confirmed |
| QuestionEscalationPanel | option | 情報システム部 | 「情報システム部」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:99 | confirmed |
| QuestionEscalationPanel | option | 経理部 | 「経理部」を表す option 要素。 | - | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:100 | confirmed |
| QuestionEscalationPanel | button | 担当者へ送信 | 「担当者へ送信」を実行するボタン。 | 状態: disabled=loading \|\| !title.trim() \|\| !body.trim() | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:105 | confirmed |
| UserPromptBubble | button | プロンプトをコピー済み / プロンプトをコピー | 「プロンプトをコピー済み / プロンプトをコピー」を実行するボタン。 | 状態: disabled=!canCopyPrompt | onClick=copyPrompt | apps/web/src/features/chat/components/UserPromptBubble.tsx:47 | confirmed |
