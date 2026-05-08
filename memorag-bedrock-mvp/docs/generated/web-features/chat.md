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

| コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- |
| AssistantAnswer | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/AssistantAnswer.tsx | AssistantAnswer | Icon, QuestionAnswerPanel, QuestionEscalationPanel, a, button, div, li, p, span, strong, ul |
| ChatComposer | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatComposer.tsx | ChatComposer | Icon, LoadingSpinner, button, div, form, input, label, span, textarea |
| ChatEmptyState | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatEmptyState.tsx | ChatEmptyState | Icon, button, div, h2, section, span |
| ChatView | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ChatView.tsx | ChatView | ChatComposer, DebugPanel, MessageList, p, section |
| MessageItem | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/MessageItem.tsx | MessageItem | AssistantAnswer, Icon, UserPromptBubble, article, div, span, strong |
| MessageList | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/MessageList.tsx | MessageList | ChatEmptyState, LoadingSpinner, MessageItem, ProcessingAnswer, article, div, span, strong |
| ProcessingAnswer | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/ProcessingAnswer.tsx | ProcessingAnswer | LoadingSpinner, div, p, span |
| QuestionAnswerPanel | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx | QuestionAnswerPanel | Icon, LoadingSpinner, button, dd, div, dl, dt, footer, header, p, section, span, strong |
| QuestionEscalationPanel | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx | QuestionEscalationPanel | LoadingSpinner, button, div, form, h3, input, label, option, p, section, select, span, strong, textarea |
| UserPromptBubble | 画面または画面内 UI コンポーネント | apps/web/src/features/chat/components/UserPromptBubble.tsx | UserPromptBubble | Icon, button, div, p, span |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| AssistantAnswer | a | 未推定 | - | apps/web/src/features/chat/components/AssistantAnswer.tsx:85 | unknown |
| AssistantAnswer | button | 未推定 | onClick=() => onAdditionalQuestion(followup) | apps/web/src/features/chat/components/AssistantAnswer.tsx:98 | unknown |
| AssistantAnswer | button | copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー" | onClick=() => copyText(message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:106 | confirmed |
| AssistantAnswer | button | option.reason ?? "この候補で質問する" | onClick=() => void onSubmitClarificationOption(option, message.sourceQuestion ?? message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:127 | confirmed |
| AssistantAnswer | button | 自分で入力 | onClick=() => onStartClarificationFreeform(message.sourceQuestion ?? message.text, "例: 経費精算の申請期限は… | apps/web/src/features/chat/components/AssistantAnswer.tsx:137 | confirmed |
| ChatComposer | button | 送信 | - | apps/web/src/features/chat/components/ChatComposer.tsx:92 | confirmed |
| ChatEmptyState | button | 未推定 | onClick=() => onSelectPrompt(prompt) | apps/web/src/features/chat/components/ChatEmptyState.tsx:21 | unknown |
| QuestionAnswerPanel | button | 解決した | onClick=() => onResolveQuestion(question.questionId) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:40 | confirmed |
| QuestionAnswerPanel | button | 追加で質問する | onClick=() => onAdditionalQuestion(`追加確認: ${question.title}\n`) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:44 | confirmed |
| QuestionEscalationPanel | button | 担当者へ送信 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:101 | confirmed |
| UserPromptBubble | button | copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー" | onClick=copyPrompt | apps/web/src/features/chat/components/UserPromptBubble.tsx:47 | confirmed |

## フォーム

| コンポーネント | ラベル | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- |
| ChatComposer | 未推定 | onSubmit=onAsk | apps/web/src/features/chat/components/ChatComposer.tsx:39 | unknown |
| QuestionEscalationPanel | 担当者へ質問 | onSubmit=onSubmit | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:56 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| ChatComposer | textarea | 質問 | onChange=(event) => onSetQuestion(event.target.value)<br>onKeyDown=(event) => { if (event.key !== "Enter") return if (submitShortcut === "enter") { if (!eve… | apps/web/src/features/chat/components/ChatComposer.tsx:40 | confirmed |
| ChatComposer | input | 未推定 | onChange=(event) => onSetFile(event.target.files?.[0] ?? null) | apps/web/src/features/chat/components/ChatComposer.tsx:72 | unknown |
| QuestionEscalationPanel | input | title | onChange=(event) => setTitle(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:65 | confirmed |
| QuestionEscalationPanel | textarea | body | onChange=(event) => setBody(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:69 | confirmed |
| QuestionEscalationPanel | select | category | onChange=(event) => setCategory(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:74 | confirmed |
| QuestionEscalationPanel | select | priority | onChange=(event) => setPriority(event.target.value as HumanQuestion["priority"]) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:83 | confirmed |
| QuestionEscalationPanel | select | assigneeDepartment | onChange=(event) => setAssigneeDepartment(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:92 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| AssistantAnswer | a | 未推定 | - | apps/web/src/features/chat/components/AssistantAnswer.tsx:85 | unknown |
| AssistantAnswer | button | 未推定 | onClick=() => onAdditionalQuestion(followup) | apps/web/src/features/chat/components/AssistantAnswer.tsx:98 | unknown |
| AssistantAnswer | button | copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー" | onClick=() => copyText(message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:106 | confirmed |
| AssistantAnswer | button | option.reason ?? "この候補で質問する" | onClick=() => void onSubmitClarificationOption(option, message.sourceQuestion ?? message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:127 | confirmed |
| AssistantAnswer | button | 自分で入力 | onClick=() => onStartClarificationFreeform(message.sourceQuestion ?? message.text, "例: 経費精算の申請期限は… | apps/web/src/features/chat/components/AssistantAnswer.tsx:137 | confirmed |
| AssistantAnswer | QuestionEscalationPanel | 未推定 | onCreateQuestion=onCreateQuestion | apps/web/src/features/chat/components/AssistantAnswer.tsx:148 | unknown |
| AssistantAnswer | QuestionAnswerPanel | 未推定 | onResolveQuestion=onResolveQuestion<br>onAdditionalQuestion=onAdditionalQuestion | apps/web/src/features/chat/components/AssistantAnswer.tsx:151 | unknown |
| ChatComposer | form | 未推定 | onSubmit=onAsk | apps/web/src/features/chat/components/ChatComposer.tsx:39 | unknown |
| ChatComposer | textarea | 質問 | onChange=(event) => onSetQuestion(event.target.value)<br>onKeyDown=(event) => { if (event.key !== "Enter") return if (submitShortcut === "enter") { if (!eve… | apps/web/src/features/chat/components/ChatComposer.tsx:40 | confirmed |
| ChatComposer | label | 資料を添付 | - | apps/web/src/features/chat/components/ChatComposer.tsx:70 | confirmed |
| ChatComposer | input | 未推定 | onChange=(event) => onSetFile(event.target.files?.[0] ?? null) | apps/web/src/features/chat/components/ChatComposer.tsx:72 | unknown |
| ChatComposer | button | 送信 | - | apps/web/src/features/chat/components/ChatComposer.tsx:92 | confirmed |
| ChatEmptyState | button | 未推定 | onClick=() => onSelectPrompt(prompt) | apps/web/src/features/chat/components/ChatEmptyState.tsx:21 | unknown |
| ChatView | MessageList | 未推定 | onSelectPrompt=onSetQuestion<br>onCreateQuestion=onCreateQuestion<br>onResolveQuestion=onResolveQuestion<br>onSubmitClarificationOption=onSubmitClarificationOption<br>onStartClarificationFreeform=onStartClarificationFreeform | apps/web/src/features/chat/components/ChatView.tsx:78 | unknown |
| ChatView | ChatComposer | 未推定 | onAsk=onAsk<br>onSetQuestion=onSetQuestion<br>onSetFile=onSetFile | apps/web/src/features/chat/components/ChatView.tsx:93 | unknown |
| ChatView | DebugPanel | 未推定 | onToggleAll=onToggleAllDebugSteps<br>onToggleStep=onToggleDebugStep | apps/web/src/features/chat/components/ChatView.tsx:111 | unknown |
| MessageItem | AssistantAnswer | 未推定 | onCreateQuestion=(input) => onCreateQuestion(messageIndex, message, input)<br>onResolveQuestion=onResolveQuestion<br>onAdditionalQuestion=onAdditionalQuestion<br>onSubmitClarificationOption=onSubmitClarificationOption<br>onStartClarificationFreeform=onStartClarificationFreeform | apps/web/src/features/chat/components/MessageItem.tsx:43 | unknown |
| MessageList | ChatEmptyState | 未推定 | onSelectPrompt=onSelectPrompt | apps/web/src/features/chat/components/MessageList.tsx:41 | unknown |
| MessageList | MessageItem | 未推定 | onCreateQuestion=onCreateQuestion<br>onResolveQuestion=onResolveQuestion<br>onAdditionalQuestion=onSelectPrompt<br>onSubmitClarificationOption=onSubmitClarificationOption<br>onStartClarificationFreeform=onStartClarificationFreeform | apps/web/src/features/chat/components/MessageList.tsx:43 | unknown |
| QuestionAnswerPanel | button | 解決した | onClick=() => onResolveQuestion(question.questionId) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:40 | confirmed |
| QuestionAnswerPanel | button | 追加で質問する | onClick=() => onAdditionalQuestion(`追加確認: ${question.title}\n`) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:44 | confirmed |
| QuestionEscalationPanel | form | 担当者へ質問 | onSubmit=onSubmit | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:56 | confirmed |
| QuestionEscalationPanel | label | 件名 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:63 | confirmed |
| QuestionEscalationPanel | input | title | onChange=(event) => setTitle(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:65 | confirmed |
| QuestionEscalationPanel | label | 質問内容 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:67 | confirmed |
| QuestionEscalationPanel | textarea | body | onChange=(event) => setBody(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:69 | confirmed |
| QuestionEscalationPanel | label | カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:72 | confirmed |
| QuestionEscalationPanel | select | category | onChange=(event) => setCategory(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:74 | confirmed |
| QuestionEscalationPanel | option | その他の質問 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:75 | confirmed |
| QuestionEscalationPanel | option | 手続き | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:76 | confirmed |
| QuestionEscalationPanel | option | 社内制度 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:77 | confirmed |
| QuestionEscalationPanel | option | 資料確認 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:78 | confirmed |
| QuestionEscalationPanel | label | 優先度 / 通常 / 高 / 緊急 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:81 | confirmed |
| QuestionEscalationPanel | select | priority | onChange=(event) => setPriority(event.target.value as HumanQuestion["priority"]) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:83 | confirmed |
| QuestionEscalationPanel | option | normal | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:84 | confirmed |
| QuestionEscalationPanel | option | high | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:85 | confirmed |
| QuestionEscalationPanel | option | urgent | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:86 | confirmed |
| QuestionEscalationPanel | label | 担当部署 / 総務部 / 人事部 / 情報システム部 / 経理部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:90 | confirmed |
| QuestionEscalationPanel | select | assigneeDepartment | onChange=(event) => setAssigneeDepartment(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:92 | confirmed |
| QuestionEscalationPanel | option | 総務部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:93 | confirmed |
| QuestionEscalationPanel | option | 人事部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:94 | confirmed |
| QuestionEscalationPanel | option | 情報システム部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:95 | confirmed |
| QuestionEscalationPanel | option | 経理部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:96 | confirmed |
| QuestionEscalationPanel | button | 担当者へ送信 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:101 | confirmed |
| UserPromptBubble | button | copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー" | onClick=copyPrompt | apps/web/src/features/chat/components/UserPromptBubble.tsx:47 | confirmed |
