import type { FormEvent } from "react"
import type { SubmitShortcut } from "../../../app/types.js"
import type { DocumentGroup } from "../../documents/types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingSpinner } from "../../../shared/components/LoadingSpinner.js"

export function ChatComposer({
  onAsk,
  question,
  submitShortcut,
  modelId,
  file,
  selectedGroupId,
  documentGroups,
  canWriteDocuments,
  conversationKey,
  canAsk,
  loading,
  onSetQuestion,
  onModelChange,
  onSetFile
}: {
  onAsk: (event: FormEvent) => Promise<void>
  question: string
  submitShortcut: SubmitShortcut
  modelId: string
  file: File | null
  selectedGroupId: string
  documentGroups: DocumentGroup[]
  canWriteDocuments: boolean
  conversationKey: number
  canAsk: boolean
  loading: boolean
  onSetQuestion: (value: string) => void
  onModelChange: (modelId: string) => void
  onSetFile: (file: File | null) => void
}) {
  const selectedGroupName = selectedGroupId === "all"
    ? "全フォルダ"
    : documentGroups.find((group) => group.groupId === selectedGroupId)?.name ?? "選択フォルダ"

  return (
    <form className="composer" onSubmit={onAsk} aria-label="質問入力">
      <textarea
        aria-label="質問"
        aria-describedby="chat-composer-shortcut"
        placeholder={
          submitShortcut === "enter"
            ? "質問を入力してください...（Enterで送信 / Shift+Enterで改行）"
            : "質問を入力してください...（Ctrl+Enterで送信 / Enterで改行）"
        }
        value={question}
        disabled={loading}
        onChange={(event) => onSetQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return

          if (submitShortcut === "enter") {
            if (!event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
            return
          }

          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <div className="composer-actions">
        <div className="composer-left-actions">
          {canWriteDocuments && (
            <label className="icon-button attach-button" title="資料を添付">
              <Icon name="paperclip" />
              <input key={conversationKey} type="file" aria-label="資料を添付" disabled={loading} onChange={(event) => onSetFile(event.target.files?.[0] ?? null)} />
              <span className="attach-menu" aria-hidden="true">
                <span>
                  <Icon name="document" />
                  フォルダを選ぶ
                </span>
                <span>
                  <Icon name="download" />
                  ファイルをアップロード
                </span>
              </span>
            </label>
          )}
          <label className="composer-model-control">
            <span className="sr-only">モデル</span>
            <select value={modelId} onChange={(event) => onModelChange(event.target.value)} disabled={loading} aria-label="モデルを選択">
              <option value="amazon.nova-lite-v1:0">Nova Lite v1</option>
              <option value="anthropic.claude-3-5-sonnet-20240620-v1:0">Claude 3.5 Sonnet</option>
              <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
            </select>
          </label>
          <span className="file-chip">{`参照: ${selectedGroupName}`}</span>
          {file && <span className="file-chip">{`一時添付: ${file.name}`}</span>}
        </div>
        <div className="composer-shortcut-toggle">
          <Icon name="settings" />
          <span id="chat-composer-shortcut">{submitShortcut === "enter" ? "Enterで送信" : "Ctrl+Enterで送信"}</span>
        </div>
        <button className="send-button" disabled={!canAsk} type="submit" title="送信" aria-label="質問を送信">
          {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="send" />}
        </button>
      </div>
    </form>
  )
}
