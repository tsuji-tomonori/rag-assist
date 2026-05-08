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

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AssistantAnswer | a | citation.fileName | citation.fileName (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/AssistantAnswer.tsx:85 | confirmed |
| AssistantAnswer | button | followup | followup (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onAdditionalQuestion(followup) | apps/web/src/features/chat/components/AssistantAnswer.tsx:98 | confirmed |
| AssistantAnswer | button | copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー" | copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー" (aria-label) | disabled=!canCopyAnswer | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => copyText(message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:106 | confirmed |
| AssistantAnswer | button | option.reason ?? "この候補で質問する" | option.label (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onSubmitClarificationOption(option, message.sourceQuestion ?? message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:127 | confirmed |
| AssistantAnswer | button | 自分で入力 | 自分で入力 (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onStartClarificationFreeform(message.sourceQuestion ?? message.text, "例: 経費精算の申請期限は… | apps/web/src/features/chat/components/AssistantAnswer.tsx:137 | confirmed |
| ChatComposer | button | 質問を送信 | 質問を送信 (aria-label) | disabled=!canAsk | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/ChatComposer.tsx:93 | confirmed |
| ChatEmptyState | button | prompt | prompt (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onSelectPrompt(prompt) | apps/web/src/features/chat/components/ChatEmptyState.tsx:21 | confirmed |
| QuestionAnswerPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 解決した | loading && <LoadingSpinner className="button-spinner" /> / 解決した (visible-text) | disabled=loading \|\| question.status === "resolved" | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onResolveQuestion(question.questionId) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:40 | confirmed |
| QuestionAnswerPanel | button | 追加で質問する | 追加で質問する (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onAdditionalQuestion(`追加確認: ${question.title}\n`) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:44 | confirmed |
| QuestionEscalationPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 担当者へ送信 | loading && <LoadingSpinner className="button-spinner" /> / 担当者へ送信 (visible-text) | disabled=loading \|\| !title.trim() \|\| !body.trim() | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:101 | confirmed |
| UserPromptBubble | button | copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー" | copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー" (aria-label) | disabled=!canCopyPrompt | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=copyPrompt | apps/web/src/features/chat/components/UserPromptBubble.tsx:47 | confirmed |

## フォーム

| コンポーネント | ラベル | 説明参照 | a11y | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| ChatComposer | 質問入力 | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onAsk | apps/web/src/features/chat/components/ChatComposer.tsx:39 | confirmed |
| QuestionEscalationPanel | 担当者へ質問 | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onSubmit | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:56 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | アクセシブル名 | 説明参照 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ChatComposer | textarea | 質問 | 質問 (aria-label) | chat-composer-shortcut | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onSetQuestion(event.target.value)<br>onKeyDown=(event) => { if (event.key !== "Enter") return if (submitShortcut === "enter") { if (!eve… | apps/web/src/features/chat/components/ChatComposer.tsx:40 | confirmed |
| ChatComposer | input | 資料を添付 | 資料を添付 (aria-label) | - | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onSetFile(event.target.files?.[0] ?? null) | apps/web/src/features/chat/components/ChatComposer.tsx:73 | confirmed |
| QuestionEscalationPanel | input | title | 件名 (label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setTitle(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:65 | confirmed |
| QuestionEscalationPanel | textarea | body | 質問内容 (label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setBody(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:69 | confirmed |
| QuestionEscalationPanel | select | category | その他の質問 / 手続き / 社内制度 / 資料確認 (visible-text) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setCategory(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:74 | confirmed |
| QuestionEscalationPanel | select | priority | 通常 / 高 / 緊急 (visible-text) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setPriority(event.target.value as HumanQuestion["priority"]) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:83 | confirmed |
| QuestionEscalationPanel | select | assigneeDepartment | 総務部 / 人事部 / 情報システム部 / 経理部 (visible-text) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setAssigneeDepartment(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:92 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AssistantAnswer | a | citation.fileName | citation.fileName (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/AssistantAnswer.tsx:85 | confirmed |
| AssistantAnswer | button | followup | followup (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onAdditionalQuestion(followup) | apps/web/src/features/chat/components/AssistantAnswer.tsx:98 | confirmed |
| AssistantAnswer | button | copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー" | copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー" (aria-label) | disabled=!canCopyAnswer | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => copyText(message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:106 | confirmed |
| AssistantAnswer | button | option.reason ?? "この候補で質問する" | option.label (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onSubmitClarificationOption(option, message.sourceQuestion ?? message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:127 | confirmed |
| AssistantAnswer | button | 自分で入力 | 自分で入力 (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onStartClarificationFreeform(message.sourceQuestion ?? message.text, "例: 経費精算の申請期限は… | apps/web/src/features/chat/components/AssistantAnswer.tsx:137 | confirmed |
| AssistantAnswer | QuestionEscalationPanel | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onCreateQuestion=onCreateQuestion | apps/web/src/features/chat/components/AssistantAnswer.tsx:148 | unknown |
| AssistantAnswer | QuestionAnswerPanel | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onResolveQuestion=onResolveQuestion<br>onAdditionalQuestion=onAdditionalQuestion | apps/web/src/features/chat/components/AssistantAnswer.tsx:151 | unknown |
| ChatComposer | form | 質問入力 | 質問入力 (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onAsk | apps/web/src/features/chat/components/ChatComposer.tsx:39 | confirmed |
| ChatComposer | textarea | 質問 | 質問 (aria-label) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onSetQuestion(event.target.value)<br>onKeyDown=(event) => { if (event.key !== "Enter") return if (submitShortcut === "enter") { if (!eve… | apps/web/src/features/chat/components/ChatComposer.tsx:40 | confirmed |
| ChatComposer | label | 資料を添付 | フォルダを選ぶ / ファイルをアップロード (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/ChatComposer.tsx:71 | confirmed |
| ChatComposer | input | 資料を添付 | 資料を添付 (aria-label) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onSetFile(event.target.files?.[0] ?? null) | apps/web/src/features/chat/components/ChatComposer.tsx:73 | confirmed |
| ChatComposer | button | 質問を送信 | 質問を送信 (aria-label) | disabled=!canAsk | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/ChatComposer.tsx:93 | confirmed |
| ChatEmptyState | button | prompt | prompt (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onSelectPrompt(prompt) | apps/web/src/features/chat/components/ChatEmptyState.tsx:21 | confirmed |
| ChatView | MessageList | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSelectPrompt=onSetQuestion<br>onCreateQuestion=onCreateQuestion<br>onResolveQuestion=onResolveQuestion<br>onSubmitClarificationOption=onSubmitClarificationOption<br>onStartClarificationFreeform=onStartClarificationFreeform | apps/web/src/features/chat/components/ChatView.tsx:78 | unknown |
| ChatView | ChatComposer | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onAsk=onAsk<br>onSetQuestion=onSetQuestion<br>onSetFile=onSetFile | apps/web/src/features/chat/components/ChatView.tsx:93 | unknown |
| ChatView | DebugPanel | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onToggleAll=onToggleAllDebugSteps<br>onToggleStep=onToggleDebugStep | apps/web/src/features/chat/components/ChatView.tsx:111 | unknown |
| MessageItem | AssistantAnswer | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onCreateQuestion=(input) => onCreateQuestion(messageIndex, message, input)<br>onResolveQuestion=onResolveQuestion<br>onAdditionalQuestion=onAdditionalQuestion<br>onSubmitClarificationOption=onSubmitClarificationOption<br>onStartClarificationFreeform=onStartClarificationFreeform | apps/web/src/features/chat/components/MessageItem.tsx:43 | unknown |
| MessageList | ChatEmptyState | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSelectPrompt=onSelectPrompt | apps/web/src/features/chat/components/MessageList.tsx:41 | unknown |
| MessageList | MessageItem | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onCreateQuestion=onCreateQuestion<br>onResolveQuestion=onResolveQuestion<br>onAdditionalQuestion=onSelectPrompt<br>onSubmitClarificationOption=onSubmitClarificationOption<br>onStartClarificationFreeform=onStartClarificationFreeform | apps/web/src/features/chat/components/MessageList.tsx:43 | unknown |
| QuestionAnswerPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 解決した | loading && <LoadingSpinner className="button-spinner" /> / 解決した (visible-text) | disabled=loading \|\| question.status === "resolved" | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onResolveQuestion(question.questionId) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:40 | confirmed |
| QuestionAnswerPanel | button | 追加で質問する | 追加で質問する (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onAdditionalQuestion(`追加確認: ${question.title}\n`) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:44 | confirmed |
| QuestionEscalationPanel | form | 担当者へ質問 | 担当者へ質問 (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onSubmit | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:56 | confirmed |
| QuestionEscalationPanel | label | 件名 | 件名 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:63 | confirmed |
| QuestionEscalationPanel | input | title | 件名 (label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setTitle(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:65 | confirmed |
| QuestionEscalationPanel | label | 質問内容 | 質問内容 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:67 | confirmed |
| QuestionEscalationPanel | textarea | body | 質問内容 (label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setBody(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:69 | confirmed |
| QuestionEscalationPanel | label | カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認 | カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:72 | confirmed |
| QuestionEscalationPanel | select | category | その他の質問 / 手続き / 社内制度 / 資料確認 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setCategory(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:74 | confirmed |
| QuestionEscalationPanel | option | その他の質問 | その他の質問 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:75 | confirmed |
| QuestionEscalationPanel | option | 手続き | 手続き (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:76 | confirmed |
| QuestionEscalationPanel | option | 社内制度 | 社内制度 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:77 | confirmed |
| QuestionEscalationPanel | option | 資料確認 | 資料確認 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:78 | confirmed |
| QuestionEscalationPanel | label | 優先度 / 通常 / 高 / 緊急 | 優先度 / 通常 / 高 / 緊急 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:81 | confirmed |
| QuestionEscalationPanel | select | priority | 通常 / 高 / 緊急 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setPriority(event.target.value as HumanQuestion["priority"]) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:83 | confirmed |
| QuestionEscalationPanel | option | normal | 通常 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:84 | confirmed |
| QuestionEscalationPanel | option | high | 高 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:85 | confirmed |
| QuestionEscalationPanel | option | urgent | 緊急 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:86 | confirmed |
| QuestionEscalationPanel | label | 担当部署 / 総務部 / 人事部 / 情報システム部 / 経理部 | 担当部署 / 総務部 / 人事部 / 情報システム部 / 経理部 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:90 | confirmed |
| QuestionEscalationPanel | select | assigneeDepartment | 総務部 / 人事部 / 情報システム部 / 経理部 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setAssigneeDepartment(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:92 | confirmed |
| QuestionEscalationPanel | option | 総務部 | 総務部 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:93 | confirmed |
| QuestionEscalationPanel | option | 人事部 | 人事部 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:94 | confirmed |
| QuestionEscalationPanel | option | 情報システム部 | 情報システム部 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:95 | confirmed |
| QuestionEscalationPanel | option | 経理部 | 経理部 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:96 | confirmed |
| QuestionEscalationPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 担当者へ送信 | loading && <LoadingSpinner className="button-spinner" /> / 担当者へ送信 (visible-text) | disabled=loading \|\| !title.trim() \|\| !body.trim() | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:101 | confirmed |
| UserPromptBubble | button | copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー" | copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー" (aria-label) | disabled=!canCopyPrompt | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=copyPrompt | apps/web/src/features/chat/components/UserPromptBubble.tsx:47 | confirmed |
